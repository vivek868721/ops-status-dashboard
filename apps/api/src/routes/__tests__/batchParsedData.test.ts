import { describe, it, expect, beforeEach, afterEach } from "vitest";
import bcrypt from "bcryptjs";
import { adminUsers, tenants } from "@ops/db";
import { buildApp } from "../../app.js";
import { createTestDb, seedDefaultPermissions, seedUserTenantPermission } from "../../test-helpers/db.js";

type Db = Awaited<ReturnType<typeof createTestDb>>["db"];
type Client = Awaited<ReturnType<typeof createTestDb>>["client"];

async function createUser(db: Db, email: string) {
  const hash = await bcrypt.hash("password", 10);
  const [u] = await db.insert(adminUsers).values({ email, passwordHash: hash, role: null }).returning({ id: adminUsers.id });
  return u.id;
}

async function loginAs(app: ReturnType<typeof buildApp>, email: string) {
  const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password: "password" } });
  return res.cookies.find((c) => c.name === "session")!.value;
}

async function seedRawAndDetail(client: Client, rows: {
  rawId: number; tenantId: number; batchDate?: string; integrationId?: string; collectorId?: number;
  details: { id: number; fieldName: string; fieldValue: string }[];
}[]) {
  for (const r of rows) {
    await client.exec(`
      INSERT INTO tb_raw_data (id, batch_date, integration_id, tenant_id, collector_id, parse_yn, data)
      VALUES (${r.rawId}, '${r.batchDate ?? "2026-07-01"}', '${r.integrationId ?? "JSM"}',
              ${r.tenantId}, ${r.collectorId ?? 1}, 'Y', '{}')
    `);
    for (const d of r.details) {
      await client.exec(`
        INSERT INTO tb_raw_data_detail (id, raw_data_id, field_name, field_value)
        VALUES (${d.id}, ${r.rawId}, '${d.fieldName}', '${d.fieldValue}')
      `);
    }
  }
}

// ── Cycle 1 — GET /api/batch/parsed-data list ─────────────────────────────────

describe("GET /api/batch/parsed-data", () => {
  let db: Db;
  let client: Client;
  let app: ReturnType<typeof buildApp>;
  let token: string;

  beforeEach(async () => {
    ({ db, client } = await createTestDb());
    app = buildApp(db);
    await app.ready();
    await db.insert(tenants).values({ id: 1, name: "Acme" });
    await db.insert(tenants).values({ id: 2, name: "Other" });
    await seedDefaultPermissions(db);
    const userId = await createUser(db, "mgr@example.com");
    await seedUserTenantPermission(db, userId, 1, "it_manager");
    token = await loginAs(app, "mgr@example.com");
  });

  afterEach(async () => { await app.close(); await client.close(); });

  it("returns tenant-scoped parsed data list with correct shape", async () => {
    await seedRawAndDetail(client, [
      { rawId: 1, tenantId: 1, batchDate: "2026-07-01", integrationId: "JSM", collectorId: 10,
        details: [{ id: 1, fieldName: "issue_id", fieldValue: "JSM-101" }, { id: 2, fieldName: "title", fieldValue: "Login broken" }] },
      { rawId: 2, tenantId: 2, batchDate: "2026-07-01", integrationId: "JSM", collectorId: 10,
        details: [{ id: 3, fieldName: "issue_id", fieldValue: "JSM-200" }] },
    ]);

    const res = await app.inject({
      method: "GET", url: "/api/batch/parsed-data",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: unknown[]; total: number };
    expect(body.items).toHaveLength(2); // 2 detail rows for tenant 1
    expect(body.total).toBe(2);
    const item = body.items[0] as Record<string, unknown>;
    expect(item).toMatchObject({
      id: expect.any(Number),
      rawDataId: expect.any(Number),
      fieldName: expect.any(String),
      fieldValue: expect.any(String),
      batchDate: expect.any(String),
      integrationId: expect.any(String),
    });
  });

  it("filters by batchDate", async () => {
    await seedRawAndDetail(client, [
      { rawId: 1, tenantId: 1, batchDate: "2026-06-30", details: [{ id: 1, fieldName: "f", fieldValue: "v1" }] },
      { rawId: 2, tenantId: 1, batchDate: "2026-07-01", details: [{ id: 2, fieldName: "f", fieldValue: "v2" }] },
    ]);

    const res = await app.inject({
      method: "GET", url: "/api/batch/parsed-data?batchDate=2026-06-30",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: unknown[]; total: number };
    expect(body.total).toBe(1);
  });

  it("returns 403 for executive permission", async () => {
    const execId = await createUser(db, "exec@example.com");
    await seedUserTenantPermission(db, execId, 1, "executive");
    const execToken = await loginAs(app, "exec@example.com");

    const res = await app.inject({
      method: "GET", url: "/api/batch/parsed-data",
      cookies: { session: execToken },
      headers: { "x-tenant-id": "1", "x-permission": "executive" },
    });

    expect(res.statusCode).toBe(403);
  });
});

// ── Cycle 2 — GET /api/batch/parsed-data/export ───────────────────────────────

describe("GET /api/batch/parsed-data/export", () => {
  let db: Db;
  let client: Client;
  let app: ReturnType<typeof buildApp>;
  let token: string;

  beforeEach(async () => {
    ({ db, client } = await createTestDb());
    app = buildApp(db);
    await app.ready();
    await db.insert(tenants).values({ id: 1, name: "Acme" });
    await seedDefaultPermissions(db);
    const userId = await createUser(db, "mgr@example.com");
    await seedUserTenantPermission(db, userId, 1, "it_manager");
    token = await loginAs(app, "mgr@example.com");
  });

  afterEach(async () => { await app.close(); await client.close(); });

  it("returns CSV with header and rows", async () => {
    await seedRawAndDetail(client, [
      { rawId: 1, tenantId: 1, batchDate: "2026-07-01", integrationId: "JSM", collectorId: 10,
        details: [{ id: 1, fieldName: "issue_id", fieldValue: "JSM-101" }] },
    ]);

    const res = await app.inject({
      method: "GET", url: "/api/batch/parsed-data/export",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.body).toContain("id,rawDataId,batchDate,integrationId,fieldName,fieldValue");
    expect(res.body).toContain("JSM-101");
  });
});

// ── Cycle 3 — GET /api/batch/parsed-data/:id detail ──────────────────────────

describe("GET /api/batch/parsed-data/:id", () => {
  let db: Db;
  let client: Client;
  let app: ReturnType<typeof buildApp>;
  let token: string;

  beforeEach(async () => {
    ({ db, client } = await createTestDb());
    app = buildApp(db);
    await app.ready();
    await db.insert(tenants).values({ id: 1, name: "Acme" });
    await db.insert(tenants).values({ id: 2, name: "Other" });
    await seedDefaultPermissions(db);
    const userId = await createUser(db, "mgr@example.com");
    await seedUserTenantPermission(db, userId, 1, "it_manager");
    token = await loginAs(app, "mgr@example.com");
  });

  afterEach(async () => { await app.close(); await client.close(); });

  it("returns parsed data detail by id", async () => {
    await seedRawAndDetail(client, [
      { rawId: 1, tenantId: 1, batchDate: "2026-07-01", integrationId: "JSM", collectorId: 10,
        details: [{ id: 99, fieldName: "issue_id", fieldValue: "JSM-999" }] },
    ]);

    const res = await app.inject({
      method: "GET", url: "/api/batch/parsed-data/99",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.id).toBe(99);
    expect(body.fieldName).toBe("issue_id");
    expect(body.fieldValue).toBe("JSM-999");
  });

  it("returns 404 for record belonging to different tenant", async () => {
    await seedRawAndDetail(client, [
      { rawId: 1, tenantId: 2, batchDate: "2026-07-01", integrationId: "JSM", collectorId: 10,
        details: [{ id: 55, fieldName: "f", fieldValue: "v" }] },
    ]);

    const res = await app.inject({
      method: "GET", url: "/api/batch/parsed-data/55",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(404);
  });
});
