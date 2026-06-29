import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { eq, and, gt } from "drizzle-orm";
import { adminUsers, sessions } from "@ops/db";

export async function authRoutes(app: FastifyInstance) {
  app.get("/api/auth/me", async (req, reply) => {
    const token = req.cookies?.session;
    if (!token) return reply.status(401).send({ error: "Unauthorized" });

    const [session] = await app.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())));

    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const [user] = await app.db
      .select({ id: adminUsers.id, email: adminUsers.email })
      .from(adminUsers)
      .where(eq(adminUsers.id, session.adminUserId));

    return reply.send(user);
  });

  app.post("/api/auth/logout", async (req, reply) => {
    const token = req.cookies?.session;
    if (token) {
      await app.db.delete(sessions).where(eq(sessions.token, token));
    }
    reply.clearCookie("session", { path: "/" }).send({ ok: true });
  });

  app.post("/api/auth/login", async (req, reply) => {
    const { email, password } = req.body as { email: string; password: string };

    const [user] = await app.db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, email));

    if (!user) return reply.status(401).send({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return reply.status(401).send({ error: "Invalid credentials" });

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await app.db.insert(sessions).values({
      adminUserId: user.id,
      token,
      expiresAt,
    });

    reply
      .setCookie("session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        expires: expiresAt,
        path: "/",
      })
      .send({ ok: true });
  });
}
