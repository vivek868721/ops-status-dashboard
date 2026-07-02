#!/usr/bin/env bun
/**
 * One-time migration: adapts the Windows PostgreSQL ops_dashboard schema
 * to match the current app schema.
 */
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL required"); process.exit(1); }
const sql = postgres(DATABASE_URL);

console.log("==> Adapting Windows PostgreSQL schema...");

// 1. Add missing columns to admin_users
await sql.unsafe(`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT NULL CHECK (role IN ('super_admin'))`);
await sql.unsafe(`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS jsm_assignee_id TEXT DEFAULT NULL`);
// Migrate is_super_admin → role
await sql.unsafe(`UPDATE admin_users SET role = 'super_admin' WHERE is_super_admin = true AND role IS NULL`);
console.log("  ✓ admin_users: added role, jsm_assignee_id");

// 2. Add system_role to user_tenant_roles (the administrative role — separate from data-access)
await sql.unsafe(`ALTER TABLE user_tenant_roles ADD COLUMN IF NOT EXISTS system_role TEXT NOT NULL DEFAULT 'member' CHECK (system_role IN ('tenant_admin','operator','member'))`);
// Map old data-access role → administrative system_role
await sql.unsafe(`UPDATE user_tenant_roles SET system_role = CASE WHEN role IN ('executive','it_manager') THEN 'tenant_admin' ELSE 'member' END WHERE system_role = 'member'`);
console.log("  ✓ user_tenant_roles: added system_role");

// 3. Populate user_permissions from old user_tenant_roles.role (data-access permissions)
await sql.unsafe(`
  INSERT INTO user_permissions (user_id, permission)
  SELECT DISTINCT user_id, role
  FROM user_tenant_roles
  WHERE role IN ('executive','it_manager','employee')
  ON CONFLICT (user_id, permission) DO NOTHING
`);
console.log("  ✓ user_permissions: seeded from user_tenant_roles");

// 4. Add updated_at to role_permissions if missing
await sql.unsafe(`ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()`);
console.log("  ✓ role_permissions: added updated_at");

// 5. Add batch permission keys to role_permissions
const batchKeys = [
  { role: "executive",  key: "batch_view_dashboard", enabled: true  },
  { role: "it_manager", key: "batch_view_dashboard", enabled: true  },
  { role: "employee",   key: "batch_view_dashboard", enabled: false },
  { role: "executive",  key: "batch_manage_jobs",    enabled: false },
  { role: "it_manager", key: "batch_manage_jobs",    enabled: true  },
  { role: "employee",   key: "batch_manage_jobs",    enabled: false },
  { role: "executive",  key: "batch_view_raw_data",  enabled: false },
  { role: "it_manager", key: "batch_view_raw_data",  enabled: true  },
  { role: "employee",   key: "batch_view_raw_data",  enabled: false },
  { role: "executive",  key: "batch_view_health",    enabled: false },
  { role: "it_manager", key: "batch_view_health",    enabled: true  },
  { role: "employee",   key: "batch_view_health",    enabled: false },
];
for (const k of batchKeys) {
  await sql.unsafe(`INSERT INTO role_permissions (role, permission_key, enabled) VALUES ('${k.role}','${k.key}',${k.enabled}) ON CONFLICT (role, permission_key) DO NOTHING`);
}
console.log("  ✓ role_permissions: batch keys seeded");

// 6. Add unique constraint on user_tenant_roles if missing
await sql.unsafe(`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'user_tenant_roles_user_id_tenant_id_key'
    ) THEN
      ALTER TABLE user_tenant_roles ADD CONSTRAINT user_tenant_roles_user_id_tenant_id_key UNIQUE (user_id, tenant_id);
    END IF;
  END $$
`);
console.log("  ✓ user_tenant_roles: unique constraint ensured");

// 7. Seed tb_integration_collector if empty
const [{ cnt }] = await sql`SELECT COUNT(*) as cnt FROM tb_integration_collector`;
if (Number(cnt) === 0) {
  await sql.unsafe(`
    INSERT INTO tb_integration_collector (job_name, cron_schedule, integration_id, tenant_id, active_yn, last_run_at) VALUES
    ('JSM_Acme_Collector',   '0 * * * *',   'JSM',  1, 'Y', NOW() - INTERVAL '45 minutes'),
    ('SAP_Acme_Collector',   '0 */2 * * *', 'SAP',  1, 'Y', NOW() - INTERVAL '1 hour'),
    ('SNOW_Acme_Collector',  '30 * * * *',  'SNOW', 1, 'Y', NOW() - INTERVAL '25 minutes'),
    ('JSM_TechNova_Collector','15 * * * *', 'JSM',  2, 'Y', NOW() - INTERVAL '30 minutes'),
    ('SAP_TechNova_Collector','0 */3 * * *','SAP',  2, 'Y', NOW() - INTERVAL '2 hours'),
    ('JSM_BlueWave_Collector','0 * * * *',  'JSM',  3, 'Y', NOW() - INTERVAL '55 minutes')
  `);
  console.log("  ✓ tb_integration_collector: 6 collectors seeded");
} else {
  console.log(`  ✓ tb_integration_collector: already has ${cnt} rows`);
}

// 8. Seed tb_raw_data if empty
const [{ cnt: rawCnt }] = await sql`SELECT COUNT(*) as cnt FROM tb_raw_data`;
if (Number(rawCnt) === 0) {
  await sql.unsafe(`
    INSERT INTO tb_raw_data (batch_date, integration_id, tenant_id, collector_id, parse_yn, data) VALUES
    ('2026-07-01','JSM', 1,1,'Y','{"issues":[{"id":"JSM-101","title":"Login page broken","status":"Open","priority":"High"},{"id":"JSM-102","title":"Export button missing","status":"In Progress","priority":"Medium"}],"total":2}'),
    ('2026-07-01','SAP', 1,2,'N','{"orders":[{"orderId":"ORD-9901","amount":15200,"currency":"USD","status":"PENDING"},{"orderId":"ORD-9902","amount":8750,"currency":"USD","status":"COMPLETE"}],"total":2}'),
    ('2026-07-01','SNOW',1,3,'Y','{"incidents":[{"number":"INC0001234","short_description":"VPN not connecting","state":"In Progress"},{"number":"INC0001235","short_description":"Printer offline","state":"New"}],"count":2}'),
    ('2026-06-30','JSM', 1,1,'Y','{"issues":[{"id":"JSM-099","title":"Dashboard load slow","status":"Resolved","priority":"Low"}],"total":1}'),
    ('2026-06-30','SAP', 1,2,'Y','{"orders":[{"orderId":"ORD-9890","amount":22000,"currency":"USD","status":"COMPLETE"}],"total":1}'),
    ('2026-07-01','JSM', 2,4,'N','{"issues":[{"id":"JSM-200","title":"Access denied on portal","status":"Open","priority":"Critical"}],"total":1}'),
    ('2026-07-01','JSM', 3,6,'N','{"issues":[{"id":"JSM-301","title":"MFA setup failing","status":"Open","priority":"High"}],"total":1}')
  `);
  console.log("  ✓ tb_raw_data: 7 records seeded");
} else {
  console.log(`  ✓ tb_raw_data: already has ${rawCnt} rows`);
}

// Summary
console.log("\n==> Migration complete.");
const users = await sql`SELECT email, role FROM admin_users ORDER BY id`;
const perms = await sql`SELECT u.email, up.permission FROM user_permissions up JOIN admin_users u ON u.id=up.user_id ORDER BY u.email`;
console.log("\nUsers:");
users.forEach(u => console.log(` ${u.email} — ${u.role ?? 'regular'}`));
console.log("\nData-access permissions:");
perms.forEach(p => console.log(` ${p.email}: ${p.permission}`));

await sql.end();
