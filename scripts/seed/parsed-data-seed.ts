#!/usr/bin/env bun
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL required"); process.exit(1); }
const sql = postgres(DATABASE_URL);

const [{ cnt }] = await sql`SELECT COUNT(*) as cnt FROM tb_raw_data_detail`;
if (Number(cnt) > 0) {
  console.log(`tb_raw_data_detail already has ${cnt} rows — skipping.`);
  await sql.end(); process.exit(0);
}

// Pull existing raw data ids for tenant 1 (Acme)
const rawRows = await sql`SELECT id, integration_id FROM tb_raw_data WHERE tenant_id = 1 ORDER BY id LIMIT 5`;
if (rawRows.length === 0) {
  console.log("No tb_raw_data rows found for tenant 1 — skipping.");
  await sql.end(); process.exit(0);
}

let detailId = 1;
for (const raw of rawRows) {
  const fields = raw.integration_id === "JSM"
    ? [["issue_id", `JSM-10${raw.id}`], ["title", "Sample Issue"], ["status", "Open"], ["priority", "High"], ["assignee", "Alice Johnson"]]
    : raw.integration_id === "SAP"
    ? [["order_id", `ORD-${9900 + raw.id}`], ["amount", "15200"], ["currency", "USD"], ["status", "PENDING"]]
    : [["number", `INC000${1230 + raw.id}`], ["description", "Sample incident"], ["state", "In Progress"]];

  for (const [fname, fval] of fields) {
    await sql`
      INSERT INTO tb_raw_data_detail (id, raw_data_id, field_name, field_value)
      VALUES (${detailId++}, ${raw.id}, ${fname}, ${fval})
    `;
  }
}

console.log(`✓ tb_raw_data_detail: ${detailId - 1} rows seeded`);
await sql.end();
