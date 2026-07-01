import type { FastifyInstance } from "fastify";
import { eq, and, count, sql } from "drizzle-orm";
import { tbBatchHistory, tbIntegrationCollector } from "@ops/db";
import { requireAuth } from "../middleware/auth.js";
import { requireTenantAccess } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/permission.js";

export async function batchDashboardRoutes(app: FastifyInstance) {
  app.get(
    "/api/batch/dashboard/summary",
    { preHandler: [requireAuth, requireTenantAccess, requirePermission("batch_view_dashboard")] },
    async (req, reply) => {
      const { tenantId } = req.tenant;
      const query = req.query as { startDate?: string; endDate?: string };
      const db = app.db;

      const where = buildWhere(tenantId, query.startDate, query.endDate);

      const [counts] = await db
        .select({
          total: count(),
          success: sql<number>`COUNT(*) FILTER (WHERE ${tbBatchHistory.crawlingStatus} = 'S')`,
          failed:  sql<number>`COUNT(*) FILTER (WHERE ${tbBatchHistory.crawlingStatus} = 'F')`,
          running: sql<number>`COUNT(*) FILTER (WHERE ${tbBatchHistory.crawlingStatus} = 'R')`,
          pending: sql<number>`COUNT(*) FILTER (WHERE ${tbBatchHistory.crawlingStatus} = 'P')`,
        })
        .from(tbBatchHistory)
        .where(where);

      const [activeRow] = await db
        .select({ active: count() })
        .from(tbIntegrationCollector)
        .where(
          and(
            eq(tbIntegrationCollector.tenantId, tenantId),
            eq(tbIntegrationCollector.activeYn, "Y"),
          ),
        );

      const total   = Number(counts?.total   ?? 0);
      const success = Number(counts?.success ?? 0);
      const failed  = Number(counts?.failed  ?? 0);
      const running = Number(counts?.running ?? 0);
      const pending = Number(counts?.pending ?? 0);
      const active  = Number(activeRow?.active ?? 0);
      const successRate = total > 0 ? Math.round((success / total) * 1000) / 10 : 0;

      return reply.send({ total, success, failed, running, pending, active, successRate });
    },
  );

  app.get(
    "/api/batch/dashboard/trends",
    { preHandler: [requireAuth, requireTenantAccess, requirePermission("batch_view_dashboard")] },
    async (req, reply) => {
      const { tenantId } = req.tenant;
      const query = req.query as { startDate?: string; endDate?: string };
      const db = app.db;

      const where = buildWhere(tenantId, query.startDate, query.endDate);

      const dailyRows = await db
        .select({
          date:    tbBatchHistory.batchDate,
          total:   count(),
          success: sql<number>`COUNT(*) FILTER (WHERE ${tbBatchHistory.crawlingStatus} = 'S')`,
          failed:  sql<number>`COUNT(*) FILTER (WHERE ${tbBatchHistory.crawlingStatus} = 'F')`,
        })
        .from(tbBatchHistory)
        .where(where)
        .groupBy(tbBatchHistory.batchDate)
        .orderBy(tbBatchHistory.batchDate);

      const integrationRows = await db
        .select({
          integrationId: tbBatchHistory.integrationId,
          count: count(),
        })
        .from(tbBatchHistory)
        .where(where)
        .groupBy(tbBatchHistory.integrationId)
        .orderBy(sql`count(*) DESC`);

      const dailyTrend = dailyRows.map((r) => ({
        date: String(r.date ?? ""),
        total: Number(r.total),
        success: Number(r.success),
        failed: Number(r.failed),
      }));

      const integrationDistribution = integrationRows.map((r) => ({
        integrationId: String(r.integrationId ?? ""),
        count: Number(r.count),
      }));

      return reply.send({ dailyTrend, integrationDistribution });
    },
  );
}

function buildWhere(tenantId: number, startDate?: string, endDate?: string) {
  const conditions = [eq(tbBatchHistory.tenantId, tenantId)];
  if (startDate) conditions.push(sql`${tbBatchHistory.batchDate}::date >= ${startDate}::date`);
  if (endDate)   conditions.push(sql`${tbBatchHistory.batchDate}::date <= ${endDate}::date`);
  return and(...conditions);
}
