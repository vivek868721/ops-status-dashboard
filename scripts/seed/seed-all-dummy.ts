#!/usr/bin/env bun
/**
 * Seeds all missing dummy data into Windows PostgreSQL for UI testing.
 * Safe to re-run — skips tables that already have rows.
 */
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

// ── 1. tb_integration_config ─────────────────────────────────────────────────

const [{ icnt }] = await sql`SELECT COUNT(*) as icnt FROM tb_integration_config`;
if (Number(icnt) === 0) {
  await sql.unsafe(`
    INSERT INTO tb_integration_config
      (config_id, integration_id, tenant_id, base_url, auth_type, access_key, secret_key, token, api_key)
    VALUES
      (1, 'JSM',  1, 'https://acme.atlassian.net',           'basic',   'AKID_ACME_JSM',  'secret_jsm_acme',  NULL,                    NULL),
      (2, 'SAP',  1, 'https://api.sap.acme.com/v1',          'bearer',  NULL,              NULL,               'eyJhbGciOiJSUzI1Ni...', NULL),
      (3, 'SNOW', 1, 'https://acme.service-now.com/api',     'basic',   'snow_api_user',   'snow_pass_123',    NULL,                    NULL),
      (4, 'JSM',  2, 'https://globaltech.atlassian.net',     'api_key', NULL,              NULL,               NULL,                    'apikey_gt_jsm_2024'),
      (5, 'SAP',  2, 'https://api.sap.globaltech.com/v1',    'bearer',  NULL,              NULL,               'eyJhbGciOiJSUzI1Ni...', NULL),
      (6, 'JSM',  3, 'https://nexus.atlassian.net',          'basic',   'nexus_jsm_usr',   'nexus_pass_abc',   NULL,                    NULL)
  `);
  console.log("✓ tb_integration_config: 6 rows");
} else {
  console.log(`  tb_integration_config: already ${icnt} rows — skip`);
}

// ── 2. tb_integration_parser ─────────────────────────────────────────────────

const [{ pcnt }] = await sql`SELECT COUNT(*) as pcnt FROM tb_integration_parser`;
if (Number(pcnt) === 0) {
  await sql.unsafe(`
    INSERT INTO tb_integration_parser
      (parser_id, integration_id, tenant_id, parser_class, config_json)
    VALUES
      (1, 'JSM',  1, 'com.cportal.parser.JsmIssueParser',
        '{"dateFormat":"yyyy-MM-dd","statusMapping":{"Open":"O","Done":"D","In Progress":"P"}}'),
      (2, 'SAP',  1, 'com.cportal.parser.SapOrderParser',
        '{"currencyField":"currency","amountField":"amount","statusField":"status"}'),
      (3, 'SNOW', 1, 'com.cportal.parser.ServiceNowParser',
        '{"incidentField":"number","descField":"short_description","stateField":"state"}'),
      (4, 'JSM',  2, 'com.cportal.parser.JsmIssueParser',
        '{"dateFormat":"yyyy-MM-dd","priorityMapping":{"High":"1","Medium":"2","Low":"3"}}'),
      (5, 'SAP',  2, 'com.cportal.parser.SapOrderParser',
        '{"currencyField":"currency","statusField":"status"}'),
      (6, 'JSM',  3, 'com.cportal.parser.JsmIssueParser',
        '{"dateFormat":"dd/MM/yyyy"}')
  `);
  console.log("✓ tb_integration_parser: 6 rows");
} else {
  console.log(`  tb_integration_parser: already ${pcnt} rows — skip`);
}

// ── 3. tb_notification_config ─────────────────────────────────────────────────

const [{ ncnt }] = await sql`SELECT COUNT(*) as ncnt FROM tb_notification_config`;
if (Number(ncnt) === 0) {
  await sql.unsafe(`
    INSERT INTO tb_notification_config
      (config_id, tenant_id, channel, config_json, enabled)
    VALUES
      (1, 1, 'email',
        '{"to":"ops-team@acme.com","cc":"manager@acme.com","subject":"[Batch Alert] Job {{jobName}} {{status}}"}',
        true),
      (2, 1, 'slack',
        '{"webhook":"https://slack-webhook-placeholder.example.com/acme-ops-alerts","channel":"#ops-alerts","username":"BatchBot"}',
        true),
      (3, 1, 'webhook',
        '{"url":"https://monitoring.acme.com/api/batch-events","method":"POST","headers":{"Authorization":"Bearer mon_token_acme"}}',
        false),
      (4, 2, 'email',
        '{"to":"alerts@globaltech.com","subject":"[GTECH Batch] {{jobName}} failed"}',
        true),
      (5, 2, 'slack',
        '{"webhook":"https://slack-webhook-placeholder.example.com/globaltech-batch","channel":"#batch-monitor"}',
        false),
      (6, 3, 'email',
        '{"to":"devops@nexus.io","subject":"Nexus Batch Alert: {{status}}"}',
        true)
  `);
  console.log("✓ tb_notification_config: 6 rows");
} else {
  console.log(`  tb_notification_config: already ${ncnt} rows — skip`);
}

// ── 4. tb_notification_history ───────────────────────────────────────────────

const [{ nhcnt }] = await sql`SELECT COUNT(*) as nhcnt FROM tb_notification_history`;
if (Number(nhcnt) === 0) {
  await sql.unsafe(`
    INSERT INTO tb_notification_history
      (history_id, config_id, status, message, created_at)
    VALUES
      (1,  1, 'sent',   'Job JSM_Acme_Collector completed — 42 records crawled',            NOW() - INTERVAL '2 hours'),
      (2,  1, 'sent',   'Job SAP_Acme_Collector failed after 3 retries',                    NOW() - INTERVAL '5 hours'),
      (3,  2, 'sent',   'Slack alert delivered: JSM_Acme SUCCESS',                          NOW() - INTERVAL '2 hours'),
      (4,  2, 'failed', 'Slack webhook timeout after 30s',                                  NOW() - INTERVAL '8 hours'),
      (5,  1, 'sent',   'Job SNOW_Acme_Collector completed — 18 incidents parsed',          NOW() - INTERVAL '1 day'),
      (6,  1, 'failed', 'SMTP connection refused: ops-team@acme.com',                       NOW() - INTERVAL '1 day 3 hours'),
      (7,  4, 'sent',   'GlobalTech JSM job succeeded — 87 issues processed',               NOW() - INTERVAL '3 hours'),
      (8,  4, 'sent',   'GlobalTech SAP batch completed in 4m 12s',                         NOW() - INTERVAL '6 hours'),
      (9,  4, 'failed', 'Email delivery failed: SPF check failed for globaltech.com',       NOW() - INTERVAL '2 days'),
      (10, 6, 'sent',   'Nexus JSM crawl complete: 23 new issues',                          NOW() - INTERVAL '4 hours'),
      (11, 6, 'sent',   'Nexus batch job finished successfully',                            NOW() - INTERVAL '1 day 2 hours'),
      (12, 6, 'failed', 'Connection timeout to devops@nexus.io mail server',                NOW() - INTERVAL '3 days')
  `);
  console.log("✓ tb_notification_history: 12 rows");
} else {
  console.log(`  tb_notification_history: already ${nhcnt} rows — skip`);
}

// ── 5. tb_audit_log ──────────────────────────────────────────────────────────

const [{ acnt }] = await sql`SELECT COUNT(*) as acnt FROM tb_audit_log`;
if (Number(acnt) === 0) {
  await sql.unsafe(`
    INSERT INTO tb_audit_log (audit_id, action, module, old_value, new_value, created_at)
    VALUES
      (1,  'LOGIN',  'auth',        NULL,
        '{"user":"admin@ops.local","ip":"172.31.121.21"}',
        NOW() - INTERVAL '30 minutes'),
      (2,  'UPDATE', 'collector',
        '{"active_yn":"Y","cron_schedule":"0 * * * *"}',
        '{"active_yn":"N","cron_schedule":"0 * * * *"}',
        NOW() - INTERVAL '2 hours'),
      (3,  'CREATE', 'parser',
        NULL,
        '{"integration_id":"JSM","tenant_id":1,"parser_class":"com.cportal.parser.JsmIssueParser"}',
        NOW() - INTERVAL '3 hours'),
      (4,  'UPDATE', 'notification',
        '{"enabled":true}',
        '{"enabled":false}',
        NOW() - INTERVAL '4 hours'),
      (5,  'DELETE', 'collector',
        '{"collector_id":7,"job_name":"OldJob_Deprecated","tenant_id":1}',
        NULL,
        NOW() - INTERVAL '6 hours'),
      (6,  'CREATE', 'integration_config',
        NULL,
        '{"integration_id":"SAP","tenant_id":2,"base_url":"https://api.sap.globaltech.com/v1"}',
        NOW() - INTERVAL '8 hours'),
      (7,  'LOGIN',  'auth',        NULL,
        '{"user":"alice.admin@ops.local","ip":"172.31.121.22"}',
        NOW() - INTERVAL '1 day'),
      (8,  'UPDATE', 'collector',
        '{"cron_schedule":"0 * * * *"}',
        '{"cron_schedule":"0 */2 * * *"}',
        NOW() - INTERVAL '1 day 1 hour'),
      (9,  'UPDATE', 'role_permissions',
        '{"role":"executive","key":"batch_view_dashboard","enabled":false}',
        '{"role":"executive","key":"batch_view_dashboard","enabled":true}',
        NOW() - INTERVAL '1 day 3 hours'),
      (10, 'CREATE', 'notification',
        NULL,
        '{"tenant_id":3,"channel":"email","enabled":true}',
        NOW() - INTERVAL '1 day 5 hours'),
      (11, 'DELETE', 'integration_config',
        '{"config_id":3,"integration_id":"SNOW","tenant_id":1}',
        NULL,
        NOW() - INTERVAL '2 days'),
      (12, 'LOGIN',  'auth', NULL,
        '{"user":"carol.op@ops.local","ip":"172.31.121.23"}',
        NOW() - INTERVAL '2 days 2 hours'),
      (13, 'UPDATE', 'parser',
        '{"parser_class":"com.cportal.parser.OldParser"}',
        '{"parser_class":"com.cportal.parser.JsmIssueParser"}',
        NOW() - INTERVAL '3 days'),
      (14, 'CREATE', 'collector',
        NULL,
        '{"job_name":"JSM_Aurora_Collector","cron_schedule":"0 */3 * * *","tenant_id":5}',
        NOW() - INTERVAL '4 days'),
      (15, 'UPDATE', 'notification',
        '{"channel":"slack","enabled":true}',
        '{"channel":"slack","enabled":false}',
        NOW() - INTERVAL '5 days')
  `);
  console.log("✓ tb_audit_log: 15 rows");
} else {
  console.log(`  tb_audit_log: already ${acnt} rows — skip`);
}

console.log("\n✓ All dummy data seeded successfully!");
await sql.end();
