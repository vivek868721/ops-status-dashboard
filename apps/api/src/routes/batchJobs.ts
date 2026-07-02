import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { tbIntegrationCollector, tbJobExecutionAudit } from "@ops/db";
import { requireAuth } from "../middleware/auth.js";
import { requireTenantAccess } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/permission.js";

export async function batchJobsRoutes(app: FastifyInstance) {
  // ── GET /api/batch/jobs ────────────────────────────────────────────────────
  app.get(
    "/api/batch/jobs",
    { preHandler: [requireAuth, requireTenantAccess, requirePermission("batch_view_dashboard")] },
    async (req, reply) => {
      const { tenantId } = req.tenant;
      const db = app.db;

      const rows = await db
        .select()
        .from(tbIntegrationCollector)
        .where(eq(tbIntegrationCollector.tenantId, tenantId))
        .orderBy(tbIntegrationCollector.collectorId);

      const jobs = rows.map((r) => ({
        collectorId: r.collectorId,
        jobName: r.jobName,
        cronSchedule: r.cronSchedule,
        integrationId: r.integrationId,
        activeYn: r.activeYn,
        lastRunAt: r.lastRunAt,
        createdAt: r.createdAt,
      }));

      return reply.send({ jobs });
    },
  );

  // ── PUT /api/batch/jobs/:id ────────────────────────────────────────────────
  app.put(
    "/api/batch/jobs/:id",
    { preHandler: [requireAuth, requireTenantAccess, requirePermission("batch_manage_jobs")] },
    async (req, reply) => {
      const { tenantId } = req.tenant;
      const id = Number((req.params as { id: string }).id);
      const body = req.body as { cronSchedule?: string; activeYn?: string };
      const db = app.db;

      const [updated] = await db
        .update(tbIntegrationCollector)
        .set({
          ...(body.cronSchedule !== undefined ? { cronSchedule: body.cronSchedule } : {}),
          ...(body.activeYn !== undefined ? { activeYn: body.activeYn } : {}),
        })
        .where(and(eq(tbIntegrationCollector.collectorId, id), eq(tbIntegrationCollector.tenantId, tenantId)))
        .returning();

      if (!updated) return reply.status(404).send({ error: "Job not found" });
      return reply.send({ job: updated });
    },
  );

  // ── POST /api/batch/jobs/:id/run ───────────────────────────────────────────
  app.post(
    "/api/batch/jobs/:id/run",
    { preHandler: [requireAuth, requireTenantAccess, requirePermission("batch_manage_jobs")] },
    async (req, reply) => {
      const id = Number((req.params as { id: string }).id);
      const db = app.db;

      await db.insert(tbJobExecutionAudit).values({
        collectorId: id,
        triggerType: "manual",
        status: "TRIGGERED",
        startedAt: new Date(),
      });

      return reply.send({ ok: true, collectorId: id, triggerType: "manual" });
    },
  );

  // ── POST /api/batch/jobs/:id/stop ──────────────────────────────────────────
  app.post(
    "/api/batch/jobs/:id/stop",
    { preHandler: [requireAuth, requireTenantAccess, requirePermission("batch_manage_jobs")] },
    async (req, reply) => {
      const id = Number((req.params as { id: string }).id);
      const db = app.db;

      await db.insert(tbJobExecutionAudit).values({
        collectorId: id,
        triggerType: "manual",
        status: "STOPPED",
        startedAt: new Date(),
        endedAt: new Date(),
      });

      return reply.send({ ok: true, collectorId: id, status: "STOPPED" });
    },
  );

  // ── POST /api/batch/jobs/:id/retry ─────────────────────────────────────────
  app.post(
    "/api/batch/jobs/:id/retry",
    { preHandler: [requireAuth, requireTenantAccess, requirePermission("batch_manage_jobs")] },
    async (req, reply) => {
      const id = Number((req.params as { id: string }).id);
      const db = app.db;

      await db.insert(tbJobExecutionAudit).values({
        collectorId: id,
        triggerType: "retry",
        status: "TRIGGERED",
        startedAt: new Date(),
      });

      return reply.send({ ok: true, collectorId: id, triggerType: "retry" });
    },
  );
}
