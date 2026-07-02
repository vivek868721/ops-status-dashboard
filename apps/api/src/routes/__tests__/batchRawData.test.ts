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

async function seedRawData(client: Client, rows: {
  id: number; tenantId: number; batchDate?: string; integrationId?: string;
  collectorId?: number; parseYn?: string; data?: string;
}[]) {
  for (const r of rows) {
    await client.exec(`
      INSERT INTO tb_raw_data (id, batch_date, integration_id, tenant_id, collector_id, parse_yn, data)
      VALUES (${r.id}, '${r.batchDate ?? "2026-07-01"}', '${r.integrationId ?? "JSM"}',
              ${r.tenantId}, ${r.collectorId ?? 1}, '${r.parseYn ?? "N"}',
              '${r.data ?? '{"key":"value"}'}')
    `);
  }
}

// ── Cycle 1 — GET /api/batch/raw-data list ────────────────────────────────────

describe("GET /api/batch/raw-data", () => {
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

  it("returns tenant-scoped raw data list with correct shape", async () => {
    await seedRawData(client, [
      { id: 1, tenantId: 1, batchDate: "2026-07-01", integrationId: "JSM", collectorId: 10 },
      { id: 2, tenantId: 1, batchDate: "2026-07-01", integrationId: "SAP", collectorId: 11 },
      { id: 3, tenantId: 2, batchDate: "2026-07-01", integrationId: "JSM", collectorId: 10 },
    ]);

    const res = await app.inject({
      method: "GET", url: "/api/batch/raw-data",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: unknown[]; total: number };
    expect(body.items).toHaveLength(2);
    expect(body.total).toBe(2);
    const item = body.items[0] as Record<string, unknown>;
    expect(item).toMatchObject({ id: expect.any(Number), integrationId: expect.any(String), collectorId: expect.any(Number) });
  });

  it("filters by batchDate", async () => {
    await seedRawData(client, [
      { id: 1, tenantId: 1, batchDate: "2026-06-30" },
      { id: 2, tenantId: 1, batchDate: "2026-07-01" },
    ]);

    const res = await app.inject({
      method: "GET", url: "/api/batch/raw-data?batchDate=2026-06-30",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });

  it("filters by collectorId", async () => {
    await seedRawData(client, [
      { id: 1, tenantId: 1, collectorId: 5 },
      { id: 2, tenantId: 1, collectorId: 5 },
      { id: 3, tenantId: 1, collectorId: 9 },
    ]);

    const res = await app.inject({
      method: "GET", url: "/api/batch/raw-data?collectorId=5",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: unknown[] };
    expect(body.items).toHaveLength(2);
  });

  it("returns 401 without session", async () => {
    const res = await app.inject({
      method: "GET", url: "/api/batch/raw-data",
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 for executive (no batch_view_raw_data)", async () => {
    await db.insert(tenants).values({ id: 3, name: "ExecCo" });
    const execId = await createUser(db, "exec@example.com");
    await seedUserTenantPermission(db, execId, 3, "executive");
    const execToken = await loginAs(app, "exec@example.com");

    const res = await app.inject({
      method: "GET", url: "/api/batch/raw-data",
      cookies: { session: execToken },
      headers: { "x-tenant-id": "3", "x-permission": "executive" },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ── Cycle 2 — GET /api/batch/raw-data/:id single record ──────────────────────

describe("GET /api/batch/raw-data/:id", () => {
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

  it("returns single record with data field", async () => {
    await seedRawData(client, [
      { id: 42, tenantId: 1, integrationId: "SAP", data: '{"records":[1,2,3]}' },
    ]);

    const res = await app.inject({
      method: "GET", url: "/api/batch/raw-data/42",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { item: Record<string, unknown> };
    expect(body.item).toMatchObject({ id: 42, integrationId: "SAP" });
    expect(body.item.data).toBeDefined();
  });

  it("returns 404 when record belongs to a different tenant", async () => {
    await seedRawData(client, [{ id: 99, tenantId: 2 }]);

    const res = await app.inject({
      method: "GET", url: "/api/batch/raw-data/99",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });
    expect(res.statusCode).toBe(404);
  });
});

// ── Cycle 3 — GET /api/batch/raw-data/export JSON download ───────────────────

describe("GET /api/batch/raw-data/export", () => {
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

  it("returns JSON array with correct content-type and disposition", async () => {
    await seedRawData(client, [
      { id: 1, tenantId: 1, integrationId: "JSM", data: '{"k":1}' },
      { id: 2, tenantId: 1, integrationId: "SAP", data: '{"k":2}' },
    ]);

    const res = await app.inject({
      method: "GET", url: "/api/batch/raw-data/export",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.headers["content-disposition"]).toContain("raw-data.json");
    const parsed = JSON.parse(res.body) as unknown[];
    expect(parsed).toHaveLength(2);
  });
});
