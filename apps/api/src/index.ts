import Fastify from "fastify";
import { createDb } from "@ops/db";
import { healthRoutes } from "./routes/health.js";

export const { db, end: closeDb } = createDb();

const app = Fastify({ logger: true });

await app.register(healthRoutes);

const port = parseInt(process.env.PORT ?? "3001", 10);
if (isNaN(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT: "${process.env.PORT}"`);
}
await app.listen({ port, host: "0.0.0.0" });
