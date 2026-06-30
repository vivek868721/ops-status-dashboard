import { describe, it, expect, beforeEach, afterEach } from "vitest";
import bcrypt from "bcryptjs";
import { adminUsers, tenants, userTenantRoles } from "@ops/db";
import { buildApp } from "../../app.js";
import { createTestDb, seedDefaultPermissions, seedJsmRow } from "../../test-helpers/db.js";

type Db = Awaited<ReturnType<typeof createTestDb>>["db"];

async function setup(db: Db, role: "it_manager" | "employee" = "it_manager") {
  const hash = await bcrypt.hash("password", 10);
  const [user] = await db
    .insert(adminUsers)
    .values({ email: "user@example.com", passwordHash: hash })
    .returning({ id: adminUsers.id });
  await db.insert(tenants).values({ id: 1, name: "Acme" });
  await db.insert(userTenantRoles).values({ userId: user.id, tenantId: 1, role });
  await seedDefaultPermissions(db);
  return user.id;
}

describe("GET /api/service-requests", () => {
  let db: Db;
  let client: Awaited<ReturnType<typeof createTestDb>>["client"];
  let app: ReturnType<typeof buildApp>;
  let sessionToken: string;
  let userId: number;

  beforeEach(async () => {
    ({ db, client } = await createTestDb());
    app = buildApp(db);
    await app.ready();
    userId = await setup(db);
    const r = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "user@example.com", password: "password" },
    });
    sessionToken = r.cookies.find((c) => c.name === "session")!.value;
  });

  afterEach(async () => {
    await app.close();
    await client.close();
  });

  async function get(query = "") {
    return app.inject({
      method: "GET",
      url: `/api/service-requests${query}`,
      cookies: { session: sessionToken },
      headers: { "x-tenant-id": "1" },
    });
  }

  it("returns items list, slaRate and avgLeadtime for the tenant", async () => {
    await seedJsmRow(db, { tenantId: 1, issueType: "SR", issueKey: "SR-1", isOntime: true, totalLeadtime: 3, resolutionDate: new Date() });
    await seedJsmRow(db, { tenantId: 1, issueType: "SR", issueKey: "SR-2", isOntime: false, totalLeadtime: 7, resolutionDate: new Date() });

    const body = (await get()).json();
    expect(body.items).toHaveLength(2);
    expect(body.slaRate).toBeCloseTo(50);
    expect(body.avgLeadtime).toBeCloseTo(5);
  });

  it("filters by status when query param provided", async () => {
    await seedJsmRow(db, { tenantId: 1, issueType: "SR", issueKey: "SR-1", statusCategory: "In Progress" });
    await seedJsmRow(db, { tenantId: 1, issueType: "SR", issueKey: "SR-2", statusCategory: "Done" });

    const body = (await get("?status=In+Progress")).json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].issueKey).toBe("SR-1");
  });

  it("filters by urgency when query param provided", async () => {
    await seedJsmRow(db, { tenantId: 1, issueType: "SR", issueKey: "SR-1", urgencyYn: "Y" });
    await seedJsmRow(db, { tenantId: 1, issueType: "SR", issueKey: "SR-2", urgencyYn: "N" });

    const body = (await get("?urgency=Y")).json();
    expect(body.items).toHaveLength(1);
  });

  it("returns top assignees by SR volume", async () => {
    await seedJsmRow(db, { tenantId: 1, issueType: "SR", issueKey: "SR-1", assigneeName: "Alice" });
    await seedJsmRow(db, { tenantId: 1, issueType: "SR", issueKey: "SR-2", assigneeName: "Alice" });
    await seedJsmRow(db, { tenantId: 1, issueType: "SR", issueKey: "SR-3", assigneeName: "Bob" });

    const body = (await get()).json();
    expect(body.topAssignees[0]).toMatchObject({ name: "Alice", count: 2 });
  });

  it("employee only sees their own issues", async () => {
    // create a second employee user
    const hash = await bcrypt.hash("password", 10);
    const [emp] = await db
      .insert(adminUsers)
      .values({ email: "emp@example.com", passwordHash: hash })
      .returning({ id: adminUsers.id });
    await db.insert(userTenantRoles).values({ userId: emp.id, tenantId: 1, role: "employee" });

    await seedJsmRow(db, { tenantId: 1, issueType: "SR", issueKey: "SR-1", assigneeId: String(emp.id) });
    await seedJsmRow(db, { tenantId: 1, issueType: "SR", issueKey: "SR-2", assigneeId: "someone-else" });

    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "emp@example.com", password: "password" },
    });
    const empToken = loginRes.cookies.find((c) => c.name === "session")!.value;

    const res = await app.inject({
      method: "GET",
      url: "/api/service-requests",
      cookies: { session: empToken },
      headers: { "x-tenant-id": "1" },
    });
    expect(res.json().items).toHaveLength(1);
    expect(res.json().items[0].issueKey).toBe("SR-1");
  });

  it("only returns SR issue type", async () => {
    await seedJsmRow(db, { tenantId: 1, issueType: "SR", issueKey: "SR-1" });
    await seedJsmRow(db, { tenantId: 1, issueType: "CR", issueKey: "CR-1" });

    const body = (await get()).json();
    expect(body.items.every((i: { issueType: string }) => i.issueType === "SR")).toBe(true);
  });
});
