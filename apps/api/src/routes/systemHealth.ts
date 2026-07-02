import type { FastifyInstance } from "fastify";
import { eq, sql } from "drizzle-orm";
import { tbIntegrationCollector } from "@ops/db";
import { requireAuth } from "../middleware/auth.js";
import { requireTenantAccess } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/permission.js";

const GUARDS = [requireAuth, requireTenantAccess, requirePermission("batch_view_health")] as const;

/** Compute the next scheduled run from a cron expression (minute/hour/day resolution). */
function nextCronRun(cron: string): Date {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return new Date(Date.now() + 3600000);

  const [minExpr, hourExpr] = parts;
  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0, 0);

  const parseField = (expr: string, max: number): number[] => {
    if (expr === "*") return Array.from({ length: max }, (_, i) => i);
    if (expr.startsWith("*/")) {
      const step = parseInt(expr.slice(2), 10);
      return Array.from({ length: max }, (_, i) => i).filter((v) => v % step === 0);
    }
    return expr.split(",").flatMap((s) => {
      if (s.includes("-")) {
        const [lo, hi] = s.split("-").map(Number);
        return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
      }
      return [parseInt(s, 10)];
    });
  };

  const validMins = parseField(minExpr, 60);
  const validHours = parseField(hourExpr, 24);

  // Advance by 1 minute first so "next" is strictly in the future
  next.setMinutes(next.getMinutes() + 1);

  for (let tries = 0; tries < 1440; tries++) {
    if (validHours.includes(next.getHours()) && validMins.includes(next.getMinutes())) {
      return next;
    }
    next.setMinutes(next.getMinutes() + 1);
  }

  return new Date(Date.now() + 3600000);
}

export async function systemHealthRoutes(app: FastifyInstance) {
  app.get("/api/system/health", { preHandler: [...GUARDS] }, async (req, reply) => {
    const db = app.db;
    let dbConnected = false;
    let dbLatencyMs = 0;

    try {
      const start = Date.now();
      await db.execute(sql`SELECT 1`);
      dbLatencyMs = Date.now() - start;
      dbConnected = true;
    } catch {
      dbConnected = false;
    }

    return reply.send({
      status: dbConnected ? "ok" : "degraded",
      db: { connected: dbConnected, latencyMs: dbLatencyMs },
      checkedAt: new Date().toISOString(),
    });
  });

  app.get("/api/system/scheduler", { preHandler: [...GUARDS] }, async (req, reply) => {
    const { tenantId } = req.tenant;
    const db = app.db;

    const collectors = await db
      .select({
        collectorId: tbIntegrationCollector.collectorId,
        jobName: tbIntegrationCollector.jobName,
        cronSchedule: tbIntegrationCollector.cronSchedule,
        integrationId: tbIntegrationCollector.integrationId,
        lastRunAt: tbIntegrationCollector.lastRunAt,
      })
      .from(tbIntegrationCollector)
      .where(eq(tbIntegrationCollector.activeYn, "Y"))
      .orderBy(tbIntegrationCollector.collectorId)
      .limit(5);

    const nextRuns = collectors
      .filter((c) => c.cronSchedule)
      .map((c) => ({
        collectorId: c.collectorId,
        jobName: c.jobName,
        integrationId: c.integrationId,
        cronSchedule: c.cronSchedule,
        lastRunAt: c.lastRunAt?.toISOString() ?? null,
        nextRunAt: nextCronRun(c.cronSchedule!).toISOString(),
      }));

    void tenantId;
    return reply.send({ status: "active", nextRuns });
  });
}
