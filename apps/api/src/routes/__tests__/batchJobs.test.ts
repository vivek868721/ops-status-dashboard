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

async function seedCollectors(client: Client, rows: { collectorId: number; jobName: string; tenantId: number; cronSchedule?: string; integrationId?: string; activeYn?: string }[]) {
  for (const r of rows) {
    await client.exec(`
      INSERT INTO tb_integration_collector (collector_id, job_name, cron_schedule, integration_id, tenant_id, active_yn)
      VALUES (${r.collectorId}, '${r.jobName}', '${r.cronSchedule ?? "0 * * * *"}', '${r.integrationId ?? "JSM"}', ${r.tenantId}, '${r.activeYn ?? "Y"}')
    `);
  }
}

// ── Cycle 3 — run / stop / retry create tb_job_execution_audit rows ──────────

describe("POST /api/batch/jobs/:id/run|stop|retry", () => {
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

  it("run creates an audit row with trigger_type=manual and status=TRIGGERED", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/batch/jobs/5/run",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    const [auditResult] = await client.exec("SELECT * FROM tb_job_execution_audit");
    expect(auditResult.rows).toHaveLength(1);
    expect(auditResult.rows[0]).toMatchObject({ collector_id: 5, trigger_type: "manual", status: "TRIGGERED" });
  });

  it("stop creates an audit row with status=STOPPED", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/batch/jobs/5/stop",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    const [auditResult] = await client.exec("SELECT * FROM tb_job_execution_audit");
    expect(auditResult.rows).toHaveLength(1);
    expect(auditResult.rows[0]).toMatchObject({ collector_id: 5, status: "STOPPED" });
  });

  it("retry creates an audit row with trigger_type=retry", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/batch/jobs/5/retry",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    const [auditResult] = await client.exec("SELECT * FROM tb_job_execution_audit");
    expect(auditResult.rows).toHaveLength(1);
    expect(auditResult.rows[0]).toMatchObject({ collector_id: 5, trigger_type: "retry", status: "TRIGGERED" });
  });
});

// ── Cycle 2 — PUT /api/batch/jobs/:id updates job fields ─────────────────────

describe("PUT /api/batch/jobs/:id", () => {
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

  it("updates cron_schedule and active_yn for the tenant's job", async () => {
    await seedCollectors(client, [
      { collectorId: 1, jobName: "JSM_Acme", tenantId: 1, cronSchedule: "0 * * * *", activeYn: "Y" },
    ]);

    const res = await app.inject({
      method: "PUT", url: "/api/batch/jobs/1",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
      payload: { cronSchedule: "0 6 * * *", activeYn: "N" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { job: Record<string, unknown> };
    expect(body.job.cronSchedule).toBe("0 6 * * *");
    expect(body.job.activeYn).toBe("N");
  });

  it("returns 403 for executive (cannot manage jobs)", async () => {
    await db.insert(tenants).values({ id: 2, name: "ExecCo" });
    const userId = await createUser(db, "exec@example.com");
    await seedUserTenantPermission(db, userId, 2, "executive");
    const execToken = await loginAs(app, "exec@example.com");

    const res = await app.inject({
      method: "PUT", url: "/api/batch/jobs/1",
      cookies: { session: execToken },
      headers: { "x-tenant-id": "2", "x-permission": "executive" },
      payload: { activeYn: "N" },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ── Cycle 1 — GET /api/batch/jobs returns tenant-scoped list ─────────────────

describe("GET /api/batch/jobs", () => {
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

  it("returns tenant-scoped job list with correct shape", async () => {
    await seedCollectors(client, [
      { collectorId: 1, jobName: "JSM_Acme", tenantId: 1, cronSchedule: "0 * * * *", integrationId: "JSM", activeYn: "Y" },
      { collectorId: 2, jobName: "SAP_Acme", tenantId: 1, cronSchedule: "0 2 * * *", integrationId: "SAP", activeYn: "N" },
      { collectorId: 3, jobName: "JSM_Other", tenantId: 2, cronSchedule: "0 * * * *", integrationId: "JSM", activeYn: "Y" },
    ]);

    const res = await app.inject({
      method: "GET", url: "/api/batch/jobs",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { jobs: unknown[] };
    expect(body.jobs).toHaveLength(2);
    const job = body.jobs[0] as Record<string, unknown>;
    expect(job).toMatchObject({ collectorId: 1, jobName: "JSM_Acme", cronSchedule: "0 * * * *", integrationId: "JSM", activeYn: "Y" });
  });

  it("returns 401 without session", async () => {
    const res = await app.inject({
      method: "GET", url: "/api/batch/jobs",
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 for employee", async () => {
    const userId = await createUser(db, "emp@example.com");
    await seedUserTenantPermission(db, userId, 1, "employee");
    const empToken = await loginAs(app, "emp@example.com");

    const res = await app.inject({
      method: "GET", url: "/api/batch/jobs",
      cookies: { session: empToken },
      headers: { "x-tenant-id": "1", "x-permission": "employee" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("allows executive to view jobs (read-only)", async () => {
    await db.insert(tenants).values({ id: 3, name: "ExecCo" });
    const userId = await createUser(db, "exec@example.com");
    await seedUserTenantPermission(db, userId, 3, "executive");

    const execToken = await loginAs(app, "exec@example.com");
    await seedCollectors(client, [
      { collectorId: 10, jobName: "JSM_Exec", tenantId: 3 },
    ]);

    const res = await app.inject({
      method: "GET", url: "/api/batch/jobs",
      cookies: { session: execToken },
      headers: { "x-tenant-id": "3", "x-permission": "executive" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { jobs: unknown[] };
    expect(body.jobs).toHaveLength(1);
  });
});
