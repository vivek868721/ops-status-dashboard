import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, and } from "drizzle-orm";
import { userTenantRoles, userPermissions } from "@ops/db";

declare module "fastify" {
  interface FastifyRequest {
    // role: the data-access permission level (executive|it_manager|employee)
    // systemRole: the administrative role (super_admin|tenant_admin|operator|member)
    tenant: { tenantId: number; role: string; systemRole: string };
  }
}

const VALID_PERMISSIONS = ["executive", "it_manager", "employee"] as const;
type Permission = (typeof VALID_PERMISSIONS)[number];

export async function requireTenantAccess(req: FastifyRequest, reply: FastifyReply) {
  const tenantIdHeader = req.headers["x-tenant-id"];
  if (!tenantIdHeader) return reply.status(400).send({ error: "X-Tenant-Id header is required" });

  const tenantId = Number(tenantIdHeader);
  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    return reply.status(400).send({ error: "Invalid X-Tenant-Id" });
  }

  const permissionHeader = req.headers["x-permission"] as string | undefined;
  if (!permissionHeader || !VALID_PERMISSIONS.includes(permissionHeader as Permission)) {
    return reply.status(400).send({ error: "X-Permission header is required (executive|it_manager|employee)" });
  }
  const permission = permissionHeader as Permission;

  // Super-admin bypasses tenant membership and permission checks
  if (req.user.systemRole === "super_admin") {
    req.tenant = { tenantId, role: permission, systemRole: "super_admin" };
    return;
  }

  const db = req.server.db;

  // Check tenant membership
  const [assignment] = await db
    .select({ systemRole: userTenantRoles.systemRole })
    .from(userTenantRoles)
    .where(and(eq(userTenantRoles.userId, req.user.id), eq(userTenantRoles.tenantId, tenantId)));

  if (!assignment) return reply.status(403).send({ error: "Forbidden" });

  // Check user has the requested permission assigned globally
  const [permRow] = await db
    .select({ id: userPermissions.id })
    .from(userPermissions)
    .where(and(eq(userPermissions.userId, req.user.id), eq(userPermissions.permission, permission)));

  if (!permRow) return reply.status(403).send({ error: "Forbidden: permission not assigned" });

  req.tenant = { tenantId, role: permission, systemRole: assignment.systemRole };
}
