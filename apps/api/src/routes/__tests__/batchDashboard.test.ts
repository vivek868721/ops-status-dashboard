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

async function seedBatchHistory(client: Client, rows: { tenantId: number; status: string; integrationId?: string; batchDate?: string }[]) {
  for (const r of rows) {
    await client.exec(`
      INSERT INTO tb_batch_history (batch_date, integration_id, tenant_id, collector_id, crawling_status)
      VALUES ('${r.batchDate ?? "2026-07-01"}', '${r.integrationId ?? "JSM"}', ${r.tenantId}, 1, '${r.status}')
    `);
  }
}

// ── Cycle 1 — /summary counts and successRate ────────────────────────────────

describe("GET /api/batch/dashboard/summary", () => {
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

  it("returns counts by status and successRate for the tenant", async () => {
    await seedBatchHistory(client, [
      { tenantId: 1, status: "S" },
      { tenantId: 1, status: "S" },
      { tenantId: 1, status: "S" },
      { tenantId: 1, status: "F" },
      { tenantId: 1, status: "R" },
    ]);

    const res = await app.inject({
      method: "GET", url: "/api/batch/dashboard/summary",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(5);
    expect(body.success).toBe(3);
    expect(body.failed).toBe(1);
    expect(body.running).toBe(1);
    expect(body.pending).toBe(0);
    expect(body.successRate).toBe(60);
  });

  it("returns 403 for employee permission", async () => {
    const userId = await createUser(db, "emp@example.com");
    await seedUserTenantPermission(db, userId, 1, "employee");
    const empToken = await loginAs(app, "emp@example.com");

    const res = await app.inject({
      method: "GET", url: "/api/batch/dashboard/summary",
      cookies: { session: empToken },
      headers: { "x-tenant-id": "1", "x-permission": "employee" },
    });

    expect(res.statusCode).toBe(403);
  });

  it("scopes summary to the requesting tenant only", async () => {
    // 2 rows for tenant 1, 5 rows for tenant 2 — should only see tenant 1
    await seedBatchHistory(client, [
      { tenantId: 1, status: "S" },
      { tenantId: 1, status: "F" },
      { tenantId: 2, status: "S" },
      { tenantId: 2, status: "S" },
      { tenantId: 2, status: "S" },
      { tenantId: 2, status: "S" },
      { tenantId: 2, status: "S" },
    ]);

    const res = await app.inject({
      method: "GET", url: "/api/batch/dashboard/summary",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(2);
    expect(body.success).toBe(1);
    expect(body.failed).toBe(1);
  });

  it("returns zeros when the tenant has no batch history", async () => {
    const res = await app.inject({
      method: "GET", url: "/api/batch/dashboard/summary",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(0);
    expect(body.success).toBe(0);
    expect(body.successRate).toBe(0);
  });
});

// ── Cycle 5 — /trends dailyTrend ─────────────────────────────────────────────

describe("GET /api/batch/dashboard/trends", () => {
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

  it("returns dailyTrend grouped by batch_date in ascending order", async () => {
    await seedBatchHistory(client, [
      { tenantId: 1, status: "S", batchDate: "2026-07-01" },
      { tenantId: 1, status: "S", batchDate: "2026-07-01" },
      { tenantId: 1, status: "F", batchDate: "2026-07-01" },
      { tenantId: 1, status: "S", batchDate: "2026-07-02" },
    ]);

    const res = await app.inject({
      method: "GET", url: "/api/batch/dashboard/trends",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    const { dailyTrend } = res.json();
    expect(dailyTrend).toHaveLength(2);
    expect(dailyTrend[0].date).toContain("2026-07-01");
    expect(dailyTrend[0].total).toBe(3);
    expect(dailyTrend[0].success).toBe(2);
    expect(dailyTrend[0].failed).toBe(1);
    expect(dailyTrend[1].date).toContain("2026-07-02");
    expect(dailyTrend[1].total).toBe(1);
  });

  it("returns integrationDistribution grouped by integration_id", async () => {
    await seedBatchHistory(client, [
      { tenantId: 1, status: "S", integrationId: "JSM" },
      { tenantId: 1, status: "S", integrationId: "JSM" },
      { tenantId: 1, status: "F", integrationId: "SAP" },
    ]);

    const res = await app.inject({
      method: "GET", url: "/api/batch/dashboard/trends",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    const { integrationDistribution } = res.json();
    expect(integrationDistribution).toHaveLength(2);
    const jsm = integrationDistribution.find((r: { integrationId: string }) => r.integrationId === "JSM");
    const sap = integrationDistribution.find((r: { integrationId: string }) => r.integrationId === "SAP");
    expect(jsm.count).toBe(2);
    expect(sap.count).toBe(1);
  });

  it("scopes trends to the requesting tenant only", async () => {
    await seedBatchHistory(client, [
      { tenantId: 1, status: "S", batchDate: "2026-07-01" },
      { tenantId: 2, status: "S", batchDate: "2026-07-01" },
      { tenantId: 2, status: "S", batchDate: "2026-07-01" },
    ]);

    const res = await app.inject({
      method: "GET", url: "/api/batch/dashboard/trends",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    const { dailyTrend } = res.json();
    expect(dailyTrend).toHaveLength(1);
    expect(dailyTrend[0].total).toBe(1);
  });
});
