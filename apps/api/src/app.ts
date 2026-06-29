import Fastify from "fastify";
import cookie from "@fastify/cookie";
import type { PgDatabase } from "drizzle-orm/pg-core/db";
import { authRoutes } from "./routes/auth.js";

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

  return app;
}
