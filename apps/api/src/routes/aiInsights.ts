import type { FastifyInstance } from "fastify";
import { eq, desc, sql } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { jsmView, aiInsights } from "@ops/db";
import { requireAuth } from "../middleware/auth.js";
import { requireTenantAccess } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/permission.js";

function buildSnapshot(rows: typeof jsmView.$inferSelect[]) {
  const total = rows.length;
  const ontime = rows.filter((r) => r.isOntime === true).length;
  const slaRate = total > 0 ? Math.round((ontime / total) * 1000) / 10 : 0;
  const byType = Object.fromEntries(
    (["SR", "CR", "OC"] as const).map((t) => [t, rows.filter((r) => r.issueType === t).length]),
  );
  const openCount = rows.filter((r) => r.statusCategory !== "Done").length;
  const urgentOpen = rows.filter((r) => r.urgencyYn === "Y" && r.statusCategory !== "Done").length;
  return { total, slaRate, byType, openCount, urgentOpen };
}

export async function aiInsightRoutes(app: FastifyInstance) {
  app.get(
    "/api/ai-insights",
    { preHandler: [requireAuth, requireTenantAccess, requirePermission("view_ai_insights")] },
    async (req, reply) => {
      const { tenantId } = req.tenant;
      const rows = await app.db
        .select()
        .from(aiInsights)
        .where(eq(aiInsights.tenantId, tenantId))
        .orderBy(desc(aiInsights.generatedAt))
        .limit(10);
      return reply.send({ analyses: rows });
    },
  );

  app.post(
    "/api/ai-insights/analyze",
    { preHandler: [requireAuth, requireTenantAccess, requirePermission("view_ai_insights")] },
    async (req, reply) => {
      const { tenantId } = req.tenant;
      const db = app.db;
      const { customQuery } = (req.body as { customQuery?: string }) ?? {};

      const jsmRows = await db
        .select()
        .from(jsmView)
        .where(eq(jsmView.tenantId, tenantId));

      const snapshot = buildSnapshot(jsmRows);
      const inputSnapshot = JSON.stringify(snapshot);

      const prompt = [
        `Analyze this operations data and return ONLY valid JSON (no markdown, no code fences) with exactly two keys:`,
        `"insights" (array of {title, description, severity}) and "charts" (array of {type, title, data}).`,
        customQuery ? `Additional focus: ${customQuery}` : "",
        `Data: ${inputSnapshot}`,
      ]
        .filter(Boolean)
        .join("\n");

      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      });

      const text =
        message.content[0].type === "text" ? message.content[0].text : "{}";

      let parsed: { insights?: unknown; charts?: unknown } = {};
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { insights: [], charts: [] };
      }

      const [record] = await db
        .insert(aiInsights)
        .values({
          tenantId,
          inputSnapshot,
          insightsJson: JSON.stringify(parsed.insights ?? []),
          chartsJson: JSON.stringify(parsed.charts ?? []),
          customQuery: customQuery ?? null,
        })
        .returning();

      return reply.status(201).send(record);
    },
  );
}
