import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import { adminUsers, tenants, userTenantRoles, aiInsights } from "@ops/db";
import { buildApp } from "../../app.js";
import { createTestDb, seedDefaultPermissions, seedJsmRow } from "../../test-helpers/db.js";

// Mock Anthropic SDK at the module boundary — the sole external API mock in the project
const mockCreate = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

type Db = Awaited<ReturnType<typeof createTestDb>>["db"];

async function setup(db: Db, role: "it_manager" | "employee" | "executive" = "it_manager") {
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

describe("AI Insights API", () => {
  let db: Db;
  let client: Awaited<ReturnType<typeof createTestDb>>["client"];
  let app: ReturnType<typeof buildApp>;
  let sessionToken: string;

  beforeEach(async () => {
    ({ db, client } = await createTestDb());
    app = buildApp(db);
    await app.ready();
    await setup(db, "it_manager");
    const r = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "user@example.com", password: "password" },
    });
    sessionToken = r.cookies.find((c) => c.name === "session")!.value;

    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            insights: [{ title: "High SLA breach", description: "5 tickets missed SLA", severity: "high" }],
            charts: [{ type: "bar", title: "Issues by type", data: [] }],
          }),
        },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
    await client.close();
    vi.clearAllMocks();
  });

  describe("GET /api/ai-insights", () => {
    it("returns last 10 analyses for the tenant", async () => {
      for (let i = 0; i < 12; i++) {
        await db.insert(aiInsights).values({
          tenantId: 1,
          insightsJson: JSON.stringify({ insights: [] }),
          chartsJson: JSON.stringify({ charts: [] }),
        });
      }

      const res = await app.inject({
        method: "GET",
        url: "/api/ai-insights",
        cookies: { session: sessionToken },
        headers: { "x-tenant-id": "1" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().analyses).toHaveLength(10);
    });

    it("returns empty array when no analyses exist", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/ai-insights",
        cookies: { session: sessionToken },
        headers: { "x-tenant-id": "1" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().analyses).toEqual([]);
    });

    it("scopes to requesting tenant only", async () => {
      await db.insert(aiInsights).values({
        tenantId: 2,
        insightsJson: JSON.stringify({ insights: [] }),
        chartsJson: JSON.stringify({ charts: [] }),
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/ai-insights",
        cookies: { session: sessionToken },
        headers: { "x-tenant-id": "1" },
      });
      expect(res.json().analyses).toHaveLength(0);
    });
  });

  describe("POST /api/ai-insights/analyze", () => {
    it("calls the Anthropic SDK, stores result and returns 201", async () => {
      await seedJsmRow(db, { tenantId: 1, issueType: "SR", issueKey: "SR-1", isOntime: true });

      const res = await app.inject({
        method: "POST",
        url: "/api/ai-insights/analyze",
        cookies: { session: sessionToken },
        headers: { "x-tenant-id": "1" },
        payload: {},
      });

      expect(res.statusCode).toBe(201);
      expect(mockCreate).toHaveBeenCalledOnce();

      const body = res.json();
      expect(body.insightsJson).toBeDefined();
      expect(body.chartsJson).toBeDefined();
      expect(body.tenantId).toBe(1);
    });

    it("accepts optional customQuery and passes it in the prompt", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/ai-insights/analyze",
        cookies: { session: sessionToken },
        headers: { "x-tenant-id": "1" },
        payload: { customQuery: "Focus on urgent tickets" },
      });

      expect(res.statusCode).toBe(201);
      const call = mockCreate.mock.calls[0][0];
      const promptText = call.messages[0].content as string;
      expect(promptText).toContain("Focus on urgent tickets");
    });

    it("returns 403 for employee role", async () => {
      const hash = await bcrypt.hash("password", 10);
      const [emp] = await db
        .insert(adminUsers)
        .values({ email: "emp@example.com", passwordHash: hash })
        .returning({ id: adminUsers.id });
      await db.insert(userTenantRoles).values({ userId: emp.id, tenantId: 1, role: "employee" });

      const loginRes = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "emp@example.com", password: "password" },
      });
      const empToken = loginRes.cookies.find((c) => c.name === "session")!.value;

      const res = await app.inject({
        method: "POST",
        url: "/api/ai-insights/analyze",
        cookies: { session: empToken },
        headers: { "x-tenant-id": "1" },
        payload: {},
      });
      expect(res.statusCode).toBe(403);
    });
  });
});
