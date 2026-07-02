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

// ── Cycle 1 — GET /api/system/health ─────────────────────────────────────────

describe("GET /api/system/health", () => {
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

  it("returns health status with db connectivity", async () => {
    const res = await app.inject({
      method: "GET", url: "/api/system/health",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body).toMatchObject({
      status: "ok",
      db: expect.objectContaining({ connected: true }),
      checkedAt: expect.any(String),
    });
  });

  it("returns 403 for executive permission", async () => {
    const execId = await createUser(db, "exec@example.com");
    await seedUserTenantPermission(db, execId, 1, "executive");
    const execToken = await loginAs(app, "exec@example.com");

    const res = await app.inject({
      method: "GET", url: "/api/system/health",
      cookies: { session: execToken },
      headers: { "x-tenant-id": "1", "x-permission": "executive" },
    });

    expect(res.statusCode).toBe(403);
  });
});

// ── Cycle 2 — GET /api/system/scheduler ──────────────────────────────────────

describe("GET /api/system/scheduler", () => {
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

  it("returns scheduler status with next runs for active collectors", async () => {
    await client.exec(`
      INSERT INTO tb_integration_collector (collector_id, job_name, cron_schedule, integration_id, tenant_id, active_yn)
      VALUES (1, 'JSM_Job', '0 * * * *', 'JSM', 1, 'Y'),
             (2, 'SAP_Job', '0 */2 * * *', 'SAP', 1, 'Y'),
             (3, 'Inactive', '0 * * * *', 'JSM', 1, 'N')
    `);

    const res = await app.inject({
      method: "GET", url: "/api/system/scheduler",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { status: string; nextRuns: unknown[] };
    expect(body.status).toBe("active");
    // Only active collectors, max 5
    expect(body.nextRuns.length).toBeGreaterThan(0);
    expect(body.nextRuns.length).toBeLessThanOrEqual(5);
    const run = body.nextRuns[0] as Record<string, unknown>;
    expect(run).toMatchObject({
      jobName: expect.any(String),
      cronSchedule: expect.any(String),
      nextRunAt: expect.any(String),
    });
  });
});
