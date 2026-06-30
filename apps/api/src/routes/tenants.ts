import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { tenants, userTenantRoles } from "@ops/db";
import { requireAuth } from "../middleware/auth.js";
import { requireTenantAccess } from "../middleware/tenant.js";

export async function tenantRoutes(app: FastifyInstance) {
  app.get("/api/tenants", { preHandler: [requireAuth] }, async (req, reply) => {
    const rows = await app.db
      .select({
        tenantId: userTenantRoles.tenantId,
        name: tenants.name,
        role: userTenantRoles.role,
      })
      .from(userTenantRoles)
      .leftJoin(tenants, eq(tenants.id, userTenantRoles.tenantId))
      .where(eq(userTenantRoles.userId, req.user.id));

    return reply.send(rows);
  });

  app.get(
    "/api/tenant/current",
    { preHandler: [requireAuth, requireTenantAccess] },
    async (req, reply) => {
      return reply.send(req.tenant);
    },
  );
}
