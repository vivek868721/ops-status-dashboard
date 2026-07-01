import { describe, it, expect, beforeEach, afterEach } from "vitest";
import bcrypt from "bcryptjs";
import { adminUsers, tenants, tbAuditLog, tbNotificationConfig, tbNotificationHistory, tbJobExecutionAudit } from "@ops/db";
import { buildApp } from "../../app.js";
import { createTestDb, seedDefaultPermissions, seedUserTenantPermission } from "../../test-helpers/db.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireTenantAccess } from "../../middleware/tenant.js";
import { requirePermission } from "../../middleware/permission.js";
import { sql } from "drizzle-orm";

type Db = Awaited<ReturnType<typeof createTestDb>>["db"];

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createUser(db: Db, email = "user@example.com", role?: "super_admin") {
  const hash = await bcrypt.hash("password", 10);
  const [u] = await db.insert(adminUsers).values({ email, passwordHash: hash, role: role ?? null }).returning({ id: adminUsers.id });
  return u.id;
}

async function loginAs(app: ReturnType<typeof buildApp>, email: string) {
  const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password: "password" } });
  return res.cookies.find((c) => c.name === "session")!.value;
}

// ── Cycle 1 — tb_audit_log ────────────────────────────────────────────────────

describe("tb_audit_log", () => {
  let db: Db;
  let client: Awaited<ReturnType<typeof createTestDb>>["client"];

  beforeEach(async () => { ({ db, client } = await createTestDb()); });
  afterEach(async () => { await client.close(); });

  it("accepts an audit row and returns it", async () => {
    const [row] = await db.insert(tbAuditLog).values({
      action: "LOGIN",
      module: "auth",
    }).returning();

    expect(row.auditId).toBeGreaterThan(0);
    expect(row.action).toBe("LOGIN");
    expect(row.module).toBe("auth");
    expect(row.oldValue).toBeNull();
    expect(row.newValue).toBeNull();
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it("stores old_value and new_value as JSON strings", async () => {
    const [row] = await db.insert(tbAuditLog).values({
      action: "UPDATE_CONFIG",
      module: "batch_config",
      oldValue: JSON.stringify({ url: "http://old.example.com" }),
      newValue: JSON.stringify({ url: "http://new.example.com" }),
    }).returning();

    expect(JSON.parse(row.oldValue!)).toMatchObject({ url: "http://old.example.com" });
    expect(JSON.parse(row.newValue!)).toMatchObject({ url: "http://new.example.com" });
  });
});

// ── Cycle 2 — tb_notification_config ─────────────────────────────────────────

describe("tb_notification_config", () => {
  let db: Db;
  let client: Awaited<ReturnType<typeof createTestDb>>["client"];

  beforeEach(async () => { ({ db, client } = await createTestDb()); });
  afterEach(async () => { await client.close(); });

  it("accepts a notification config row", async () => {
    const [row] = await db.insert(tbNotificationConfig).values({
      tenantId: 1,
      channel: "slack",
      configJson: JSON.stringify({ webhookUrl: "https://hooks.slack.com/test" }),
      enabled: true,
    }).returning();

    expect(row.configId).toBeGreaterThan(0);
    expect(row.channel).toBe("slack");
    expect(row.enabled).toBe(true);
  });
});

// ── Cycle 3 — tb_notification_history ────────────────────────────────────────

describe("tb_notification_history", () => {
  let db: Db;
  let client: Awaited<ReturnType<typeof createTestDb>>["client"];

  beforeEach(async () => { ({ db, client } = await createTestDb()); });
  afterEach(async () => { await client.close(); });

  it("accepts a history row linked to a config", async () => {
    const [config] = await db.insert(tbNotificationConfig).values({
      tenantId: 1,
      channel: "webhook",
      configJson: "{}",
      enabled: true,
    }).returning({ configId: tbNotificationConfig.configId });

    const [row] = await db.insert(tbNotificationHistory).values({
      configId: config.configId,
      status: "sent",
      message: "Job failure alert delivered",
    }).returning();

    expect(row.historyId).toBeGreaterThan(0);
    expect(row.configId).toBe(config.configId);
    expect(row.status).toBe("sent");
  });
});

// ── Cycle 4 — tb_job_execution_audit ─────────────────────────────────────────

describe("tb_job_execution_audit", () => {
  let db: Db;
  let client: Awaited<ReturnType<typeof createTestDb>>["client"];

  beforeEach(async () => { ({ db, client } = await createTestDb()); });
  afterEach(async () => { await client.close(); });

  it("accepts a manual execution audit row", async () => {
    const [row] = await db.insert(tbJobExecutionAudit).values({
      collectorId: 42,
      triggerType: "manual",
      status: "R",
    }).returning();

    expect(row.auditId).toBeGreaterThan(0);
    expect(row.collectorId).toBe(42);
    expect(row.triggerType).toBe("manual");
    expect(row.status).toBe("R");
    expect(row.endedAt).toBeNull();
  });

  it("can record completion with end time and final status", async () => {
    const [started] = await db.insert(tbJobExecutionAudit).values({
      collectorId: 7,
      triggerType: "retry",
      status: "R",
    }).returning();

    const endTime = new Date();
    const [finished] = await db
      .update(tbJobExecutionAudit)
      .set({ status: "S", endedAt: endTime })
      .where(sql`audit_id = ${started.auditId}`)
      .returning();

    expect(finished.status).toBe("S");
    expect(finished.endedAt).toBeInstanceOf(Date);
  });
});

// ── Cycle 5 — Read-only batch tables in PGlite ───────────────────────────────

describe("read-only batch tables in PGlite", () => {
  let db: Db;
  let client: Awaited<ReturnType<typeof createTestDb>>["client"];

  beforeEach(async () => { ({ db, client } = await createTestDb()); });
  afterEach(async () => { await client.close(); });

  it("tb_batch_history can be seeded and queried", async () => {
    await client.exec(`
      INSERT INTO tb_batch_history (batch_date, integration_id, tenant_id, collector_id, crawling_status)
      VALUES ('2026-07-01', 'JSM', 1, 10, 'S')
    `);
    const result = await client.query("SELECT * FROM tb_batch_history WHERE tenant_id = 1");
    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as Record<string, unknown>).crawling_status).toBe("S");
  });

  it("tb_integration_collector can be seeded and queried", async () => {
    await client.exec(`
      INSERT INTO tb_integration_collector (job_name, cron_schedule, integration_id, tenant_id, active_yn)
      VALUES ('jsmCollector', '0 * * * *', 'JSM', 1, 'Y')
    `);
    const result = await client.query("SELECT * FROM tb_integration_collector WHERE tenant_id = 1");
    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as Record<string, unknown>).job_name).toBe("jsmCollector");
  });

  it("tb_raw_data can be seeded and queried", async () => {
    await client.exec(`
      INSERT INTO tb_raw_data (batch_date, integration_id, tenant_id, collector_id, parse_yn, data)
      VALUES ('2026-07-01', 'JSM', 1, 10, 'N', '{"items":[]}')
    `);
    const result = await client.query("SELECT * FROM tb_raw_data WHERE tenant_id = 1");
    expect(result.rows).toHaveLength(1);
  });
});

// ── Cycle 6 — Batch permission keys seeded correctly ─────────────────────────

describe("seedDefaultPermissions — batch keys", () => {
  let db: Db;
  let client: Awaited<ReturnType<typeof createTestDb>>["client"];

  beforeEach(async () => { ({ db, client } = await createTestDb()); await seedDefaultPermissions(db); });
  afterEach(async () => { await client.close(); });

  it("batch_view_dashboard: it_manager=true, executive=true, employee=false", async () => {
    const rows = await client.query(
      "SELECT role, enabled FROM role_permissions WHERE permission_key = 'batch_view_dashboard' ORDER BY role"
    );
    const map = Object.fromEntries((rows.rows as { role: string; enabled: boolean }[]).map(r => [r.role, r.enabled]));
    expect(map["it_manager"]).toBe(true);
    expect(map["executive"]).toBe(true);
    expect(map["employee"]).toBe(false);
  });

  it("batch_manage_jobs: it_manager=true, executive=false, employee=false", async () => {
    const rows = await client.query(
      "SELECT role, enabled FROM role_permissions WHERE permission_key = 'batch_manage_jobs' ORDER BY role"
    );
    const map = Object.fromEntries((rows.rows as { role: string; enabled: boolean }[]).map(r => [r.role, r.enabled]));
    expect(map["it_manager"]).toBe(true);
    expect(map["executive"]).toBe(false);
    expect(map["employee"]).toBe(false);
  });
});

// ── Cycle 7 — Batch permission enforcement via middleware ─────────────────────

describe("batch permission enforcement", () => {
  let db: Db;
  let client: Awaited<ReturnType<typeof createTestDb>>["client"];
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    ({ db, client } = await createTestDb());
    app = buildApp(db);

    // Test-only routes to exercise batch permission middleware
    app.get("/api/batch/test-dashboard", {
      preHandler: [requireAuth, requireTenantAccess, requirePermission("batch_view_dashboard")],
    }, async () => ({ ok: true }));

    app.get("/api/batch/test-jobs", {
      preHandler: [requireAuth, requireTenantAccess, requirePermission("batch_manage_jobs")],
    }, async () => ({ ok: true }));

    await app.ready();
    await db.insert(tenants).values({ id: 1, name: "Acme" });
    await seedDefaultPermissions(db);
  });

  afterEach(async () => { await app.close(); await client.close(); });

  it("batch_view_dashboard: it_manager gets 200", async () => {
    const userId = await createUser(db, "mgr@example.com");
    await seedUserTenantPermission(db, userId, 1, "it_manager");
    const token = await loginAs(app, "mgr@example.com");

    const res = await app.inject({
      method: "GET", url: "/api/batch/test-dashboard",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("batch_view_dashboard: executive gets 200", async () => {
    const userId = await createUser(db, "exec@example.com");
    await seedUserTenantPermission(db, userId, 1, "executive");
    const token = await loginAs(app, "exec@example.com");

    const res = await app.inject({
      method: "GET", url: "/api/batch/test-dashboard",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "executive" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("batch_view_dashboard: employee gets 403", async () => {
    const userId = await createUser(db, "emp@example.com");
    await seedUserTenantPermission(db, userId, 1, "employee");
    const token = await loginAs(app, "emp@example.com");

    const res = await app.inject({
      method: "GET", url: "/api/batch/test-dashboard",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "employee" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("batch_manage_jobs: it_manager gets 200", async () => {
    const userId = await createUser(db, "mgr2@example.com");
    await seedUserTenantPermission(db, userId, 1, "it_manager");
    const token = await loginAs(app, "mgr2@example.com");

    const res = await app.inject({
      method: "GET", url: "/api/batch/test-jobs",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("batch_manage_jobs: executive gets 403", async () => {
    const userId = await createUser(db, "exec2@example.com");
    await seedUserTenantPermission(db, userId, 1, "executive");
    const token = await loginAs(app, "exec2@example.com");

    const res = await app.inject({
      method: "GET", url: "/api/batch/test-jobs",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "executive" },
    });
    expect(res.statusCode).toBe(403);
  });
});
