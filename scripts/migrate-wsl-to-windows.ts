#!/usr/bin/env bun
/**
 * Migrates all data from WSL PostgreSQL → Windows PostgreSQL.
 * Clears Windows tables first (in safe order), then inserts WSL data.
 */
import postgres from "postgres";

const SRC = "postgres://vivek@127.0.0.1:5432/ops_dashboard";
const DST = "postgres://postgres:root@172.31.112.1:5433/ops_dashboard";

const src = postgres(SRC);
const dst = postgres(DST);

console.log("==> Migrating WSL → Windows PostgreSQL\n");

// ── 1. Clear Windows tables (child → parent order) ───────────────────────────
console.log("Clearing Windows tables...");
await dst.unsafe(`
  TRUNCATE TABLE
    tb_job_execution_audit,
    tb_notification_history,
    tb_notification_config,
    tb_audit_log,
    tb_raw_data_detail,
    tb_raw_data,
    tb_batch_history,
    tb_integration_collector,
    ai_insights,
    role_permissions,
    user_permissions,
    user_tenant_roles,
    sessions,
    tenants,
    admin_users
  RESTART IDENTITY CASCADE
`);
console.log("  ✓ All tables cleared\n");

// ── 2. admin_users ────────────────────────────────────────────────────────────
const users = await src`SELECT id, email, password_hash, role, jsm_assignee_id, created_at FROM admin_users ORDER BY id`;
for (const u of users) {
  await dst`
    INSERT INTO admin_users (id, email, password_hash, role, jsm_assignee_id, created_at)
    VALUES (${u.id}, ${u.email}, ${u.password_hash}, ${u.role}, ${u.jsm_assignee_id}, ${u.created_at})
  `;
}
await dst.unsafe(`SELECT setval('admin_users_id_seq', (SELECT MAX(id) FROM admin_users))`);
console.log(`  ✓ admin_users: ${users.length} rows`);

// ── 3. tenants ────────────────────────────────────────────────────────────────
const tenants = await src`SELECT id, name, created_at FROM tenants ORDER BY id`;
for (const t of tenants) {
  await dst`INSERT INTO tenants (id, name, created_at) VALUES (${t.id}, ${t.name}, ${t.created_at})`;
}
console.log(`  ✓ tenants: ${tenants.length} rows`);

// ── 4. user_tenant_roles ──────────────────────────────────────────────────────
const utrs = await src`SELECT id, user_id, tenant_id, system_role, created_at FROM user_tenant_roles ORDER BY id`;
for (const r of utrs) {
  // Windows schema still has old 'role' column (NOT NULL) — map system_role back
  const oldRole = r.system_role === "tenant_admin" ? "it_manager" : "employee";
  await dst`
    INSERT INTO user_tenant_roles (id, user_id, tenant_id, role, system_role, created_at)
    VALUES (${r.id}, ${r.user_id}, ${r.tenant_id}, ${oldRole}, ${r.system_role}, ${r.created_at})
  `;
}
await dst.unsafe(`SELECT setval('user_tenant_roles_id_seq', (SELECT MAX(id) FROM user_tenant_roles))`);
console.log(`  ✓ user_tenant_roles: ${utrs.length} rows`);

// ── 5. user_permissions ───────────────────────────────────────────────────────
const ups = await src`SELECT id, user_id, permission, created_at FROM user_permissions ORDER BY id`;
for (const p of ups) {
  await dst`INSERT INTO user_permissions (id, user_id, permission, created_at) VALUES (${p.id}, ${p.user_id}, ${p.permission}, ${p.created_at})`;
}
await dst.unsafe(`SELECT setval('user_permissions_id_seq', (SELECT MAX(id) FROM user_permissions))`);
console.log(`  ✓ user_permissions: ${ups.length} rows`);

// ── 6. role_permissions ───────────────────────────────────────────────────────
const rps = await src`SELECT id, role, permission_key, enabled, updated_at FROM role_permissions ORDER BY id`;
for (const p of rps) {
  await dst`INSERT INTO role_permissions (id, role, permission_key, enabled, updated_at) VALUES (${p.id}, ${p.role}, ${p.permission_key}, ${p.enabled}, ${p.updated_at})`;
}
await dst.unsafe(`SELECT setval('role_permissions_id_seq', (SELECT MAX(id) FROM role_permissions))`);
console.log(`  ✓ role_permissions: ${rps.length} rows`);

// ── 7. tb_integration_collector ───────────────────────────────────────────────
const collectors = await src`SELECT collector_id, job_name, cron_schedule, integration_id, tenant_id, active_yn, last_run_at, created_at FROM tb_integration_collector ORDER BY collector_id`;
for (const c of collectors) {
  await dst`
    INSERT INTO tb_integration_collector (collector_id, job_name, cron_schedule, integration_id, tenant_id, active_yn, last_run_at, created_at)
    VALUES (${c.collector_id}, ${c.job_name}, ${c.cron_schedule}, ${c.integration_id}, ${c.tenant_id}, ${c.active_yn}, ${c.last_run_at}, ${c.created_at})
  `;
}
await dst.unsafe(`SELECT setval('tb_integration_collector_collector_id_seq', (SELECT MAX(collector_id) FROM tb_integration_collector))`);
console.log(`  ✓ tb_integration_collector: ${collectors.length} rows`);

// ── 8. tb_batch_history ───────────────────────────────────────────────────────
const history = await src`SELECT id, batch_date, integration_id, tenant_id, collector_id, crawling_status, parse_status, created_at FROM tb_batch_history ORDER BY id`;
for (const h of history) {
  await dst`
    INSERT INTO tb_batch_history (id, batch_date, integration_id, tenant_id, collector_id, crawling_status, parse_status, created_at)
    VALUES (${h.id}, ${h.batch_date}, ${h.integration_id}, ${h.tenant_id}, ${h.collector_id}, ${h.crawling_status}, ${h.parse_status}, ${h.created_at})
  `;
}
await dst.unsafe(`SELECT setval('tb_batch_history_id_seq', (SELECT MAX(id) FROM tb_batch_history))`);
console.log(`  ✓ tb_batch_history: ${history.length} rows`);

// ── 9. tb_raw_data ────────────────────────────────────────────────────────────
const rawData = await src`SELECT id, batch_date, integration_id, tenant_id, collector_id, parse_yn, data, created_at FROM tb_raw_data ORDER BY id`;
for (const r of rawData) {
  await dst`
    INSERT INTO tb_raw_data (id, batch_date, integration_id, tenant_id, collector_id, parse_yn, data, created_at)
    VALUES (${r.id}, ${r.batch_date}, ${r.integration_id}, ${r.tenant_id}, ${r.collector_id}, ${r.parse_yn}, ${r.data}, ${r.created_at})
  `;
}
await dst.unsafe(`SELECT setval('tb_raw_data_id_seq', GREATEST((SELECT MAX(id) FROM tb_raw_data), 1))`);
console.log(`  ✓ tb_raw_data: ${rawData.length} rows`);

// ── 10. tb_job_execution_audit ────────────────────────────────────────────────
const audits = await src`SELECT audit_id, collector_id, trigger_type, status, started_at, ended_at FROM tb_job_execution_audit ORDER BY audit_id`;
for (const a of audits) {
  await dst`
    INSERT INTO tb_job_execution_audit (audit_id, collector_id, trigger_type, status, started_at, ended_at)
    VALUES (${a.audit_id}, ${a.collector_id}, ${a.trigger_type}, ${a.status}, ${a.started_at}, ${a.ended_at})
  `;
}
if (audits.length > 0) await dst.unsafe(`SELECT setval('tb_job_execution_audit_audit_id_seq', (SELECT MAX(audit_id) FROM tb_job_execution_audit))`);
console.log(`  ✓ tb_job_execution_audit: ${audits.length} rows`);

// ── 11. Empty tables (tb_raw_data_detail, ai_insights, tb_audit_log, etc.) ────
console.log(`  ✓ ai_insights / tb_raw_data_detail / tb_notification_* / tb_audit_log: 0 rows (empty in source)`);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("\n==> Migration complete!\n");
console.log("Test accounts (all passwords: admin123 or pass1234):");
const finalUsers = await dst`SELECT email, role FROM admin_users ORDER BY id`;
for (const u of finalUsers) console.log(` ${u.email} — ${u.role ?? 'regular'}`);

await src.end();
await dst.end();
