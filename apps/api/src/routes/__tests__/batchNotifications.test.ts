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

// ── Cycle 1 — Notification config list + create ───────────────────────────────

describe("GET /api/batch/notifications/config", () => {
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

  it("returns tenant-scoped notification configs", async () => {
    await client.exec(`
      INSERT INTO tb_notification_config (config_id, tenant_id, channel, config_json, enabled)
      VALUES (1, 1, 'email', '{"to":"ops@acme.com"}', true),
             (2, 2, 'slack', '{"webhook":"https://hooks.slack.com/..."}', true)
    `);

    const res = await app.inject({
      method: "GET", url: "/api/batch/notifications/config",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { configs: unknown[] };
    expect(body.configs).toHaveLength(1);
    const c = body.configs[0] as Record<string, unknown>;
    expect(c).toMatchObject({ configId: expect.any(Number), channel: "email", enabled: true });
  });

  it("creates a notification config for the tenant", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/batch/notifications/config",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
      payload: { channel: "slack", configJson: '{"webhook":"https://hooks.slack.com/test"}', enabled: true },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json() as { config: Record<string, unknown> };
    expect(body.config.channel).toBe("slack");
    expect(body.config.tenantId).toBe(1);
  });

  it("updates a notification config", async () => {
    await client.exec(`INSERT INTO tb_notification_config (config_id, tenant_id, channel, config_json, enabled) VALUES (5, 1, 'email', '{}', true)`);

    const res = await app.inject({
      method: "PUT", url: "/api/batch/notifications/config/5",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
      payload: { enabled: false },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { config: Record<string, unknown> };
    expect(body.config.enabled).toBe(false);
  });

  it("deletes a notification config", async () => {
    await client.exec(`INSERT INTO tb_notification_config (config_id, tenant_id, channel, config_json, enabled) VALUES (9, 1, 'webhook', '{}', true)`);

    const res = await app.inject({
      method: "DELETE", url: "/api/batch/notifications/config/9",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    expect((res.json() as Record<string, unknown>).ok).toBe(true);
  });
});

// ── Cycle 2 — Notification history ───────────────────────────────────────────

describe("GET /api/batch/notifications/history", () => {
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

  it("returns notification history for tenant configs", async () => {
    await client.exec(`INSERT INTO tb_notification_config (config_id, tenant_id, channel, config_json, enabled) VALUES (1, 1, 'email', '{}', true)`);
    await client.exec(`INSERT INTO tb_notification_history (history_id, config_id, status, message) VALUES (1, 1, 'sent', 'Delivered'), (2, 1, 'failed', 'SMTP error')`);

    const res = await app.inject({
      method: "GET", url: "/api/batch/notifications/history",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { history: unknown[] };
    expect(body.history).toHaveLength(2);
    const h = body.history[0] as Record<string, unknown>;
    expect(h).toMatchObject({ historyId: expect.any(Number), status: expect.any(String) });
  });
});
