#!/usr/bin/env bun
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL required"); process.exit(1); }

const sql = postgres(DATABASE_URL);

const existing = await sql`SELECT COUNT(*) FROM tb_raw_data`;
if (Number(existing[0].count) > 0) {
  console.log(`tb_raw_data already has ${existing[0].count} rows — skipping seed.`);
  await sql.end(); process.exit(0);
}

await sql`
  INSERT INTO tb_raw_data (batch_date, integration_id, tenant_id, collector_id, parse_yn, data)
  SELECT t.batch_date::date, t.integration_id, t.tenant_id::bigint, t.collector_id::int, t.parse_yn, t.data
  FROM (VALUES
    ('2026-07-01','JSM', 1, 1,'Y','{"issues":[{"id":"JSM-101","title":"Login page broken","status":"Open","priority":"High"},{"id":"JSM-102","title":"Export button missing","status":"In Progress","priority":"Medium"}],"total":2}'),
    ('2026-07-01','SAP', 1, 2,'N','{"orders":[{"orderId":"ORD-9901","amount":15200,"currency":"USD","status":"PENDING"},{"orderId":"ORD-9902","amount":8750,"currency":"USD","status":"COMPLETE"}],"total":2}'),
    ('2026-07-01','SNOW',1, 3,'Y','{"incidents":[{"number":"INC0001234","short_description":"VPN not connecting","state":"In Progress"},{"number":"INC0001235","short_description":"Printer offline","state":"New"}],"count":2}'),
    ('2026-06-30','JSM', 1, 1,'Y','{"issues":[{"id":"JSM-099","title":"Dashboard load slow","status":"Resolved","priority":"Low"}],"total":1}'),
    ('2026-06-30','SAP', 1, 2,'Y','{"orders":[{"orderId":"ORD-9890","amount":22000,"currency":"USD","status":"COMPLETE"}],"total":1}')
  ) AS t(batch_date, integration_id, tenant_id, collector_id, parse_yn, data)
`;

const rows = await sql`SELECT id, batch_date, integration_id, tenant_id FROM tb_raw_data ORDER BY id`;
console.log("Seeded tb_raw_data:");
console.table(rows);
await sql.end();
