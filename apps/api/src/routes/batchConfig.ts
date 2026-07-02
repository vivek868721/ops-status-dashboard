import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { tbIntegrationCollector, tbIntegrationConfig, tbIntegrationParser } from "@ops/db";
import { requireAuth } from "../middleware/auth.js";
import { requireSuperAdmin } from "../middleware/superAdmin.js";

const GUARDS = [requireAuth, requireSuperAdmin] as const;

const CREDENTIAL_KEYS = ["accessKey", "secretKey", "token", "apiKey"] as const;

function maskCredentials<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj } as Record<string, unknown>;
  for (const key of CREDENTIAL_KEYS) {
    if (out[key] != null) out[key] = "***";
  }
  return out as T;
}

export async function batchConfigRoutes(app: FastifyInstance) {
  // ── Collectors ─────────────────────────────────────────────────────────────

  app.get("/api/batch/collectors", { preHandler: [...GUARDS] }, async (req, reply) => {
    const db = app.db;
    const collectors = await db.select().from(tbIntegrationCollector).orderBy(tbIntegrationCollector.collectorId);
    return reply.send({ collectors });
  });

  app.post("/api/batch/collectors", { preHandler: [...GUARDS] }, async (req, reply) => {
    const db = app.db;
    const body = req.body as {
      jobName: string; cronSchedule?: string; integrationId?: string;
      tenantId?: number; activeYn?: string;
    };
    const [collector] = await db
      .insert(tbIntegrationCollector)
      .values({
        jobName: body.jobName,
        cronSchedule: body.cronSchedule ?? null,
        integrationId: body.integrationId ?? null,
        tenantId: body.tenantId ?? null,
        activeYn: body.activeYn ?? "Y",
      })
      .returning();
    return reply.status(201).send({ collector });
  });

  app.put("/api/batch/collectors/:id", { preHandler: [...GUARDS] }, async (req, reply) => {
    const db = app.db;
    const { id } = req.params as { id: string };
    const body = req.body as { cronSchedule?: string; activeYn?: string; jobName?: string };
    const updates: Record<string, unknown> = {};
    if (body.cronSchedule !== undefined) updates.cronSchedule = body.cronSchedule;
    if (body.activeYn !== undefined) updates.activeYn = body.activeYn;
    if (body.jobName !== undefined) updates.jobName = body.jobName;

    const [collector] = await db
      .update(tbIntegrationCollector)
      .set(updates)
      .where(eq(tbIntegrationCollector.collectorId, Number(id)))
      .returning();

    if (!collector) return reply.status(404).send({ error: "Not found" });
    return reply.send({ collector });
  });

  app.delete("/api/batch/collectors/:id", { preHandler: [...GUARDS] }, async (req, reply) => {
    const db = app.db;
    const { id } = req.params as { id: string };
    await db.delete(tbIntegrationCollector).where(eq(tbIntegrationCollector.collectorId, Number(id)));
    return reply.send({ ok: true });
  });

  // ── Integration Config ──────────────────────────────────────────────────────

  app.get("/api/batch/integration-config", { preHandler: [...GUARDS] }, async (req, reply) => {
    const db = app.db;
    const rows = await db.select().from(tbIntegrationConfig).orderBy(tbIntegrationConfig.configId);
    return reply.send({ configs: rows.map(maskCredentials) });
  });

  app.post("/api/batch/integration-config", { preHandler: [...GUARDS] }, async (req, reply) => {
    const db = app.db;
    const body = req.body as {
      integrationId: string; tenantId?: number; baseUrl?: string; authType?: string;
      accessKey?: string; secretKey?: string; token?: string; apiKey?: string;
    };
    const [config] = await db
      .insert(tbIntegrationConfig)
      .values({
        integrationId: body.integrationId,
        tenantId: body.tenantId ?? null,
        baseUrl: body.baseUrl ?? null,
        authType: body.authType ?? null,
        accessKey: body.accessKey ?? null,
        secretKey: body.secretKey ?? null,
        token: body.token ?? null,
        apiKey: body.apiKey ?? null,
      })
      .returning();
    return reply.status(201).send({ config: maskCredentials(config) });
  });

  app.put("/api/batch/integration-config/:id", { preHandler: [...GUARDS] }, async (req, reply) => {
    const db = app.db;
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    const [config] = await db
      .update(tbIntegrationConfig)
      .set(body)
      .where(eq(tbIntegrationConfig.configId, Number(id)))
      .returning();
    if (!config) return reply.status(404).send({ error: "Not found" });
    return reply.send({ config: maskCredentials(config) });
  });

  app.delete("/api/batch/integration-config/:id", { preHandler: [...GUARDS] }, async (req, reply) => {
    const db = app.db;
    const { id } = req.params as { id: string };
    await db.delete(tbIntegrationConfig).where(eq(tbIntegrationConfig.configId, Number(id)));
    return reply.send({ ok: true });
  });

  // ── Parsers ─────────────────────────────────────────────────────────────────

  app.get("/api/batch/parsers", { preHandler: [...GUARDS] }, async (req, reply) => {
    const db = app.db;
    const parsers = await db.select().from(tbIntegrationParser).orderBy(tbIntegrationParser.parserId);
    return reply.send({ parsers });
  });

  app.post("/api/batch/parsers", { preHandler: [...GUARDS] }, async (req, reply) => {
    const db = app.db;
    const body = req.body as { integrationId: string; tenantId?: number; parserClass?: string; configJson?: string };
    const [parser] = await db
      .insert(tbIntegrationParser)
      .values({
        integrationId: body.integrationId,
        tenantId: body.tenantId ?? null,
        parserClass: body.parserClass ?? null,
        configJson: body.configJson ?? null,
      })
      .returning();
    return reply.status(201).send({ parser });
  });

  app.put("/api/batch/parsers/:id", { preHandler: [...GUARDS] }, async (req, reply) => {
    const db = app.db;
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    const [parser] = await db
      .update(tbIntegrationParser)
      .set(body)
      .where(eq(tbIntegrationParser.parserId, Number(id)))
      .returning();
    if (!parser) return reply.status(404).send({ error: "Not found" });
    return reply.send({ parser });
  });

  app.delete("/api/batch/parsers/:id", { preHandler: [...GUARDS] }, async (req, reply) => {
    const db = app.db;
    const { id } = req.params as { id: string };
    await db.delete(tbIntegrationParser).where(eq(tbIntegrationParser.parserId, Number(id)));
    return reply.send({ ok: true });
  });
}
