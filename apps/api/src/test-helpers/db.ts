import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { adminUsers, sessions, tenants, userTenantRoles, rolePermissions, aiInsights, jsmView } from "@ops/db";

const schema = { adminUsers, sessions, tenants, userTenantRoles, rolePermissions, aiInsights };

export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });

  await client.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT NULL CHECK (role IN ('super_admin')),
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
      role TEXT NOT NULL CHECK (role IN ('executive', 'it_manager', 'employee')),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
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
  `);

  return { db, client };
}

type Db = Awaited<ReturnType<typeof createTestDb>>["db"];
type Role = "executive" | "it_manager" | "employee";

const PERMISSION_KEYS = [
  "view_overview",
  "view_service_requests",
  "view_change_requests",
  "view_operational_changes",
  "view_ai_insights",
  "export_csv",
] as const;

const DEFAULT_PERMISSIONS: Record<Role, Record<(typeof PERMISSION_KEYS)[number], boolean>> = {
  executive: {
    view_overview: true,
    view_service_requests: false,
    view_change_requests: false,
    view_operational_changes: false,
    view_ai_insights: false,
    export_csv: false,
  },
  it_manager: {
    view_overview: true,
    view_service_requests: true,
    view_change_requests: true,
    view_operational_changes: true,
    view_ai_insights: true,
    export_csv: true,
  },
  employee: {
    view_overview: false,
    view_service_requests: true,
    view_change_requests: true,
    view_operational_changes: true,
    view_ai_insights: false,
    export_csv: false,
  },
};

export async function seedDefaultPermissions(db: Db) {
  const rows = (["executive", "it_manager", "employee"] as Role[]).flatMap((role) =>
    PERMISSION_KEYS.map((key) => ({
      role,
      permissionKey: key,
      enabled: DEFAULT_PERMISSIONS[role][key],
    })),
  );
  await db.insert(rolePermissions).values(rows);
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
