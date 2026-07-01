import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { tenants, userTenantRoles, userPermissions } from "@ops/db";
import { requireAuth } from "../middleware/auth.js";
import { requireTenantAccess } from "../middleware/tenant.js";

export async function tenantRoutes(app: FastifyInstance) {
  // List tenants accessible to the current user (all for super_admin)
  app.get("/api/tenants", { preHandler: [requireAuth] }, async (req, reply) => {
    if (req.user.systemRole === "super_admin") {
      const rows = await app.db.select().from(tenants).orderBy(tenants.id);
      return reply.send(rows.map((t) => ({ tenantId: t.id, name: t.name, systemRole: "super_admin" })));
    }

    const rows = await app.db
      .select({
        tenantId: userTenantRoles.tenantId,
        name: tenants.name,
        systemRole: userTenantRoles.systemRole,
      })
      .from(userTenantRoles)
      .leftJoin(tenants, eq(tenants.id, userTenantRoles.tenantId))
      .where(eq(userTenantRoles.userId, req.user.id));

    return reply.send(rows);
  });

  // List data-access permissions assigned to the current user (all for super_admin)
  app.get("/api/user/permissions", { preHandler: [requireAuth] }, async (req, reply) => {
    if (req.user.systemRole === "super_admin") {
      return reply.send(["executive", "it_manager", "employee"]);
    }

    const rows = await app.db
      .select({ permission: userPermissions.permission })
      .from(userPermissions)
      .where(eq(userPermissions.userId, req.user.id));

    return reply.send(rows.map((r) => r.permission));
  });

  // Returns the resolved tenant context for the current request
  app.get(
    "/api/tenant/current",
    { preHandler: [requireAuth, requireTenantAccess] },
    async (req, reply) => {
      return reply.send(req.tenant);
    },
  );
}
