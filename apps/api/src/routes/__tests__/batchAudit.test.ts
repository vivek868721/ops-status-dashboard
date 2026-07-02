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

async function seedAuditLog(client: Client, rows: { id: number; action: string; module: string; oldValue?: string; newValue?: string }[]) {
  for (const r of rows) {
    await client.exec(`
      INSERT INTO tb_audit_log (audit_id, action, module, old_value, new_value)
      VALUES (${r.id}, '${r.action}', '${r.module}', ${r.oldValue ? `'${r.oldValue}'` : "NULL"}, ${r.newValue ? `'${r.newValue}'` : "NULL"})
    `);
  }
}

// ── Cycle 1 — GET /api/batch/audit list ──────────────────────────────────────

describe("GET /api/batch/audit", () => {
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

  it("returns audit log list with correct shape", async () => {
    await seedAuditLog(client, [
      { id: 1, action: "UPDATE", module: "collector", oldValue: '{"active":"Y"}', newValue: '{"active":"N"}' },
      { id: 2, action: "CREATE", module: "parser" },
    ]);

    const res = await app.inject({
      method: "GET", url: "/api/batch/audit",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: unknown[]; total: number };
    expect(body.items).toHaveLength(2);
    expect(body.total).toBe(2);
    const item = body.items[0] as Record<string, unknown>;
    expect(item).toMatchObject({ auditId: expect.any(Number), action: expect.any(String), module: expect.any(String) });
  });

  it("filters by module", async () => {
    await seedAuditLog(client, [
      { id: 1, action: "UPDATE", module: "collector" },
      { id: 2, action: "CREATE", module: "parser" },
    ]);

    const res = await app.inject({
      method: "GET", url: "/api/batch/audit?module=collector",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    expect((res.json() as { total: number }).total).toBe(1);
  });

  it("filters by action", async () => {
    await seedAuditLog(client, [
      { id: 1, action: "UPDATE", module: "collector" },
      { id: 2, action: "CREATE", module: "parser" },
      { id: 3, action: "CREATE", module: "config" },
    ]);

    const res = await app.inject({
      method: "GET", url: "/api/batch/audit?action=CREATE",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    expect((res.json() as { total: number }).total).toBe(2);
  });
});

// ── Cycle 2 — GET /api/batch/audit/export CSV ─────────────────────────────────

describe("GET /api/batch/audit/export", () => {
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

  it("returns CSV with header and audit rows", async () => {
    await seedAuditLog(client, [{ id: 1, action: "UPDATE", module: "collector" }]);

    const res = await app.inject({
      method: "GET", url: "/api/batch/audit/export",
      cookies: { session: token },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.body).toContain("auditId,action,module");
    expect(res.body).toContain("UPDATE");
  });
});
