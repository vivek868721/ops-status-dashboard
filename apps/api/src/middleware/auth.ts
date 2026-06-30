import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, and, gt } from "drizzle-orm";
import { adminUsers, sessions } from "@ops/db";

declare module "fastify" {
  interface FastifyRequest {
    user: { id: number; email: string };
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies?.session;
  if (!token) return reply.status(401).send({ error: "Unauthorized" });

  const db = req.server.db;

  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())));

  if (!session) return reply.status(401).send({ error: "Unauthorized" });

  const [user] = await db
    .select({ id: adminUsers.id, email: adminUsers.email })
    .from(adminUsers)
    .where(eq(adminUsers.id, session.adminUserId));

  if (!user) return reply.status(401).send({ error: "Unauthorized" });

  req.user = user;
}
