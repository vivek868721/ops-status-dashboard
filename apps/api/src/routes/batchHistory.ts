import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { tbBatchHistory, tbJobExecutionAudit } from "@ops/db";
import { requireAuth } from "../middleware/auth.js";
import { requireTenantAccess } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/permission.js";

export async function batchHistoryRoutes(app: FastifyInstance) {
  const VIEW = [requireAuth, requireTenantAccess, requirePermission("batch_view_dashboard")] as const;
  const MANAGE = [requireAuth, requireTenantAccess, requirePermission("batch_manage_jobs")] as const;

  // ── GET /api/batch/history/export  (must come before /:id) ───────────────
  app.get(
    "/api/batch/history/export",
    { preHandler: [...VIEW] },
    async (req, reply) => {
      const { tenantId } = req.tenant;
      const db = app.db;

      const rows = await db
        .select()
        .from(tbBatchHistory)
        .where(eq(tbBatchHistory.tenantId, tenantId))
        .orderBy(tbBatchHistory.id);

      const header = "id,batch_date,integration_id,tenant_id,collector_id,crawling_status,parse_status,created_at";
      const lines = rows.map((r) =>
        [r.id, r.batchDate, r.integrationId, r.tenantId, r.collectorId, r.crawlingStatus, r.parseStatus, r.createdAt]
          .map((v) => (v === null || v === undefined ? "" : String(v)))
          .join(","),
      );

      reply.header("Content-Type", "text/csv");
      reply.header("Content-Disposition", `attachment; filename="batch-history.csv"`);
      return reply.send([header, ...lines].join("\n"));
    },
  );

  // ── GET /api/batch/history ────────────────────────────────────────────────
  app.get(
    "/api/batch/history",
    { preHandler: [...VIEW] },
    async (req, reply) => {
      const { tenantId } = req.tenant;
      const q = req.query as { batchDate?: string; crawlingStatus?: string; integrationId?: string };
      const db = app.db;

      const conditions = [eq(tbBatchHistory.tenantId, tenantId)];
      if (q.batchDate) conditions.push(eq(tbBatchHistory.batchDate, q.batchDate));
      if (q.crawlingStatus) conditions.push(eq(tbBatchHistory.crawlingStatus, q.crawlingStatus));
      if (q.integrationId) conditions.push(eq(tbBatchHistory.integrationId, q.integrationId));

      const rows = await db
        .select()
        .from(tbBatchHistory)
        .where(and(...conditions))
        .orderBy(tbBatchHistory.id);

      const items = rows.map((r) => ({
        id: r.id,
        batchDate: r.batchDate,
        integrationId: r.integrationId,
        tenantId: r.tenantId,
        collectorId: r.collectorId,
        crawlingStatus: r.crawlingStatus,
        parseStatus: r.parseStatus,
        createdAt: r.createdAt,
      }));

      return reply.send({ items, total: items.length });
    },
  );

  // ── GET /api/batch/history/:id ────────────────────────────────────────────
  app.get(
    "/api/batch/history/:id",
    { preHandler: [...VIEW] },
    async (req, reply) => {
      const { tenantId } = req.tenant;
      const id = Number((req.params as { id: string }).id);
      const db = app.db;

      const [row] = await db
        .select()
        .from(tbBatchHistory)
        .where(and(eq(tbBatchHistory.id, id), eq(tbBatchHistory.tenantId, tenantId)));

      if (!row) return reply.status(404).send({ error: "Not found" });
      return reply.send({ item: row });
    },
  );

  // ── POST /api/batch/history/:id/retry ────────────────────────────────────
  app.post(
    "/api/batch/history/:id/retry",
    { preHandler: [...MANAGE] },
    async (req, reply) => {
      const { tenantId } = req.tenant;
      const id = Number((req.params as { id: string }).id);
      const db = app.db;

      const [row] = await db
        .select({ collectorId: tbBatchHistory.collectorId })
        .from(tbBatchHistory)
        .where(and(eq(tbBatchHistory.id, id), eq(tbBatchHistory.tenantId, tenantId)));

      if (!row) return reply.status(404).send({ error: "Not found" });

      await db.insert(tbJobExecutionAudit).values({
        collectorId: row.collectorId ?? 0,
        triggerType: "retry",
        status: "TRIGGERED",
        startedAt: new Date(),
      });

      return reply.send({ ok: true, historyId: id, triggerType: "retry" });
    },
  );
}
