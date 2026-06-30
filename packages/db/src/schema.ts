import { pgTable, serial, integer, text, timestamp, bigint, boolean, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["super_admin"] }),
  jsmAssigneeId: text("jsm_assignee_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  adminUserId: integer("admin_user_id").notNull().references(() => adminUsers.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const tenants = pgTable("tenants", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userTenantRoles = pgTable("user_tenant_roles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => adminUsers.id),
  tenantId: bigint("tenant_id", { mode: "number" }).notNull(),
  role: text("role", { enum: ["executive", "it_manager", "employee"] }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("utr_user_tenant_uniq").on(t.userId, t.tenantId),
]);

export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  role: text("role", { enum: ["executive", "it_manager", "employee"] }).notNull(),
  permissionKey: text("permission_key").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Read-only JSM view — never modified by this app
export const jsmView = pgTable("v_jsm_sr_cr_oc", {
  tenantId: bigint("tenant_id", { mode: "number" }).notNull(),
  issueType: text("issue_type").notNull(),
  issueKey: text("issue_key").notNull(),
  title: text("title"),
  statusCategory: text("status_category"),
  serviceLevel: text("service_level"),
  urgencyYn: text("urgency_yn"),
  assigneeId: text("assignee_id"),
  assigneeName: text("assignee_name"),
  issueCreateDate: timestamp("issue_create_date"),
  resolutionDate: timestamp("resolution_date"),
  dueDate: timestamp("due_date"),
  isOntime: boolean("is_ontime"),
  totalLeadtime: integer("total_leadtime"),
  chgCategory: text("chg_category"),
  chgPurpose: text("chg_purpose"),
  chgChargeOf: text("chg_charge_of"),
  chgReqBy: text("chg_req_by"),
  reqClass: text("req_class"),
  reqType: text("req_type"),
  cancelReason: text("cancel_reason"),
  stopReason: text("stop_reason"),
  company: text("company"),
  companyKey: text("company_key"),
  clientCompany: text("client_company"),
  clientName: text("client_name"),
});

export const aiInsights = pgTable("ai_insights", {
  id: serial("id").primaryKey(),
  tenantId: bigint("tenant_id", { mode: "number" }).notNull(),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  inputSnapshot: text("input_snapshot"),
  insightsJson: text("insights_json").notNull(),
  chartsJson: text("charts_json").notNull(),
  customQuery: text("custom_query"),
});
