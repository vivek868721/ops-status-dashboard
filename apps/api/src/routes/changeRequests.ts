import type { FastifyInstance } from "fastify";
import { eq, and, sql, count } from "drizzle-orm";
import { jsmView } from "@ops/db";
import { requireAuth } from "../middleware/auth.js";
import { requireTenantAccess } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/permission.js";

function toCsv(rows: typeof jsmView.$inferSelect[]): string {
  const cols = ["issueKey", "title", "statusCategory", "chgCategory", "assigneeName", "isOntime", "issueCreateDate", "resolutionDate"] as const;
  return [
    cols.join(","),
    ...rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? "")).join(",")),
  ].join("\n");
}

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

      // Employee: scope to own JSM assignee ID only
      if (role === "employee") {
        const jsmId = req.user.jsmAssigneeId;
        conditions.push(jsmId ? eq(jsmView.assigneeId, jsmId) : sql`1 = 0`);
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

      // Return per-category totals with on-time / not-on-time breakdown
      const categoryRows = await db
        .select({
          category: jsmView.chgCategory,
          total: sql<number>`COUNT(*)`,
          ontime: sql<number>`COUNT(*) FILTER (WHERE ${jsmView.isOntime} = true)`,
          overdue: sql<number>`COUNT(*) FILTER (WHERE ${jsmView.isOntime} = false)`,
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
        byCategory: categoryRows.map((r) => ({
          category: r.category,
          total: Number(r.total),
          ontime: Number(r.ontime),
          overdue: Number(r.overdue),
        })),
        items,
      });
    },
  );

  app.get(
    "/api/change-requests/export",
    { preHandler: [requireAuth, requireTenantAccess, requirePermission("export_csv")] },
    async (req, reply) => {
      const { tenantId, role } = req.tenant;
      const conditions = [eq(jsmView.tenantId, tenantId), eq(jsmView.issueType, "CR")];
      if (role === "employee") {
        const jsmId = req.user.jsmAssigneeId;
        conditions.push(jsmId ? eq(jsmView.assigneeId, jsmId) : sql`1 = 0`);
      }
      const rows = await app.db.select().from(jsmView).where(and(...conditions)).orderBy(jsmView.issueCreateDate);
      return reply
        .header("Content-Type", "text/csv")
        .header("Content-Disposition", "attachment; filename=change-requests.csv")
        .send(toCsv(rows));
    },
  );
}
