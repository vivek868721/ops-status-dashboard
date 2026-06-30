import type { FastifyInstance } from "fastify";
import { eq, and, sql, avg, count } from "drizzle-orm";
import { jsmView } from "@ops/db";
import { requireAuth } from "../middleware/auth.js";
import { requireTenantAccess } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/permission.js";

function toCsv(rows: typeof jsmView.$inferSelect[]): string {
  const cols = ["issueKey", "title", "statusCategory", "urgencyYn", "assigneeName", "isOntime", "totalLeadtime", "issueCreateDate", "resolutionDate"] as const;
  return [
    cols.join(","),
    ...rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? "")).join(",")),
  ].join("\n");
}

export async function serviceRequestRoutes(app: FastifyInstance) {
  app.get(
    "/api/service-requests",
    { preHandler: [requireAuth, requireTenantAccess, requirePermission("view_service_requests")] },
    async (req, reply) => {
      const { tenantId, role } = req.tenant;
      const db = app.db;

      const q = req.query as Record<string, string>;
      const conditions = [
        eq(jsmView.tenantId, tenantId),
        eq(jsmView.issueType, "SR"),
      ];

      if (q.status) conditions.push(eq(jsmView.statusCategory, q.status));
      if (q.urgency) conditions.push(eq(jsmView.urgencyYn, q.urgency));
      if (q.from) conditions.push(sql`${jsmView.issueCreateDate} >= ${q.from}::timestamp`);
      if (q.to) conditions.push(sql`${jsmView.issueCreateDate} <= ${q.to}::timestamp`);

      // Employee: scope to own JSM assignee ID only — overrides ?assignee= param
      if (role === "employee") {
        const jsmId = req.user.jsmAssigneeId;
        conditions.push(jsmId ? eq(jsmView.assigneeId, jsmId) : sql`1 = 0`);
      } else if (q.assignee) {
        conditions.push(eq(jsmView.assigneeId, q.assignee));
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

      const assigneeRows = await db
        .select({
          name: jsmView.assigneeName,
          count: count(),
        })
        .from(jsmView)
        .where(and(where, sql`${jsmView.assigneeName} IS NOT NULL`))
        .groupBy(jsmView.assigneeName)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(5);

      const slaRate =
        Number(slaRow?.total) > 0
          ? (Number(slaRow.ontime) / Number(slaRow.total)) * 100
          : 0;

      return reply.send({
        slaRate: Math.round(slaRate * 10) / 10,
        avgLeadtime: avgRow?.avg != null ? Math.round(Number(avgRow.avg) * 10) / 10 : 0,
        topAssignees: assigneeRows.map((r) => ({ name: r.name, count: Number(r.count) })),
        items,
      });
    },
  );

  app.get(
    "/api/service-requests/export",
    { preHandler: [requireAuth, requireTenantAccess, requirePermission("export_csv")] },
    async (req, reply) => {
      const { tenantId, role } = req.tenant;
      const conditions = [eq(jsmView.tenantId, tenantId), eq(jsmView.issueType, "SR")];
      if (role === "employee") {
        const jsmId = req.user.jsmAssigneeId;
        conditions.push(jsmId ? eq(jsmView.assigneeId, jsmId) : sql`1 = 0`);
      }
      const rows = await app.db.select().from(jsmView).where(and(...conditions)).orderBy(jsmView.issueCreateDate);
      return reply
        .header("Content-Type", "text/csv")
        .header("Content-Disposition", "attachment; filename=service-requests.csv")
        .send(toCsv(rows));
    },
  );
}
