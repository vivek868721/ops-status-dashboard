import { describe, it, expect, beforeEach, afterEach } from "vitest";
import bcrypt from "bcryptjs";
import { adminUsers } from "@ops/db";
import { buildApp } from "../../app.js";
import { createTestDb } from "../../test-helpers/db.js";

type Db = Awaited<ReturnType<typeof createTestDb>>["db"];
type Client = Awaited<ReturnType<typeof createTestDb>>["client"];

async function createSuperAdmin(db: Db, email: string) {
  const hash = await bcrypt.hash("password", 10);
  const [u] = await db.insert(adminUsers).values({ email, passwordHash: hash, role: "super_admin" }).returning({ id: adminUsers.id });
  return u.id;
}

async function createRegularUser(db: Db, email: string) {
  const hash = await bcrypt.hash("password", 10);
  const [u] = await db.insert(adminUsers).values({ email, passwordHash: hash, role: null }).returning({ id: adminUsers.id });
  return u.id;
}

async function loginAs(app: ReturnType<typeof buildApp>, email: string) {
  const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password: "password" } });
  return res.cookies.find((c) => c.name === "session")!.value;
}

// ── Cycle 1 — Collectors CRUD ─────────────────────────────────────────────────

describe("GET /api/batch/collectors", () => {
  let db: Db;
  let client: Client;
  let app: ReturnType<typeof buildApp>;
  let adminToken: string;
  let regularToken: string;

  beforeEach(async () => {
    ({ db, client } = await createTestDb());
    app = buildApp(db);
    await app.ready();
    await createSuperAdmin(db, "admin@example.com");
    await createRegularUser(db, "regular@example.com");
    adminToken = await loginAs(app, "admin@example.com");
    regularToken = await loginAs(app, "regular@example.com");
  });

  afterEach(async () => { await app.close(); await client.close(); });

  it("super_admin can list collectors", async () => {
    await client.exec(`
      INSERT INTO tb_integration_collector (collector_id, job_name, cron_schedule, integration_id, tenant_id, active_yn)
      VALUES (1, 'JSM_Acme', '0 * * * *', 'JSM', 1, 'Y'),
             (2, 'SAP_Acme', '0 */2 * * *', 'SAP', 1, 'Y')
    `);

    const res = await app.inject({
      method: "GET", url: "/api/batch/collectors",
      cookies: { session: adminToken },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { collectors: unknown[] };
    expect(body.collectors).toHaveLength(2);
    const c = body.collectors[0] as Record<string, unknown>;
    expect(c).toMatchObject({ collectorId: expect.any(Number), jobName: expect.any(String) });
  });

  it("returns 403 for regular user", async () => {
    const res = await app.inject({
      method: "GET", url: "/api/batch/collectors",
      cookies: { session: regularToken },
    });
    expect(res.statusCode).toBe(403);
  });

  it("super_admin can create a collector", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/batch/collectors",
      cookies: { session: adminToken },
      payload: { jobName: "NewJob", cronSchedule: "0 * * * *", integrationId: "JSM", tenantId: 1, activeYn: "Y" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { collector: Record<string, unknown> };
    expect(body.collector.jobName).toBe("NewJob");
  });

  it("super_admin can update a collector", async () => {
    await client.exec(`INSERT INTO tb_integration_collector (collector_id, job_name, cron_schedule, integration_id, tenant_id, active_yn) VALUES (10, 'OldJob', '0 * * * *', 'JSM', 1, 'Y')`);

    const res = await app.inject({
      method: "PUT", url: "/api/batch/collectors/10",
      cookies: { session: adminToken },
      payload: { cronSchedule: "0 */6 * * *", activeYn: "N" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { collector: Record<string, unknown> };
    expect(body.collector.cronSchedule).toBe("0 */6 * * *");
    expect(body.collector.activeYn).toBe("N");
  });

  it("super_admin can delete a collector", async () => {
    await client.exec(`INSERT INTO tb_integration_collector (collector_id, job_name, integration_id, tenant_id) VALUES (99, 'DelJob', 'JSM', 1)`);

    const res = await app.inject({
      method: "DELETE", url: "/api/batch/collectors/99",
      cookies: { session: adminToken },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.ok).toBe(true);
  });
});

// ── Cycle 2 — Integration Config CRUD (with credential masking) ───────────────

describe("GET /api/batch/integration-config", () => {
  let db: Db;
  let client: Client;
  let app: ReturnType<typeof buildApp>;
  let adminToken: string;

  beforeEach(async () => {
    ({ db, client } = await createTestDb());
    app = buildApp(db);
    await app.ready();
    await createSuperAdmin(db, "admin@example.com");
    adminToken = await loginAs(app, "admin@example.com");
  });

  afterEach(async () => { await app.close(); await client.close(); });

  it("lists integration configs with credentials masked", async () => {
    await client.exec(`
      INSERT INTO tb_integration_config (config_id, integration_id, tenant_id, base_url, auth_type, access_key, secret_key, token, api_key)
      VALUES (1, 'JSM', 1, 'https://jira.example.com', 'basic', 'myaccesskey', 'mysecretkey', 'mytoken', 'myapikey')
    `);

    const res = await app.inject({
      method: "GET", url: "/api/batch/integration-config",
      cookies: { session: adminToken },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { configs: Record<string, unknown>[] };
    expect(body.configs).toHaveLength(1);
    const config = body.configs[0];
    // Credential fields must be masked
    expect(config.accessKey).toBe("***");
    expect(config.secretKey).toBe("***");
    expect(config.token).toBe("***");
    expect(config.apiKey).toBe("***");
    // Non-credential fields pass through
    expect(config.baseUrl).toBe("https://jira.example.com");
    expect(config.authType).toBe("basic");
  });

  it("super_admin can create integration config", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/batch/integration-config",
      cookies: { session: adminToken },
      payload: { integrationId: "SAP", tenantId: 2, baseUrl: "https://sap.example.com", authType: "bearer", token: "secret123" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { config: Record<string, unknown> };
    // token masked in response
    expect(body.config.token).toBe("***");
  });
});

// ── Cycle 3 — Parser CRUD ─────────────────────────────────────────────────────

describe("GET /api/batch/parsers", () => {
  let db: Db;
  let client: Client;
  let app: ReturnType<typeof buildApp>;
  let adminToken: string;

  beforeEach(async () => {
    ({ db, client } = await createTestDb());
    app = buildApp(db);
    await app.ready();
    await createSuperAdmin(db, "admin@example.com");
    adminToken = await loginAs(app, "admin@example.com");
  });

  afterEach(async () => { await app.close(); await client.close(); });

  it("super_admin can list parsers", async () => {
    await client.exec(`
      INSERT INTO tb_integration_parser (parser_id, integration_id, tenant_id, parser_class)
      VALUES (1, 'JSM', 1, 'com.example.JsmParser')
    `);

    const res = await app.inject({
      method: "GET", url: "/api/batch/parsers",
      cookies: { session: adminToken },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { parsers: unknown[] };
    expect(body.parsers).toHaveLength(1);
  });

  it("super_admin can create a parser", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/batch/parsers",
      cookies: { session: adminToken },
      payload: { integrationId: "SNOW", tenantId: 1, parserClass: "com.example.SnowParser", configJson: "{}" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { parser: Record<string, unknown> };
    expect(body.parser.parserClass).toBe("com.example.SnowParser");
  });

  it("super_admin can delete a parser", async () => {
    await client.exec(`INSERT INTO tb_integration_parser (parser_id, integration_id, tenant_id, parser_class) VALUES (77, 'JSM', 1, 'com.example.OldParser')`);

    const res = await app.inject({
      method: "DELETE", url: "/api/batch/parsers/77",
      cookies: { session: adminToken },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as Record<string, unknown>).ok).toBe(true);
  });
});
