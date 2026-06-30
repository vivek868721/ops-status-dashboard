import { createDb } from "@ops/db";
import { buildApp } from "./app.js";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!process.env.ANTHROPIC_API_KEY) console.warn("Warning: ANTHROPIC_API_KEY not set — AI Insights will return mock data");

export const { db, end: closeDb } = createDb();

const app = buildApp(db, { logger: true });

const port = parseInt(process.env.PORT ?? "3001", 10);
if (isNaN(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT: "${process.env.PORT}"`);
}
await app.listen({ port, host: "0.0.0.0" });
