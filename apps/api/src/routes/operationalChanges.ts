import type { FastifyInstance } from "fastify";
import { eq, and, sql, avg, count } from "drizzle-orm";
import { jsmView } from "@ops/db";
import { requireAuth } from "../middleware/auth.js";
import { requireTenantAccess } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/permission.js";

export async function operationalChangeRoutes(app: FastifyInstance) {
  app.get(
    "/api/operational-changes",
    { preHandler: [requireAuth, requireTenantAccess, requirePermission("view_operational_changes")] },
    async (req, reply) => {
      const { tenantId, role } = req.tenant;
      const db = app.db;

      const q = req.query as Record<string, string>;
      const conditions = [
        eq(jsmView.tenantId, tenantId),
        eq(jsmView.issueType, "OC"),
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

      const [avgRow] = await db
        .select({ avg: avg(jsmView.totalLeadtime) })
        .from(jsmView)
        .where(and(where, sql`${jsmView.resolutionDate} IS NOT NULL`));

      const cancelRows = await db
        .select({ reason: jsmView.cancelReason, count: count() })
        .from(jsmView)
        .where(and(where, sql`${jsmView.cancelReason} IS NOT NULL`))
        .groupBy(jsmView.cancelReason)
        .orderBy(sql`COUNT(*) DESC`);

      const stopRows = await db
        .select({ reason: jsmView.stopReason, count: count() })
        .from(jsmView)
        .where(and(where, sql`${jsmView.stopReason} IS NOT NULL`))
        .groupBy(jsmView.stopReason)
        .orderBy(sql`COUNT(*) DESC`);

      const slaRate =
        Number(slaRow?.total) > 0
          ? (Number(slaRow.ontime) / Number(slaRow.total)) * 100
          : 0;

      return reply.send({
        slaRate: Math.round(slaRate * 10) / 10,
        avgLeadtime: avgRow?.avg != null ? Math.round(Number(avgRow.avg) * 10) / 10 : 0,
        cancelReasons: cancelRows.map((r) => ({ reason: r.reason, count: Number(r.count) })),
        stopReasons: stopRows.map((r) => ({ reason: r.reason, count: Number(r.count) })),
        items,
      });
    },
  );
}
