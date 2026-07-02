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

async function seedHistory(client: Client, rows: {
  id: number; tenantId: number; batchDate?: string; integrationId?: string;
  crawlingStatus?: string; parseStatus?: string; collectorId?: number;
}[]) {
  for (const r of rows) {
    await client.exec(`
      INSERT INTO tb_batch_history (id, batch_date, integration_id, tenant_id, collector_id, crawling_status, parse_status)
      VALUES (${r.id}, '${r.batchDate ?? "2026-07-01"}', '${r.integrationId ?? "JSM"}',
              ${r.tenantId}, ${r.collectorId ?? 1}, '${r.crawlingStatus ?? "S"}', '${r.parseStatus ?? "S"}')
    `);
  }
}

// ── Cycle 1 — GET /api/batch/history list ────────────────────────────────────

describe("GET /api/batch/history", () => {
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

  it("returns tenant-scoped history with correct shape", async () => {
    await seedHistory(client, [
      { id: 1, tenantId: 1, batchDate: "2026-06-30", integrationId: "JSM", crawlingStatus: "S", parseStatus: "S" },
      { id: 2, tenantId: 1, batchDate: "2026-07-01", integrationId: "SAP", crawlingStatus: "F", parseStatus: "F" },
      { id: 3, tenantId: 2, batchDate: "2026-07-01", integrationId: "JSM", crawlingStatus: "S", parseStatus: "S" },
    ]);

    const res = await app.inject({
      method: "GET", url: "/api/batch/history",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: unknown[]; total: number };
    expect(body.items).toHaveLength(2);
    expect(body.total).toBe(2);
    const item = body.items[0] as Record<string, unknown>;
    expect(item).toMatchObject({ id: expect.any(Number), integrationId: expect.any(String), crawlingStatus: expect.any(String) });
  });

  it("filters by batchDate", async () => {
    await seedHistory(client, [
      { id: 1, tenantId: 1, batchDate: "2026-06-30" },
      { id: 2, tenantId: 1, batchDate: "2026-07-01" },
    ]);

    const res = await app.inject({
      method: "GET", url: "/api/batch/history?batchDate=2026-06-30",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });

  it("filters by crawlingStatus", async () => {
    await seedHistory(client, [
      { id: 1, tenantId: 1, crawlingStatus: "S" },
      { id: 2, tenantId: 1, crawlingStatus: "F" },
      { id: 3, tenantId: 1, crawlingStatus: "F" },
    ]);

    const res = await app.inject({
      method: "GET", url: "/api/batch/history?crawlingStatus=F",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: unknown[] };
    expect(body.items).toHaveLength(2);
  });

  it("returns 401 without session", async () => {
    const res = await app.inject({
      method: "GET", url: "/api/batch/history",
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ── Cycle 2 — GET /api/batch/history/:id single row ──────────────────────────

describe("GET /api/batch/history/:id", () => {
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

  it("returns a single history row", async () => {
    await seedHistory(client, [{ id: 10, tenantId: 1, integrationId: "SAP", crawlingStatus: "F" }]);

    const res = await app.inject({
      method: "GET", url: "/api/batch/history/10",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { item: Record<string, unknown> };
    expect(body.item).toMatchObject({ id: 10, integrationId: "SAP", crawlingStatus: "F" });
  });

  it("returns 404 when row belongs to a different tenant", async () => {
    await seedHistory(client, [{ id: 20, tenantId: 2, integrationId: "JSM" }]);

    const res = await app.inject({
      method: "GET", url: "/api/batch/history/20",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ── Cycle 3 — POST /api/batch/history/:id/retry ───────────────────────────────

describe("POST /api/batch/history/:id/retry", () => {
  let db: Db;
  let client: Client;
  let app: ReturnType<typeof buildApp>;
  let token: string;

  beforeEach(async () => {
    ({ db, client } = await createTestDb());
    app = buildApp(db);
    await app.ready();
    await db.insert(tenants).values({ id: 1, name: "Acme" });
    await db.insert(tenants).values({ id: 2, name: "ExecCo" });
    await seedDefaultPermissions(db);
    const userId = await createUser(db, "mgr@example.com");
    await seedUserTenantPermission(db, userId, 1, "it_manager");
    token = await loginAs(app, "mgr@example.com");
  });

  afterEach(async () => { await app.close(); await client.close(); });

  it("creates a tb_job_execution_audit row with trigger_type=retry", async () => {
    await seedHistory(client, [{ id: 5, tenantId: 1, collectorId: 99, crawlingStatus: "F" }]);

    const res = await app.inject({
      method: "POST", url: "/api/batch/history/5/retry",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    const [auditResult] = await client.exec("SELECT * FROM tb_job_execution_audit");
    expect(auditResult.rows).toHaveLength(1);
    expect(auditResult.rows[0]).toMatchObject({ collector_id: 99, trigger_type: "retry", status: "TRIGGERED" });
  });

  it("returns 403 for executive", async () => {
    const execId = await createUser(db, "exec@example.com");
    await seedUserTenantPermission(db, execId, 2, "executive");
    const execToken = await loginAs(app, "exec@example.com");

    const res = await app.inject({
      method: "POST", url: "/api/batch/history/5/retry",
      cookies: { session: execToken },
      headers: { "x-tenant-id": "2", "x-permission": "executive" },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ── Cycle 4 — GET /api/batch/history/export CSV ───────────────────────────────

describe("GET /api/batch/history/export", () => {
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

  it("returns CSV with correct content-type and header row", async () => {
    await seedHistory(client, [
      { id: 1, tenantId: 1, batchDate: "2026-07-01", integrationId: "JSM", crawlingStatus: "S" },
    ]);

    const res = await app.inject({
      method: "GET", url: "/api/batch/history/export",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    const lines = res.body.trim().split("\n");
    expect(lines[0]).toContain("id");
    expect(lines[0]).toContain("batch_date");
    expect(lines[0]).toContain("integration_id");
    expect(lines[0]).toContain("crawling_status");
    expect(lines).toHaveLength(2); // header + 1 data row
  });
});
