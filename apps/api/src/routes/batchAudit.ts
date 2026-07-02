import type { FastifyInstance } from "fastify";
import { eq, sql } from "drizzle-orm";
import { tbAuditLog } from "@ops/db";
import { requireAuth } from "../middleware/auth.js";
import { requireTenantAccess } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/permission.js";

const GUARDS = [requireAuth, requireTenantAccess, requirePermission("batch_view_dashboard")] as const;

export async function batchAuditRoutes(app: FastifyInstance) {
  // ── CSV export — MUST be before nothing (no /:id here, but good habit) ──────
  app.get("/api/batch/audit/export", { preHandler: [...GUARDS] }, async (req, reply) => {
    const { action, module: mod } = req.query as Record<string, string>;
    const db = app.db;

    const where = buildWhere(action, mod);
    const rows = await db
      .select()
      .from(tbAuditLog)
      .where(where)
      .orderBy(tbAuditLog.auditId);

    const header = "auditId,action,module,oldValue,newValue,createdAt\n";
    const body = rows
      .map((r) =>
        [r.auditId, r.action, r.module, r.oldValue ?? "", r.newValue ?? "", r.createdAt?.toISOString() ?? ""]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");

    reply
      .header("Content-Type", "text/csv")
      .header("Content-Disposition", "attachment; filename=audit-log.csv")
      .send(header + body);
  });

  // ── List ──────────────────────────────────────────────────────────────────
  app.get("/api/batch/audit", { preHandler: [...GUARDS] }, async (req, reply) => {
    const { action, module: mod, page = "1", limit = "50" } = req.query as Record<string, string>;
    const db = app.db;
    const offset = (Number(page) - 1) * Number(limit);

    const where = buildWhere(action, mod);

    const [countRow] = await db.select({ total: sql<number>`COUNT(*)` }).from(tbAuditLog).where(where);
    const items = await db
      .select()
      .from(tbAuditLog)
      .where(where)
      .orderBy(tbAuditLog.auditId)
      .limit(Number(limit))
      .offset(offset);

    return reply.send({ items, total: Number(countRow.total) });
  });
}

function buildWhere(action?: string, mod?: string) {
  if (action && mod) return sql`${tbAuditLog.action} = ${action} AND ${tbAuditLog.module} = ${mod}`;
  if (action) return eq(tbAuditLog.action, action);
  if (mod) return eq(tbAuditLog.module, mod);
  return undefined;
}
