import type { FastifyInstance } from "fastify";
import { eq, sql } from "drizzle-orm";
import { tbNotificationConfig, tbNotificationHistory } from "@ops/db";
import { requireAuth } from "../middleware/auth.js";
import { requireTenantAccess } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/permission.js";

const GUARDS = [requireAuth, requireTenantAccess, requirePermission("batch_view_dashboard")] as const;

export async function batchNotificationsRoutes(app: FastifyInstance) {
  // ── Config CRUD ─────────────────────────────────────────────────────────────

  app.get("/api/batch/notifications/config", { preHandler: [...GUARDS] }, async (req, reply) => {
    const { tenantId } = req.tenant;
    const configs = await app.db
      .select()
      .from(tbNotificationConfig)
      .where(eq(tbNotificationConfig.tenantId, tenantId))
      .orderBy(tbNotificationConfig.configId);
    return reply.send({ configs });
  });

  app.post("/api/batch/notifications/config", { preHandler: [...GUARDS] }, async (req, reply) => {
    const { tenantId } = req.tenant;
    const body = req.body as { channel: string; configJson: string; enabled?: boolean };
    const [config] = await app.db
      .insert(tbNotificationConfig)
      .values({ tenantId, channel: body.channel, configJson: body.configJson, enabled: body.enabled ?? true })
      .returning();
    return reply.status(201).send({ config });
  });

  app.put("/api/batch/notifications/config/:id", { preHandler: [...GUARDS] }, async (req, reply) => {
    const { tenantId } = req.tenant;
    const { id } = req.params as { id: string };
    const body = req.body as { channel?: string; configJson?: string; enabled?: boolean };
    const updates: Record<string, unknown> = {};
    if (body.channel !== undefined) updates.channel = body.channel;
    if (body.configJson !== undefined) updates.configJson = body.configJson;
    if (body.enabled !== undefined) updates.enabled = body.enabled;
    updates.updatedAt = sql`NOW()`;

    const [config] = await app.db
      .update(tbNotificationConfig)
      .set(updates)
      .where(eq(tbNotificationConfig.configId, Number(id)))
      .returning();

    if (!config || config.tenantId !== tenantId) return reply.status(404).send({ error: "Not found" });
    return reply.send({ config });
  });

  app.delete("/api/batch/notifications/config/:id", { preHandler: [...GUARDS] }, async (req, reply) => {
    const { tenantId } = req.tenant;
    const { id } = req.params as { id: string };
    const [existing] = await app.db
      .select({ configId: tbNotificationConfig.configId })
      .from(tbNotificationConfig)
      .where(eq(tbNotificationConfig.configId, Number(id)));

    if (!existing) return reply.status(404).send({ error: "Not found" });

    await app.db.delete(tbNotificationHistory).where(eq(tbNotificationHistory.configId, Number(id)));
    await app.db.delete(tbNotificationConfig).where(eq(tbNotificationConfig.configId, Number(id)));
    void tenantId;
    return reply.send({ ok: true });
  });

  // ── History (read-only) ─────────────────────────────────────────────────────

  app.get("/api/batch/notifications/history", { preHandler: [...GUARDS] }, async (req, reply) => {
    const { tenantId } = req.tenant;
    const history = await app.db
      .select({
        historyId: tbNotificationHistory.historyId,
        configId: tbNotificationHistory.configId,
        status: tbNotificationHistory.status,
        message: tbNotificationHistory.message,
        createdAt: tbNotificationHistory.createdAt,
        channel: tbNotificationConfig.channel,
      })
      .from(tbNotificationHistory)
      .innerJoin(tbNotificationConfig, eq(tbNotificationConfig.configId, tbNotificationHistory.configId))
      .where(eq(tbNotificationConfig.tenantId, tenantId))
      .orderBy(tbNotificationHistory.historyId);
    return reply.send({ history });
  });
}
