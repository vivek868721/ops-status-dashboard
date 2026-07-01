import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
  adminUsers, sessions, tenants, userTenantRoles, userPermissions, rolePermissions, aiInsights, jsmView,
  tbAuditLog, tbNotificationConfig, tbNotificationHistory, tbJobExecutionAudit,
  tbBatchHistory, tbIntegrationCollector, tbIntegrationConfig, tbIntegrationParser, tbRawData, tbRawDataDetail,
} from "@ops/db";

const schema = {
  adminUsers, sessions, tenants, userTenantRoles, userPermissions, rolePermissions, aiInsights,
  tbAuditLog, tbNotificationConfig, tbNotificationHistory, tbJobExecutionAudit,
  tbBatchHistory, tbIntegrationCollector, tbIntegrationConfig, tbIntegrationParser, tbRawData, tbRawDataDetail,
};

export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });

  await client.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT NULL CHECK (role IN ('super_admin')),
      jsm_assignee_id TEXT DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      admin_user_id INTEGER NOT NULL REFERENCES admin_users(id),
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tenants (
      id BIGINT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_tenant_roles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES admin_users(id),
      tenant_id BIGINT NOT NULL,
      system_role TEXT NOT NULL DEFAULT 'member' CHECK (system_role IN ('tenant_admin', 'operator', 'member')),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, tenant_id)
    );

    CREATE TABLE IF NOT EXISTS user_permissions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES admin_users(id),
      permission TEXT NOT NULL CHECK (permission IN ('executive', 'it_manager', 'employee')),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, permission)
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      id SERIAL PRIMARY KEY,
      role TEXT NOT NULL CHECK (role IN ('executive', 'it_manager', 'employee')),
      permission_key TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ai_insights (
      id SERIAL PRIMARY KEY,
      tenant_id BIGINT NOT NULL,
      generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      input_snapshot TEXT,
      insights_json TEXT NOT NULL,
      charts_json TEXT NOT NULL,
      custom_query TEXT
    );

    CREATE TABLE IF NOT EXISTS v_jsm_sr_cr_oc (
      tenant_id BIGINT NOT NULL,
      issue_type TEXT NOT NULL,
      issue_key TEXT NOT NULL,
      title TEXT,
      status_category TEXT,
      service_level TEXT,
      urgency_yn TEXT,
      assignee_id TEXT,
      assignee_name TEXT,
      issue_create_date TIMESTAMP,
      resolution_date TIMESTAMP,
      due_date TIMESTAMP,
      is_ontime BOOLEAN,
      total_leadtime INTEGER,
      chg_category TEXT,
      chg_purpose TEXT,
      chg_charge_of TEXT,
      chg_req_by TEXT,
      req_class TEXT,
      req_type TEXT,
      cancel_reason TEXT,
      stop_reason TEXT,
      company TEXT,
      company_key TEXT,
      client_company TEXT,
      client_name TEXT
    );

    -- Batch module: writable tables
    CREATE TABLE IF NOT EXISTS tb_audit_log (
      audit_id SERIAL PRIMARY KEY,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tb_notification_config (
      config_id SERIAL PRIMARY KEY,
      tenant_id BIGINT NOT NULL,
      channel TEXT NOT NULL,
      config_json TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tb_notification_history (
      history_id SERIAL PRIMARY KEY,
      config_id INTEGER NOT NULL REFERENCES tb_notification_config(config_id),
      status TEXT NOT NULL,
      message TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tb_job_execution_audit (
      audit_id SERIAL PRIMARY KEY,
      collector_id INTEGER NOT NULL,
      trigger_type TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TIMESTAMP NOT NULL DEFAULT NOW(),
      ended_at TIMESTAMP
    );

    -- Batch module: read-only tables (seeded by tests, owned by CPORTAL batch system in prod)
    CREATE TABLE IF NOT EXISTS tb_batch_history (
      id SERIAL PRIMARY KEY,
      batch_date DATE,
      integration_id TEXT,
      tenant_id BIGINT,
      collector_id INTEGER,
      crawling_status TEXT,
      parse_status TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tb_integration_collector (
      collector_id SERIAL PRIMARY KEY,
      job_name TEXT NOT NULL,
      cron_schedule TEXT,
      integration_id TEXT,
      tenant_id BIGINT,
      active_yn TEXT DEFAULT 'Y',
      last_run_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tb_integration_config (
      config_id SERIAL PRIMARY KEY,
      integration_id TEXT NOT NULL,
      tenant_id BIGINT,
      base_url TEXT,
      auth_type TEXT,
      access_key TEXT,
      secret_key TEXT,
      token TEXT,
      api_key TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tb_integration_parser (
      parser_id SERIAL PRIMARY KEY,
      integration_id TEXT NOT NULL,
      tenant_id BIGINT,
      parser_class TEXT,
      config_json TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tb_raw_data (
      id SERIAL PRIMARY KEY,
      batch_date DATE,
      integration_id TEXT,
      tenant_id BIGINT,
      collector_id INTEGER,
      parse_yn TEXT DEFAULT 'N',
      data TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tb_raw_data_detail (
      id SERIAL PRIMARY KEY,
      raw_data_id INTEGER,
      field_name TEXT,
      field_value TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  return { db, client };
}

type Db = Awaited<ReturnType<typeof createTestDb>>["db"];
type Permission = "executive" | "it_manager" | "employee";

const PERMISSION_KEYS = [
  "view_overview",
  "view_service_requests",
  "view_change_requests",
  "view_operational_changes",
  "view_ai_insights",
  "export_csv",
  "batch_view_dashboard",
  "batch_manage_jobs",
  "batch_view_raw_data",
  "batch_view_health",
] as const;

const DEFAULT_PERMISSIONS: Record<Permission, Record<(typeof PERMISSION_KEYS)[number], boolean>> = {
  executive: {
    view_overview: true,
    view_service_requests: false,
    view_change_requests: false,
    view_operational_changes: false,
    view_ai_insights: false,
    export_csv: false,
    batch_view_dashboard: true,
    batch_manage_jobs: false,
    batch_view_raw_data: false,
    batch_view_health: false,
  },
  it_manager: {
    view_overview: true,
    view_service_requests: true,
    view_change_requests: true,
    view_operational_changes: true,
    view_ai_insights: true,
    export_csv: true,
    batch_view_dashboard: true,
    batch_manage_jobs: true,
    batch_view_raw_data: true,
    batch_view_health: true,
  },
  employee: {
    view_overview: false,
    view_service_requests: true,
    view_change_requests: true,
    view_operational_changes: true,
    view_ai_insights: false,
    export_csv: false,
    batch_view_dashboard: false,
    batch_manage_jobs: false,
    batch_view_raw_data: false,
    batch_view_health: false,
  },
};

export async function seedDefaultPermissions(db: Db) {
  const rows = (["executive", "it_manager", "employee"] as Permission[]).flatMap((role) =>
    PERMISSION_KEYS.map((key) => ({
      role,
      permissionKey: key,
      enabled: DEFAULT_PERMISSIONS[role][key],
    })),
  );
  await db.insert(rolePermissions).values(rows);
}

/** Helper: assign a user to a tenant + grant them a data-access permission. */
export async function seedUserTenantPermission(
  db: Db,
  userId: number,
  tenantId: number,
  permission: Permission,
  systemRole: "tenant_admin" | "operator" | "member" = "member",
) {
  await db
    .insert(userTenantRoles)
    .values({ userId, tenantId, systemRole })
    .onConflictDoNothing();
  await db
    .insert(userPermissions)
    .values({ userId, permission })
    .onConflictDoNothing();
}

export interface JsmRow {
  tenantId: number;
  issueType: "SR" | "CR" | "OC";
  issueKey: string;
  title?: string;
  statusCategory?: string;
  serviceLevel?: string;
  urgencyYn?: string;
  assigneeId?: string;
  assigneeName?: string;
  isOntime?: boolean;
  totalLeadtime?: number;
  dueDate?: Date;
  resolutionDate?: Date;
  chgCategory?: string;
  cancelReason?: string;
  stopReason?: string;
}

export async function seedJsmRow(db: Db, row: JsmRow) {
  await db.insert(jsmView).values({
    tenantId: row.tenantId,
    issueType: row.issueType,
    issueKey: row.issueKey,
    title: row.title ?? null,
    statusCategory: row.statusCategory ?? null,
    serviceLevel: row.serviceLevel ?? null,
    urgencyYn: row.urgencyYn ?? null,
    assigneeId: row.assigneeId ?? null,
    assigneeName: row.assigneeName ?? null,
    isOntime: row.isOntime ?? null,
    totalLeadtime: row.totalLeadtime ?? null,
    dueDate: row.dueDate ?? null,
    resolutionDate: row.resolutionDate ?? null,
    chgCategory: row.chgCategory ?? null,
    cancelReason: row.cancelReason ?? null,
    stopReason: row.stopReason ?? null,
  });
}
