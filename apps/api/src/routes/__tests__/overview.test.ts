import { describe, it, expect, beforeEach, afterEach } from "vitest";
import bcrypt from "bcryptjs";
import { adminUsers, tenants, rolePermissions } from "@ops/db";
import { seedJsmRow } from "../../test-helpers/db.js";
import { buildApp } from "../../app.js";
import { createTestDb, seedDefaultPermissions, seedUserTenantPermission } from "../../test-helpers/db.js";

type Db = Awaited<ReturnType<typeof createTestDb>>["db"];

async function setupUser(db: Db, permission: "executive" | "it_manager" | "employee" = "it_manager") {
  const hash = await bcrypt.hash("password", 10);
  const [user] = await db
    .insert(adminUsers)
    .values({ email: "admin@example.com", passwordHash: hash })
    .returning({ id: adminUsers.id });
  await db.insert(tenants).values({ id: 1, name: "Acme Corp" });
  await seedUserTenantPermission(db, user.id, 1, permission);
  return user.id;
}

describe("GET /api/overview/stats — requirePermission", () => {
  let db: Db;
  let client: Awaited<ReturnType<typeof createTestDb>>["client"];
  let app: ReturnType<typeof buildApp>;
  let sessionToken: string;

  beforeEach(async () => {
    ({ db, client } = await createTestDb());
    app = buildApp(db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await client.close();
  });

  async function login() {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" },
    });
    return res.cookies.find((c) => c.name === "session")!.value;
  }

  it("returns 200 when the role has the permission enabled", async () => {
    await setupUser(db, "it_manager");
    await db.insert(rolePermissions).values({ role: "it_manager", permissionKey: "view_overview", enabled: true });
    sessionToken = await login();

    const res = await app.inject({
      method: "GET",
      url: "/api/overview/stats",
      cookies: { session: sessionToken },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("returns 403 when the role has the permission disabled", async () => {
    await setupUser(db, "it_manager");
    await db.insert(rolePermissions).values({ role: "it_manager", permissionKey: "view_overview", enabled: false });
    sessionToken = await login();

    const res = await app.inject({
      method: "GET",
      url: "/api/overview/stats",
      cookies: { session: sessionToken },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 200 when no permission entry exists (allow by default)", async () => {
    await setupUser(db, "it_manager");
    sessionToken = await login();

    const res = await app.inject({
      method: "GET",
      url: "/api/overview/stats",
      cookies: { session: sessionToken },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("returns 403 for executive when view_overview is disabled", async () => {
    await setupUser(db, "executive");
    await db.insert(rolePermissions).values({ role: "executive", permissionKey: "view_overview", enabled: false });
    sessionToken = await login();

    const res = await app.inject({
      method: "GET",
      url: "/api/overview/stats",
      cookies: { session: sessionToken },
      headers: { "x-tenant-id": "1", "x-permission": "executive" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 200 with full default permissions seeded for it_manager", async () => {
    await setupUser(db, "it_manager");
    await seedDefaultPermissions(db);
    sessionToken = await login();

    const res = await app.inject({
      method: "GET",
      url: "/api/overview/stats",
      cookies: { session: sessionToken },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("GET /api/overview/stats — data", () => {
  let db: Db;
  let client: Awaited<ReturnType<typeof createTestDb>>["client"];
  let app: ReturnType<typeof buildApp>;
  let sessionToken: string;

  const HEADERS = { "x-tenant-id": "1", "x-permission": "it_manager" };

  beforeEach(async () => {
    ({ db, client } = await createTestDb());
    app = buildApp(db);
    await app.ready();
    await setupUser(db, "it_manager");
    await seedDefaultPermissions(db);
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" },
    });
    sessionToken = res.cookies.find((c) => c.name === "session")!.value;
  });

  afterEach(async () => {
    await app.close();
    await client.close();
  });

  async function get() {
    return app.inject({
      method: "GET",
      url: "/api/overview/stats",
      cookies: { session: sessionToken },
      headers: HEADERS,
    });
  }

  it("returns slaComplianceRate based on is_ontime field", async () => {
    await seedJsmRow(db, { tenantId: 1, issueType: "SR", issueKey: "SR-1", isOntime: true, resolutionDate: new Date() });
    await seedJsmRow(db, { tenantId: 1, issueType: "SR", issueKey: "SR-2", isOntime: false, resolutionDate: new Date() });

    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.json().slaComplianceRate).toBeCloseTo(50);
  });

  it("returns open issue counts by type", async () => {
    await seedJsmRow(db, { tenantId: 1, issueType: "SR", issueKey: "SR-1", statusCategory: "In Progress" });
    await seedJsmRow(db, { tenantId: 1, issueType: "SR", issueKey: "SR-2", statusCategory: "In Progress" });
    await seedJsmRow(db, { tenantId: 1, issueType: "CR", issueKey: "CR-1", statusCategory: "To Do" });
    await seedJsmRow(db, { tenantId: 1, issueType: "OC", issueKey: "OC-1", statusCategory: "Done" });

    const body = (await get()).json();
    expect(body.openSR).toBe(2);
    expect(body.openCR).toBe(1);
    expect(body.openOC).toBe(0);
  });

  it("returns urgentOpen count", async () => {
    await seedJsmRow(db, { tenantId: 1, issueType: "SR", issueKey: "SR-1", urgencyYn: "Y", statusCategory: "In Progress" });
    await seedJsmRow(db, { tenantId: 1, issueType: "SR", issueKey: "SR-2", urgencyYn: "N", statusCategory: "In Progress" });

    const body = (await get()).json();
    expect(body.urgentOpen).toBe(1);
  });

  it("returns overdue count for open issues past their due date", async () => {
    const past = new Date("2020-01-01");
    const future = new Date("2099-01-01");
    await seedJsmRow(db, { tenantId: 1, issueType: "SR", issueKey: "SR-1", statusCategory: "In Progress", dueDate: past });
    await seedJsmRow(db, { tenantId: 1, issueType: "SR", issueKey: "SR-2", statusCategory: "In Progress", dueDate: future });

    const body = (await get()).json();
    expect(body.overdue).toBe(1);
  });

  it("returns avgResolutionDays", async () => {
    await seedJsmRow(db, { tenantId: 1, issueType: "SR", issueKey: "SR-1", totalLeadtime: 4, resolutionDate: new Date() });
    await seedJsmRow(db, { tenantId: 1, issueType: "SR", issueKey: "SR-2", totalLeadtime: 6, resolutionDate: new Date() });

    const body = (await get()).json();
    expect(body.avgResolutionDays).toBeCloseTo(5);
  });

  it("returns zeros when tenant has no data", async () => {
    const body = (await get()).json();
    expect(body.slaComplianceRate).toBe(0);
    expect(body.openSR).toBe(0);
    expect(body.urgentOpen).toBe(0);
    expect(body.overdue).toBe(0);
    expect(body.avgResolutionDays).toBe(0);
  });

  it("scopes data to the requesting tenant only", async () => {
    await seedJsmRow(db, { tenantId: 2, issueType: "SR", issueKey: "SR-99", statusCategory: "In Progress" });

    const body = (await get()).json();
    expect(body.openSR).toBe(0);
  });
});
