import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { tbRawData } from "@ops/db";
import { requireAuth } from "../middleware/auth.js";
import { requireTenantAccess } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/permission.js";

export async function batchRawDataRoutes(app: FastifyInstance) {
  const VIEW = [requireAuth, requireTenantAccess, requirePermission("batch_view_raw_data")] as const;

  // ── GET /api/batch/raw-data/export  (must come before /:id) ──────────────
  app.get(
    "/api/batch/raw-data/export",
    { preHandler: [...VIEW] },
    async (req, reply) => {
      const { tenantId } = req.tenant;
      const rows = await app.db
        .select()
        .from(tbRawData)
        .where(eq(tbRawData.tenantId, tenantId))
        .orderBy(tbRawData.id);

      reply.header("Content-Type", "application/json");
      reply.header("Content-Disposition", `attachment; filename="raw-data.json"`);
      return reply.send(JSON.stringify(rows, null, 2));
    },
  );

  // ── GET /api/batch/raw-data ───────────────────────────────────────────────
  app.get(
    "/api/batch/raw-data",
    { preHandler: [...VIEW] },
    async (req, reply) => {
      const { tenantId } = req.tenant;
      const q = req.query as { batchDate?: string; collectorId?: string; integrationId?: string };
      const db = app.db;

      const conditions = [eq(tbRawData.tenantId, tenantId)];
      if (q.batchDate) conditions.push(eq(tbRawData.batchDate, q.batchDate));
      if (q.collectorId) conditions.push(eq(tbRawData.collectorId, Number(q.collectorId)));
      if (q.integrationId) conditions.push(eq(tbRawData.integrationId, q.integrationId));

      const rows = await db
        .select({
          id: tbRawData.id,
          batchDate: tbRawData.batchDate,
          integrationId: tbRawData.integrationId,
          tenantId: tbRawData.tenantId,
          collectorId: tbRawData.collectorId,
          parseYn: tbRawData.parseYn,
          createdAt: tbRawData.createdAt,
        })
        .from(tbRawData)
        .where(and(...conditions))
        .orderBy(tbRawData.id);

      return reply.send({ items: rows, total: rows.length });
    },
  );

  // ── GET /api/batch/raw-data/:id ───────────────────────────────────────────
  app.get(
    "/api/batch/raw-data/:id",
    { preHandler: [...VIEW] },
    async (req, reply) => {
      const { tenantId } = req.tenant;
      const id = Number((req.params as { id: string }).id);
      const db = app.db;

      const [row] = await db
        .select()
        .from(tbRawData)
        .where(and(eq(tbRawData.id, id), eq(tbRawData.tenantId, tenantId)));

      if (!row) return reply.status(404).send({ error: "Not found" });
      return reply.send({ item: row });
    },
  );
}
