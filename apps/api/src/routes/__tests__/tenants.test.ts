import { describe, it, expect, beforeEach, afterEach } from "vitest";
import bcrypt from "bcryptjs";
import { adminUsers, tenants, userTenantRoles, userPermissions } from "@ops/db";
import { buildApp } from "../../app.js";
import { createTestDb, seedUserTenantPermission } from "../../test-helpers/db.js";

async function setupUser(db: Awaited<ReturnType<typeof createTestDb>>["db"], isSuperAdmin = false) {
  const hash = await bcrypt.hash("password", 10);
  const [user] = await db
    .insert(adminUsers)
    .values({ email: "admin@example.com", passwordHash: hash, role: isSuperAdmin ? "super_admin" : null })
    .returning({ id: adminUsers.id });
  return user.id;
}

describe("GET /api/tenants", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>["db"];
  let client: Awaited<ReturnType<typeof createTestDb>>["client"];
  let app: ReturnType<typeof buildApp>;
  let sessionToken: string;
  let userId: number;

  beforeEach(async () => {
    ({ db, client } = await createTestDb());
    app = buildApp(db);
    await app.ready();

    userId = await setupUser(db);

    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" },
    });
    sessionToken = loginRes.cookies.find((c) => c.name === "session")!.value;
  });

  afterEach(async () => {
    await app.close();
    await client.close();
  });

  it("returns 401 without a session cookie", async () => {
    const res = await app.inject({ method: "GET", url: "/api/tenants" });
    expect(res.statusCode).toBe(401);
  });

  it("returns empty array when user has no tenant assignments", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/tenants",
      cookies: { session: sessionToken },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("returns tenant list with systemRole for an authenticated user", async () => {
    await db.insert(tenants).values({ id: 1, name: "Acme Corp" });
    await db.insert(userTenantRoles).values({ userId, tenantId: 1, systemRole: "operator" });

    const res = await app.inject({
      method: "GET",
      url: "/api/tenants",
      cookies: { session: sessionToken },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{ tenantId: 1, name: "Acme Corp", systemRole: "operator" }]);
  });

  it("super_admin sees all tenants", async () => {
    // userId was already created as admin@example.com (regular user) in beforeEach
    await db.insert(adminUsers).values({ email: "sa@example.com", passwordHash: await bcrypt.hash("password", 10), role: "super_admin" });
    await db.insert(tenants).values([{ id: 1, name: "Acme" }, { id: 2, name: "Globex" }]);

    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "sa@example.com", password: "password" },
    });
    const saToken = loginRes.cookies.find((c) => c.name === "session")!.value;

    const res = await app.inject({
      method: "GET",
      url: "/api/tenants",
      cookies: { session: saToken },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(2);
    expect(res.json()[0]).toMatchObject({ systemRole: "super_admin" });
  });
});

describe("GET /api/user/permissions", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>["db"];
  let client: Awaited<ReturnType<typeof createTestDb>>["client"];
  let app: ReturnType<typeof buildApp>;
  let sessionToken: string;
  let userId: number;

  beforeEach(async () => {
    ({ db, client } = await createTestDb());
    app = buildApp(db);
    await app.ready();
    userId = await setupUser(db);
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" },
    });
    sessionToken = loginRes.cookies.find((c) => c.name === "session")!.value;
  });

  afterEach(async () => {
    await app.close();
    await client.close();
  });

  it("returns empty array when user has no permissions", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/user/permissions",
      cookies: { session: sessionToken },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("returns assigned permissions for user", async () => {
    await db.insert(userPermissions).values([
      { userId, permission: "it_manager" },
      { userId, permission: "executive" },
    ]);
    const res = await app.inject({
      method: "GET",
      url: "/api/user/permissions",
      cookies: { session: sessionToken },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(expect.arrayContaining(["it_manager", "executive"]));
  });

  it("super_admin always gets all three permissions", async () => {
    await db.insert(adminUsers).values({ email: "sa@example.com", passwordHash: await bcrypt.hash("password", 10), role: "super_admin" });
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "sa@example.com", password: "password" },
    });
    const saToken = loginRes.cookies.find((c) => c.name === "session")!.value;

    const res = await app.inject({
      method: "GET",
      url: "/api/user/permissions",
      cookies: { session: saToken },
    });
    expect(res.json()).toEqual(expect.arrayContaining(["executive", "it_manager", "employee"]));
  });
});

describe("GET /api/tenant/current (requireTenantAccess)", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>["db"];
  let client: Awaited<ReturnType<typeof createTestDb>>["client"];
  let app: ReturnType<typeof buildApp>;
  let sessionToken: string;
  let userId: number;

  beforeEach(async () => {
    ({ db, client } = await createTestDb());
    app = buildApp(db);
    await app.ready();
    userId = await setupUser(db);
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" },
    });
    sessionToken = loginRes.cookies.find((c) => c.name === "session")!.value;
  });

  afterEach(async () => {
    await app.close();
    await client.close();
  });

  it("returns tenant context when user has membership and permission", async () => {
    await db.insert(tenants).values({ id: 42, name: "Wayne Enterprises" });
    await seedUserTenantPermission(db, userId, 42, "executive", "operator");

    const res = await app.inject({
      method: "GET",
      url: "/api/tenant/current",
      cookies: { session: sessionToken },
      headers: { "x-tenant-id": "42", "x-permission": "executive" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ tenantId: 42, role: "executive", systemRole: "operator" });
  });

  it("returns 400 when X-Tenant-Id header is missing", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/tenant/current",
      cookies: { session: sessionToken },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when X-Permission header is missing", async () => {
    await db.insert(tenants).values({ id: 1, name: "Acme" });
    await db.insert(userTenantRoles).values({ userId, tenantId: 1, systemRole: "member" });

    const res = await app.inject({
      method: "GET",
      url: "/api/tenant/current",
      cookies: { session: sessionToken },
      headers: { "x-tenant-id": "1" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 403 when user has no membership for the tenant", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/tenant/current",
      cookies: { session: sessionToken },
      headers: { "x-tenant-id": "99", "x-permission": "it_manager" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 403 when user does not have the requested permission", async () => {
    await db.insert(tenants).values({ id: 1, name: "Acme" });
    await db.insert(userTenantRoles).values({ userId, tenantId: 1, systemRole: "member" });
    await db.insert(userPermissions).values({ userId, permission: "executive" });

    const res = await app.inject({
      method: "GET",
      url: "/api/tenant/current",
      cookies: { session: sessionToken },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("attaches correct context for different tenant+permission combos", async () => {
    await db.insert(tenants).values([
      { id: 1, name: "Tenant A" },
      { id: 2, name: "Tenant B" },
    ]);
    await seedUserTenantPermission(db, userId, 1, "it_manager", "tenant_admin");
    await seedUserTenantPermission(db, userId, 2, "employee", "member");

    const resA = await app.inject({
      method: "GET",
      url: "/api/tenant/current",
      cookies: { session: sessionToken },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });
    expect(resA.json()).toMatchObject({ tenantId: 1, role: "it_manager", systemRole: "tenant_admin" });

    const resB = await app.inject({
      method: "GET",
      url: "/api/tenant/current",
      cookies: { session: sessionToken },
      headers: { "x-tenant-id": "2", "x-permission": "employee" },
    });
    expect(resB.json()).toMatchObject({ tenantId: 2, role: "employee", systemRole: "member" });
  });
});
