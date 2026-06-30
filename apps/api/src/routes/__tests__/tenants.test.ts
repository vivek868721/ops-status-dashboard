import { describe, it, expect, beforeEach, afterEach } from "vitest";
import bcrypt from "bcryptjs";
import { adminUsers, tenants, userTenantRoles } from "@ops/db";
import { buildApp } from "../../app.js";
import { createTestDb } from "../../test-helpers/db.js";

async function setupUser(db: Awaited<ReturnType<typeof createTestDb>>["db"]) {
  const hash = await bcrypt.hash("password", 10);
  const [user] = await db
    .insert(adminUsers)
    .values({ email: "admin@example.com", passwordHash: hash })
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

  it("returns an empty array when the user has no tenant assignments", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/tenants",
      cookies: { session: sessionToken },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("returns tenant list for an authenticated user", async () => {
    await db.insert(tenants).values({ id: 1, name: "Acme Corp" });
    await db.insert(userTenantRoles).values({ userId, tenantId: 1, role: "it_manager" });

    const res = await app.inject({
      method: "GET",
      url: "/api/tenants",
      cookies: { session: sessionToken },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{ tenantId: 1, name: "Acme Corp", role: "it_manager" }]);
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

  it("returns tenant context when user is authorized for the requested tenant", async () => {
    await db.insert(tenants).values({ id: 42, name: "Wayne Enterprises" });
    await db.insert(userTenantRoles).values({ userId, tenantId: 42, role: "executive" });

    const res = await app.inject({
      method: "GET",
      url: "/api/tenant/current",
      cookies: { session: sessionToken },
      headers: { "x-tenant-id": "42" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ tenantId: 42, role: "executive" });
  });

  it("returns 400 when X-Tenant-Id header is missing", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/tenant/current",
      cookies: { session: sessionToken },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 403 when user has no role for the requested tenant", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/tenant/current",
      cookies: { session: sessionToken },
      headers: { "x-tenant-id": "99" },
    });

    expect(res.statusCode).toBe(403);
  });

  it("attaches the correct role when the user has multiple tenant assignments", async () => {
    await db.insert(tenants).values([
      { id: 1, name: "Tenant A" },
      { id: 2, name: "Tenant B" },
    ]);
    await db.insert(userTenantRoles).values([
      { userId, tenantId: 1, role: "it_manager" },
      { userId, tenantId: 2, role: "employee" },
    ]);

    const resA = await app.inject({
      method: "GET",
      url: "/api/tenant/current",
      cookies: { session: sessionToken },
      headers: { "x-tenant-id": "1" },
    });
    expect(resA.json()).toMatchObject({ tenantId: 1, role: "it_manager" });

    const resB = await app.inject({
      method: "GET",
      url: "/api/tenant/current",
      cookies: { session: sessionToken },
      headers: { "x-tenant-id": "2" },
    });
    expect(resB.json()).toMatchObject({ tenantId: 2, role: "employee" });
  });
});
