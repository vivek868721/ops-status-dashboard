#!/usr/bin/env bun
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

const tables = [
  "tb_raw_data_detail",
  "tb_integration_config",
  "tb_integration_parser",
  "tb_notification_config",
  "tb_notification_history",
  "tb_audit_log",
  "tb_integration_collector",
  "tb_raw_data",
];

for (const t of tables) {
  const [{ cnt }] = await sql`SELECT COUNT(*) as cnt FROM ${sql(t)}`;
  console.log(`${t}: ${cnt} rows`);
}

await sql.end();
