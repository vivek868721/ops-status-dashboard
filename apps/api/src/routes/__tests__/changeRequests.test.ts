import { describe, it, expect, beforeEach, afterEach } from "vitest";
import bcrypt from "bcryptjs";
import { adminUsers, tenants } from "@ops/db";
import { buildApp } from "../../app.js";
import { createTestDb, seedDefaultPermissions, seedJsmRow, seedUserTenantPermission } from "../../test-helpers/db.js";

type Db = Awaited<ReturnType<typeof createTestDb>>["db"];

async function setup(db: Db) {
  const hash = await bcrypt.hash("password", 10);
  const [user] = await db
    .insert(adminUsers)
    .values({ email: "user@example.com", passwordHash: hash })
    .returning({ id: adminUsers.id });
  await db.insert(tenants).values({ id: 1, name: "Acme" });
  await seedUserTenantPermission(db, user.id, 1, "it_manager");
  await seedDefaultPermissions(db);
  return user.id;
}

describe("GET /api/change-requests", () => {
  let db: Db;
  let client: Awaited<ReturnType<typeof createTestDb>>["client"];
  let app: ReturnType<typeof buildApp>;
  let sessionToken: string;

  beforeEach(async () => {
    ({ db, client } = await createTestDb());
    app = buildApp(db);
    await app.ready();
    await setup(db);
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
      url: `/api/change-requests${query}`,
      cookies: { session: sessionToken },
      headers: { "x-tenant-id": "1", "x-permission": "it_manager" },
    });
  }

  it("returns items, slaRate, and byCategory for the tenant", async () => {
    await seedJsmRow(db, { tenantId: 1, issueType: "CR", issueKey: "CR-1", isOntime: true, chgCategory: "Standard" });
    await seedJsmRow(db, { tenantId: 1, issueType: "CR", issueKey: "CR-2", isOntime: false, chgCategory: "Emergency" });

    const body = (await get()).json();
    expect(body.items).toHaveLength(2);
    expect(body.slaRate).toBeCloseTo(50);
    expect(body.byCategory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "Standard", total: 1, ontime: 1, overdue: 0 }),
        expect.objectContaining({ category: "Emergency", total: 1, ontime: 0, overdue: 1 }),
      ]),
    );
  });

  it("only returns CR issue type", async () => {
    await seedJsmRow(db, { tenantId: 1, issueType: "CR", issueKey: "CR-1" });
    await seedJsmRow(db, { tenantId: 1, issueType: "SR", issueKey: "SR-1" });

    const body = (await get()).json();
    expect(body.items.every((i: { issueType: string }) => i.issueType === "CR")).toBe(true);
  });

  it("filters by status query param", async () => {
    await seedJsmRow(db, { tenantId: 1, issueType: "CR", issueKey: "CR-1", statusCategory: "In Progress" });
    await seedJsmRow(db, { tenantId: 1, issueType: "CR", issueKey: "CR-2", statusCategory: "Done" });

    const body = (await get("?status=In+Progress")).json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].issueKey).toBe("CR-1");
  });

  it("scopes to requesting tenant only", async () => {
    await seedJsmRow(db, { tenantId: 2, issueType: "CR", issueKey: "CR-99" });

    const body = (await get()).json();
    expect(body.items).toHaveLength(0);
  });
});
