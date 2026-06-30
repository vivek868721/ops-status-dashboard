import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, and } from "drizzle-orm";
import { userTenantRoles } from "@ops/db";

declare module "fastify" {
  interface FastifyRequest {
    tenant: { tenantId: number; role: string };
  }
}

export async function requireTenantAccess(req: FastifyRequest, reply: FastifyReply) {
  const tenantIdHeader = req.headers["x-tenant-id"];
  if (!tenantIdHeader) return reply.status(400).send({ error: "X-Tenant-Id header is required" });

  const tenantId = Number(tenantIdHeader);
  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    return reply.status(400).send({ error: "Invalid X-Tenant-Id" });
  }

  const db = req.server.db;

  const [assignment] = await db
    .select({ role: userTenantRoles.role })
    .from(userTenantRoles)
    .where(and(eq(userTenantRoles.userId, req.user.id), eq(userTenantRoles.tenantId, tenantId)));

  if (!assignment) return reply.status(403).send({ error: "Forbidden" });

  req.tenant = { tenantId, role: assignment.role };
}
