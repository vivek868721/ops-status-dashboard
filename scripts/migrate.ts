#!/usr/bin/env bun
/**
 * Idempotent schema migration — safe to run on every startup.
 * Creates all application-managed tables if they don't already exist.
 * The JSM view (v_jsm_sr_cr_oc) is owned by the external JSM system and is never created here.
 */

import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is required");
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function migrate() {
  console.log("==> Running database migration...");

  // ── Core tables ────────────────────────────────────────────────────────────

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id              SERIAL PRIMARY KEY,
      email           TEXT NOT NULL UNIQUE,
      password_hash   TEXT NOT NULL,
      role            TEXT DEFAULT NULL CHECK (role IN ('super_admin')),
      jsm_assignee_id TEXT DEFAULT NULL,
      created_at      TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS sessions (
      id            SERIAL PRIMARY KEY,
      admin_user_id INTEGER NOT NULL REFERENCES admin_users(id),
      token         TEXT NOT NULL UNIQUE,
      expires_at    TIMESTAMP NOT NULL
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS tenants (
      id         BIGINT PRIMARY KEY,
      name       TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS user_tenant_roles (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES admin_users(id),
      tenant_id   BIGINT NOT NULL,
      system_role TEXT NOT NULL DEFAULT 'member'
                    CHECK (system_role IN ('tenant_admin', 'operator', 'member')),
      created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, tenant_id)
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS user_permissions (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES admin_users(id),
      permission TEXT NOT NULL CHECK (permission IN ('executive', 'it_manager', 'employee')),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, permission)
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id             SERIAL PRIMARY KEY,
      role           TEXT NOT NULL CHECK (role IN ('executive', 'it_manager', 'employee')),
      permission_key TEXT NOT NULL,
      enabled        BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at     TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(role, permission_key)
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS ai_insights (
      id              SERIAL PRIMARY KEY,
      tenant_id       BIGINT NOT NULL,
      generated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
      input_snapshot  TEXT,
      insights_json   TEXT NOT NULL,
      charts_json     TEXT NOT NULL,
      custom_query    TEXT
    )
  `);

  // ── Batch module: writable tables ─────────────────────────────────────────

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS tb_audit_log (
      audit_id   SERIAL PRIMARY KEY,
      action     TEXT NOT NULL,
      module     TEXT NOT NULL,
      old_value  TEXT,
      new_value  TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS tb_notification_config (
      config_id   SERIAL PRIMARY KEY,
      tenant_id   BIGINT NOT NULL,
      channel     TEXT NOT NULL,
      config_json TEXT NOT NULL,
      enabled     BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS tb_notification_history (
      history_id SERIAL PRIMARY KEY,
      config_id  INTEGER NOT NULL REFERENCES tb_notification_config(config_id),
      status     TEXT NOT NULL,
      message    TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS tb_job_execution_audit (
      audit_id     SERIAL PRIMARY KEY,
      collector_id INTEGER NOT NULL,
      trigger_type TEXT NOT NULL,
      status       TEXT NOT NULL,
      started_at   TIMESTAMP NOT NULL DEFAULT NOW(),
      ended_at     TIMESTAMP
    )
  `);

  // ── Batch module: read-only tables (owned by CPORTAL batch system in prod) ──

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS tb_batch_history (
      id               SERIAL PRIMARY KEY,
      batch_date       DATE,
      integration_id   TEXT,
      tenant_id        BIGINT,
      collector_id     INTEGER,
      crawling_status  TEXT,
      parse_status     TEXT,
      created_at       TIMESTAMP DEFAULT NOW()
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS tb_integration_collector (
      collector_id   SERIAL PRIMARY KEY,
      job_name       TEXT NOT NULL,
      cron_schedule  TEXT,
      integration_id TEXT,
      tenant_id      BIGINT,
      active_yn      TEXT DEFAULT 'Y',
      last_run_at    TIMESTAMP,
      created_at     TIMESTAMP DEFAULT NOW()
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS tb_integration_config (
      config_id      SERIAL PRIMARY KEY,
      integration_id TEXT NOT NULL,
      tenant_id      BIGINT,
      base_url       TEXT,
      auth_type      TEXT,
      access_key     TEXT,
      secret_key     TEXT,
      token          TEXT,
      api_key        TEXT,
      created_at     TIMESTAMP DEFAULT NOW()
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS tb_integration_parser (
      parser_id      SERIAL PRIMARY KEY,
      integration_id TEXT NOT NULL,
      tenant_id      BIGINT,
      parser_class   TEXT,
      config_json    TEXT,
      created_at     TIMESTAMP DEFAULT NOW()
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS tb_raw_data (
      id             SERIAL PRIMARY KEY,
      batch_date     DATE,
      integration_id TEXT,
      tenant_id      BIGINT,
      collector_id   INTEGER,
      parse_yn       TEXT DEFAULT 'N',
      data           TEXT,
      created_at     TIMESTAMP DEFAULT NOW()
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS tb_raw_data_detail (
      id          SERIAL PRIMARY KEY,
      raw_data_id INTEGER,
      field_name  TEXT,
      field_value TEXT,
      created_at  TIMESTAMP DEFAULT NOW()
    )
  `);

  console.log("==> Migration complete. All tables are up to date.");
  await sql.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
