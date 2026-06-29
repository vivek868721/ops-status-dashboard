import { createDb } from "@ops/db";
import { buildApp } from "./app.js";

export const { db, end: closeDb } = createDb();

const app = buildApp(db, { logger: true });

const port = parseInt(process.env.PORT ?? "3001", 10);
if (isNaN(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT: "${process.env.PORT}"`);
}
await app.listen({ port, host: "0.0.0.0" });
