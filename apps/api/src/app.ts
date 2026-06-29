import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { authRoutes } from "./routes/auth.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppDb = any;

export function buildApp(db: AppDb) {
  const app = Fastify({ logger: false });

  app.register(cookie, {
    secret: process.env.SESSION_SECRET ?? "dev-secret-change-in-production",
  });

  app.decorate("db", db);

  app.get("/api/health", async () => ({ status: "ok" }));
  app.register(authRoutes);

  return app;
}
