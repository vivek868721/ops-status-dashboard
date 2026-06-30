import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, and } from "drizzle-orm";
import { rolePermissions } from "@ops/db";

type TenantRole = "executive" | "it_manager" | "employee";

export function requirePermission(permissionKey: string) {
  return async function (req: FastifyRequest, reply: FastifyReply) {
    const role = req.tenant.role as TenantRole;
    const db = req.server.db;

    const [perm] = await db
      .select({ enabled: rolePermissions.enabled })
      .from(rolePermissions)
      .where(and(eq(rolePermissions.role, role), eq(rolePermissions.permissionKey, permissionKey)));

    // No entry → allow (defaults are always seeded; absence means not restricted)
    if (perm !== undefined && !perm.enabled) {
      return reply.status(403).send({ error: "Forbidden" });
    }
  };
}
