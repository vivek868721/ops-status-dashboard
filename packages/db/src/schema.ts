import { pgTable, serial, integer, text, timestamp, bigint, boolean } from "drizzle-orm/pg-core";

export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  adminUserId: integer("admin_user_id").notNull().references(() => adminUsers.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  domain: text("domain"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userTenantRoles = pgTable("user_tenant_roles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => adminUsers.id),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  role: text("role", { enum: ["executive", "it_manager", "employee"] }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  role: text("role", { enum: ["executive", "it_manager", "employee"] }).notNull(),
  permissionKey: text("permission_key").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
});
