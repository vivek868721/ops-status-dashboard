import type { FastifyInstance } from "fastify";
import { sql, eq, and } from "drizzle-orm";
import { tbRawDataDetail, tbRawData } from "@ops/db";
import { requireAuth } from "../middleware/auth.js";
import { requireTenantAccess } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/permission.js";

const GUARDS = [requireAuth, requireTenantAccess, requirePermission("batch_view_raw_data")] as const;

export async function batchParsedDataRoutes(app: FastifyInstance) {
  // ── CSV export — MUST be before /:id ─────────────────────────────────────
  app.get("/api/batch/parsed-data/export", { preHandler: [...GUARDS] }, async (req, reply) => {
    const { tenantId } = req.tenant;
    const { batchDate, integrationId, collectorId } = req.query as Record<string, string>;
    const db = app.db;

    const rows = await db
      .select({
        id: tbRawDataDetail.id,
        rawDataId: tbRawDataDetail.rawDataId,
        batchDate: tbRawData.batchDate,
        integrationId: tbRawData.integrationId,
        fieldName: tbRawDataDetail.fieldName,
        fieldValue: tbRawDataDetail.fieldValue,
      })
      .from(tbRawDataDetail)
      .innerJoin(tbRawData, eq(tbRawData.id, tbRawDataDetail.rawDataId))
      .where(
        and(
          eq(tbRawData.tenantId, tenantId),
          batchDate ? eq(tbRawData.batchDate, batchDate) : undefined,
          integrationId ? eq(tbRawData.integrationId, integrationId) : undefined,
          collectorId ? eq(tbRawData.collectorId, Number(collectorId)) : undefined,
        ),
      )
      .orderBy(tbRawDataDetail.id);

    const header = "id,rawDataId,batchDate,integrationId,fieldName,fieldValue\n";
    const body = rows
      .map((r) => `${r.id},${r.rawDataId},${r.batchDate ?? ""},${r.integrationId ?? ""},${r.fieldName ?? ""},${r.fieldValue ?? ""}`)
      .join("\n");

    reply
      .header("Content-Type", "text/csv")
      .header("Content-Disposition", "attachment; filename=parsed-data.csv")
      .send(header + body);
  });

  // ── List ──────────────────────────────────────────────────────────────────
  app.get("/api/batch/parsed-data", { preHandler: [...GUARDS] }, async (req, reply) => {
    const { tenantId } = req.tenant;
    const { batchDate, integrationId, collectorId, page = "1", limit = "20" } = req.query as Record<string, string>;
    const db = app.db;
    const offset = (Number(page) - 1) * Number(limit);

    const where = and(
      eq(tbRawData.tenantId, tenantId),
      batchDate ? eq(tbRawData.batchDate, batchDate) : undefined,
      integrationId ? eq(tbRawData.integrationId, integrationId) : undefined,
      collectorId ? eq(tbRawData.collectorId, Number(collectorId)) : undefined,
    );

    const [countRow] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(tbRawDataDetail)
      .innerJoin(tbRawData, eq(tbRawData.id, tbRawDataDetail.rawDataId))
      .where(where);

    const items = await db
      .select({
        id: tbRawDataDetail.id,
        rawDataId: tbRawDataDetail.rawDataId,
        fieldName: tbRawDataDetail.fieldName,
        fieldValue: tbRawDataDetail.fieldValue,
        createdAt: tbRawDataDetail.createdAt,
        batchDate: tbRawData.batchDate,
        integrationId: tbRawData.integrationId,
        collectorId: tbRawData.collectorId,
      })
      .from(tbRawDataDetail)
      .innerJoin(tbRawData, eq(tbRawData.id, tbRawDataDetail.rawDataId))
      .where(where)
      .orderBy(tbRawDataDetail.id)
      .limit(Number(limit))
      .offset(offset);

    return reply.send({ items, total: Number(countRow.total) });
  });

  // ── Detail ────────────────────────────────────────────────────────────────
  app.get("/api/batch/parsed-data/:id", { preHandler: [...GUARDS] }, async (req, reply) => {
    const { tenantId } = req.tenant;
    const { id } = req.params as { id: string };
    const db = app.db;

    const [row] = await db
      .select({
        id: tbRawDataDetail.id,
        rawDataId: tbRawDataDetail.rawDataId,
        fieldName: tbRawDataDetail.fieldName,
        fieldValue: tbRawDataDetail.fieldValue,
        createdAt: tbRawDataDetail.createdAt,
        batchDate: tbRawData.batchDate,
        integrationId: tbRawData.integrationId,
        collectorId: tbRawData.collectorId,
      })
      .from(tbRawDataDetail)
      .innerJoin(tbRawData, eq(tbRawData.id, tbRawDataDetail.rawDataId))
      .where(and(eq(tbRawDataDetail.id, Number(id)), eq(tbRawData.tenantId, tenantId)));

    if (!row) return reply.status(404).send({ error: "Not found" });
    return reply.send(row);
  });
}
