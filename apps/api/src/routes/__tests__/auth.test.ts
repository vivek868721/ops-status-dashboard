import { describe, it, expect, beforeEach, afterEach } from "vitest";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { adminUsers } from "@ops/db";
import { buildApp } from "../../app.js";
import { createTestDb } from "../../test-helpers/db.js";

describe("GET /api/auth/me", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>["db"];
  let client: Awaited<ReturnType<typeof createTestDb>>["client"];
  let app: ReturnType<typeof buildApp>;
  let sessionToken: string;

  beforeEach(async () => {
    ({ db, client } = await createTestDb());
    app = buildApp(db);
    await app.ready();

    const hash = await bcrypt.hash("password", 10);
    await db.insert(adminUsers).values({ email: "admin@example.com", passwordHash: hash });

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

  it("returns 200 with user info for a valid session cookie", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { session: sessionToken },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ email: "admin@example.com" });
  });

  it("returns 401 when no session cookie is present", async () => {
    const res = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 on /me after logout invalidates the session", async () => {
    await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      cookies: { session: sessionToken },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { session: sessionToken },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /api/auth/login", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>["db"];
  let client: Awaited<ReturnType<typeof createTestDb>>["client"];
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    ({ db, client } = await createTestDb());
    app = buildApp(db);
    await app.ready();

    // Seed one admin user
    const hash = await bcrypt.hash("correct-password", 10);
    await db.insert(adminUsers).values({
      email: "admin@example.com",
      passwordHash: hash,
    });
  });

  afterEach(async () => {
    await app.close();
    await client.close();
  });

  it("returns 401 for unknown email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "nobody@example.com", password: "any-password" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 for wrong password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "wrong-password" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.cookies.some((c) => c.name === "session")).toBe(false);
  });

  it("returns 200 and sets a session cookie for valid credentials", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "correct-password" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.cookies.some((c) => c.name === "session")).toBe(true);
  });
});
