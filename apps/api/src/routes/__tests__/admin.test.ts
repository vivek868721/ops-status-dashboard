import { describe, it, expect, beforeEach, afterEach } from "vitest";
import bcrypt from "bcryptjs";
import { adminUsers, tenants, userTenantRoles } from "@ops/db";
import { buildApp } from "../../app.js";
import { createTestDb } from "../../test-helpers/db.js";

type Db = Awaited<ReturnType<typeof createTestDb>>["db"];

async function createUser(db: Db, email: string, isSuperAdmin = false) {
  const hash = await bcrypt.hash("password", 10);
  const [user] = await db
    .insert(adminUsers)
    .values({ email, passwordHash: hash, role: isSuperAdmin ? "super_admin" : null })
    .returning({ id: adminUsers.id });
  return user.id;
}

async function login(app: ReturnType<typeof buildApp>, email: string) {
  const r = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "password" },
  });
  return r.cookies.find((c) => c.name === "session")!.value;
}

describe("Super-Admin API", () => {
  let db: Db;
  let client: Awaited<ReturnType<typeof createTestDb>>["client"];
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    ({ db, client } = await createTestDb());
    app = buildApp(db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await client.close();
  });

  describe("requireSuperAdmin middleware", () => {
    it("returns 403 for a regular user accessing admin routes", async () => {
      await createUser(db, "regular@example.com", false);
      const token = await login(app, "regular@example.com");

      const res = await app.inject({
        method: "GET",
        url: "/api/admin/tenants",
        cookies: { session: token },
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 200 for a super_admin user", async () => {
      await createUser(db, "admin@example.com", true);
      const token = await login(app, "admin@example.com");

      const res = await app.inject({
        method: "GET",
        url: "/api/admin/tenants",
        cookies: { session: token },
      });
      expect(res.statusCode).toBe(200);
    });

    it("returns 401 for unauthenticated request", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/admin/tenants",
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("Tenant management", () => {
    let adminToken: string;

    beforeEach(async () => {
      await createUser(db, "admin@example.com", true);
      adminToken = await login(app, "admin@example.com");
    });

    it("POST /api/admin/tenants creates a new tenant", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/admin/tenants",
        cookies: { session: adminToken },
        payload: { id: 42, name: "Test Corp" },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ id: 42, name: "Test Corp" });
    });

    it("GET /api/admin/tenants returns all tenants", async () => {
      await db.insert(tenants).values([
        { id: 1, name: "Acme" },
        { id: 2, name: "Globex" },
      ]);

      const res = await app.inject({
        method: "GET",
        url: "/api/admin/tenants",
        cookies: { session: adminToken },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(2);
    });

    it("DELETE /api/admin/tenants/:id removes a tenant", async () => {
      await db.insert(tenants).values({ id: 1, name: "Acme" });

      const res = await app.inject({
        method: "DELETE",
        url: "/api/admin/tenants/1",
        cookies: { session: adminToken },
      });
      expect(res.statusCode).toBe(204);

      const listRes = await app.inject({
        method: "GET",
        url: "/api/admin/tenants",
        cookies: { session: adminToken },
      });
      expect(listRes.json()).toHaveLength(0);
    });
  });

  describe("User management", () => {
    let adminToken: string;

    beforeEach(async () => {
      await createUser(db, "admin@example.com", true);
      adminToken = await login(app, "admin@example.com");
    });

    it("POST /api/admin/users creates a new user", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/admin/users",
        cookies: { session: adminToken },
        payload: { email: "new@example.com", password: "secret123" },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ email: "new@example.com" });
      expect(res.json().passwordHash).toBeUndefined();
    });

    it("GET /api/admin/users returns all users without password hashes", async () => {
      await createUser(db, "other@example.com");

      const res = await app.inject({
        method: "GET",
        url: "/api/admin/users",
        cookies: { session: adminToken },
      });
      expect(res.statusCode).toBe(200);
      const users = res.json();
      expect(users.length).toBeGreaterThanOrEqual(1);
      users.forEach((u: Record<string, unknown>) => expect(u.passwordHash).toBeUndefined());
    });

    it("DELETE /api/admin/users/:id removes a user", async () => {
      const userId = await createUser(db, "target@example.com");

      const res = await app.inject({
        method: "DELETE",
        url: `/api/admin/users/${userId}`,
        cookies: { session: adminToken },
      });
      expect(res.statusCode).toBe(204);
    });
  });

  describe("User-Tenant role assignments", () => {
    let adminToken: string;
    let userId: number;

    beforeEach(async () => {
      await createUser(db, "admin@example.com", true);
      adminToken = await login(app, "admin@example.com");
      userId = await createUser(db, "user@example.com");
      await db.insert(tenants).values({ id: 1, name: "Acme" });
    });

    it("POST /api/admin/user-tenant-roles assigns a role", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/admin/user-tenant-roles",
        cookies: { session: adminToken },
        payload: { userId, tenantId: 1, role: "it_manager" },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ userId, tenantId: 1, role: "it_manager" });
    });

    it("GET /api/admin/user-tenant-roles returns all assignments", async () => {
      await db.insert(userTenantRoles).values({ userId, tenantId: 1, role: "employee" });

      const res = await app.inject({
        method: "GET",
        url: "/api/admin/user-tenant-roles",
        cookies: { session: adminToken },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(1);
    });

    it("DELETE /api/admin/user-tenant-roles/:id removes an assignment", async () => {
      const [row] = await db
        .insert(userTenantRoles)
        .values({ userId, tenantId: 1, role: "employee" })
        .returning({ id: userTenantRoles.id });

      const res = await app.inject({
        method: "DELETE",
        url: `/api/admin/user-tenant-roles/${row.id}`,
        cookies: { session: adminToken },
      });
      expect(res.statusCode).toBe(204);
    });
  });
});
