import type { FastifyInstance } from "fastify";
import { eq, and, sql, count } from "drizzle-orm";
import { jsmView } from "@ops/db";
import { requireAuth } from "../middleware/auth.js";
import { requireTenantAccess } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/permission.js";

export async function changeRequestRoutes(app: FastifyInstance) {
  app.get(
    "/api/change-requests",
    { preHandler: [requireAuth, requireTenantAccess, requirePermission("view_change_requests")] },
    async (req, reply) => {
      const { tenantId, role } = req.tenant;
      const db = app.db;

      const q = req.query as Record<string, string>;
      const conditions = [
        eq(jsmView.tenantId, tenantId),
        eq(jsmView.issueType, "CR"),
      ];

      if (q.status) conditions.push(eq(jsmView.statusCategory, q.status));
      if (q.from) conditions.push(sql`${jsmView.issueCreateDate} >= ${q.from}::timestamp`);
      if (q.to) conditions.push(sql`${jsmView.issueCreateDate} <= ${q.to}::timestamp`);

      if (role === "employee") {
        conditions.push(eq(jsmView.assigneeId, String(req.user.id)));
      }

      const where = and(...conditions);

      const items = await db
        .select()
        .from(jsmView)
        .where(where)
        .orderBy(jsmView.issueCreateDate);

      const [slaRow] = await db
        .select({
          ontime: sql<number>`COUNT(*) FILTER (WHERE ${jsmView.isOntime} = true)`,
          total: sql<number>`COUNT(*) FILTER (WHERE ${jsmView.isOntime} IS NOT NULL)`,
        })
        .from(jsmView)
        .where(where);

      const categoryRows = await db
        .select({
          category: jsmView.chgCategory,
          count: count(),
        })
        .from(jsmView)
        .where(and(where, sql`${jsmView.chgCategory} IS NOT NULL`))
        .groupBy(jsmView.chgCategory)
        .orderBy(sql`COUNT(*) DESC`);

      const slaRate =
        Number(slaRow?.total) > 0
          ? (Number(slaRow.ontime) / Number(slaRow.total)) * 100
          : 0;

      return reply.send({
        slaRate: Math.round(slaRate * 10) / 10,
        byCategory: categoryRows.map((r) => ({ category: r.category, count: Number(r.count) })),
        items,
      });
    },
  );
}
