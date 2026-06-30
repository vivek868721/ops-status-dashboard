import type { FastifyInstance } from "fastify";
import { eq, and, count, avg, sql } from "drizzle-orm";
import { jsmView } from "@ops/db";
import { requireAuth } from "../middleware/auth.js";
import { requireTenantAccess } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/permission.js";

export async function overviewRoutes(app: FastifyInstance) {
  app.get(
    "/api/overview/stats",
    { preHandler: [requireAuth, requireTenantAccess, requirePermission("view_overview")] },
    async (req, reply) => {
      const { tenantId } = req.tenant;
      const db = app.db;

      const [slaRow] = await db
        .select({
          ontime: sql<number>`COUNT(*) FILTER (WHERE ${jsmView.isOntime} = true)`,
          total: sql<number>`COUNT(*) FILTER (WHERE ${jsmView.isOntime} IS NOT NULL)`,
        })
        .from(jsmView)
        .where(eq(jsmView.tenantId, tenantId));

      const slaComplianceRate =
        Number(slaRow?.total) > 0
          ? (Number(slaRow.ontime) / Number(slaRow.total)) * 100
          : 0;

      const openRows = await db
        .select({
          issueType: jsmView.issueType,
          cnt: count(),
        })
        .from(jsmView)
        .where(
          and(
            eq(jsmView.tenantId, tenantId),
            sql`${jsmView.statusCategory} != 'Done'`,
          ),
        )
        .groupBy(jsmView.issueType);

      const openSR = Number(openRows.find((r) => r.issueType === "SR")?.cnt ?? 0);
      const openCR = Number(openRows.find((r) => r.issueType === "CR")?.cnt ?? 0);
      const openOC = Number(openRows.find((r) => r.issueType === "OC")?.cnt ?? 0);

      const [urgentRow] = await db
        .select({ cnt: count() })
        .from(jsmView)
        .where(
          and(
            eq(jsmView.tenantId, tenantId),
            eq(jsmView.urgencyYn, "Y"),
            sql`${jsmView.statusCategory} != 'Done'`,
          ),
        );
      const urgentOpen = Number(urgentRow?.cnt ?? 0);

      // "Overdue" = currently open past their due date. This is a backlog metric, not an SLA
      // recalculation — ADR-0001 forbids recalculating is_ontime, not using due_date for this.
      const [overdueRow] = await db
        .select({ cnt: count() })
        .from(jsmView)
        .where(
          and(
            eq(jsmView.tenantId, tenantId),
            sql`${jsmView.statusCategory} != 'Done'`,
            sql`${jsmView.dueDate} < NOW()`,
          ),
        );
      const overdue = Number(overdueRow?.cnt ?? 0);

      const [avgRow] = await db
        .select({ avg: avg(jsmView.totalLeadtime) })
        .from(jsmView)
        .where(
          and(
            eq(jsmView.tenantId, tenantId),
            sql`${jsmView.resolutionDate} IS NOT NULL`,
          ),
        );
      const avgResolutionDays = avgRow?.avg != null ? Number(avgRow.avg) : 0;

      return reply.send({
        slaComplianceRate: Math.round(slaComplianceRate * 10) / 10,
        openSR,
        openCR,
        openOC,
        urgentOpen,
        overdue,
        avgResolutionDays: Math.round(avgResolutionDays * 10) / 10,
        lastUpdated: new Date().toISOString(),
      });
    },
  );
}
