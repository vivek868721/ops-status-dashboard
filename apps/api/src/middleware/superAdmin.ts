import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { adminUsers } from "@ops/db";

export async function requireSuperAdmin(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user) {
    return reply.status(401).send({ error: "Unauthorized" });
  }

  const db = req.server.db;
  const [user] = await db
    .select({ role: adminUsers.role })
    .from(adminUsers)
    .where(eq(adminUsers.id, req.user.id));

  if (!user || user.role !== "super_admin") {
    return reply.status(403).send({ error: "Forbidden" });
  }
}
