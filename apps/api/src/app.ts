import Fastify from "fastify";
import cookie from "@fastify/cookie";
import type { PgDatabase } from "drizzle-orm/pg-core/db";
import { authRoutes } from "./routes/auth.js";
import { tenantRoutes } from "./routes/tenants.js";
import { overviewRoutes } from "./routes/overview.js";
import { serviceRequestRoutes } from "./routes/serviceRequests.js";
import { changeRequestRoutes } from "./routes/changeRequests.js";
import { operationalChangeRoutes } from "./routes/operationalChanges.js";
import { adminRoutes } from "./routes/admin.js";
import { aiInsightRoutes } from "./routes/aiInsights.js";
import { batchDashboardRoutes } from "./routes/batchDashboard.js";
import { batchJobsRoutes } from "./routes/batchJobs.js";
import { batchHistoryRoutes } from "./routes/batchHistory.js";
import { batchRawDataRoutes } from "./routes/batchRawData.js";

export type AppDb = PgDatabase<any, any, any>;

declare module "fastify" {
  interface FastifyInstance {
    db: AppDb;
  }
}

export function buildApp(db: AppDb, opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? false });

  app.register(cookie, {
    secret: process.env.SESSION_SECRET ?? "dev-secret-change-in-production",
  });

  app.decorate("db", db);

  app.get("/api/health", async () => ({ status: "ok" }));
  app.register(authRoutes);
  app.register(tenantRoutes);
  app.register(overviewRoutes);
  app.register(serviceRequestRoutes);
  app.register(changeRequestRoutes);
  app.register(operationalChangeRoutes);
  app.register(adminRoutes);
  app.register(aiInsightRoutes);
  app.register(batchDashboardRoutes);
  app.register(batchJobsRoutes);
  app.register(batchHistoryRoutes);
  app.register(batchRawDataRoutes);

  return app;
}
