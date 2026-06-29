/**
 * Database Setup Script
 * ---------------------
 * Run: node scripts/setup-db.mjs
 *
 * Set your DB credentials before running:
 *   Windows (PowerShell):
 *     $env:DB_HOST="localhost"; $env:DB_PORT="5432"; $env:DB_USER="postgres"; $env:DB_PASS="yourpassword"; npm run db:setup
 *
 *   Mac/Linux:
 *     DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASS=yourpassword npm run db:setup
 *
 * Or edit the DEFAULT VALUES below.
 */

import postgres from "postgres";
import bcrypt from "bcryptjs";

// ─── DEFAULT VALUES — change these to match your local PostgreSQL ────────────
const HOST = process.env.DB_HOST ?? "localhost";
const PORT = process.env.DB_PORT ?? "5432";
const USER = process.env.DB_USER ?? "postgres";
const PASS = process.env.DB_PASS ?? "postgres";
const DB   = process.env.DB_NAME ?? "ops_dashboard";
// ─────────────────────────────────────────────────────────────────────────────

const baseUrl = `postgresql://${USER}:${PASS}@${HOST}:${PORT}/postgres`;
const appUrl  = `postgresql://${USER}:${PASS}@${HOST}:${PORT}/${DB}`;

async function run() {
  console.log("\n🔧  Ops Status Dashboard — Database Setup");
  console.log("==========================================");
  console.log(`Host : ${HOST}:${PORT}`);
  console.log(`DB   : ${DB}`);
  console.log(`User : ${USER}\n`);

  // ── Step 1: Create database ────────────────────────────────────────────────
  console.log("📦  Step 1/5 — Creating database...");
  const root = postgres(baseUrl, { max: 1 });
  try {
    await root.unsafe(`CREATE DATABASE ${DB}`);
    console.log(`     ✓ Database "${DB}" created.`);
  } catch (e) {
    if (e.message.includes("already exists")) {
      console.log(`     ℹ  Database "${DB}" already exists — skipping.`);
    } else {
      console.error(`     ✗ Failed: ${e.message}`);
      await root.end();
      process.exit(1);
    }
  }
  await root.end();

  const sql = postgres(appUrl, { max: 1, onnotice: () => {} });

  try {
    // ── Step 2: Create tables ────────────────────────────────────────────────
    console.log("\n📋  Step 2/5 — Creating tables...");

    await sql`
      CREATE TABLE IF NOT EXISTS admin_users (
        id             SERIAL PRIMARY KEY,
        email          TEXT NOT NULL UNIQUE,
        password_hash  TEXT NOT NULL,
        is_super_admin BOOLEAN DEFAULT FALSE NOT NULL,
        created_at     TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    // Add is_super_admin if table existed before this column was introduced
    await sql`
      ALTER TABLE admin_users
      ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE NOT NULL
    `;
    console.log("     ✓ admin_users");

    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id            SERIAL PRIMARY KEY,
        admin_user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
        token         TEXT NOT NULL UNIQUE,
        expires_at    TIMESTAMP NOT NULL
      )
    `;
    console.log("     ✓ sessions");

    await sql`
      CREATE TABLE IF NOT EXISTS tenants (
        id         SERIAL PRIMARY KEY,
        name       TEXT NOT NULL,
        domain     TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    console.log("     ✓ tenants");

    // Recreate user_tenant_roles with proper FK to tenants table
    await sql`DROP TABLE IF EXISTS user_tenant_roles`;
    await sql`
      CREATE TABLE user_tenant_roles (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
        tenant_id  INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        role       TEXT NOT NULL CHECK (role IN ('executive', 'it_manager', 'employee')),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE (user_id, tenant_id)
      )
    `;
    console.log("     ✓ user_tenant_roles");

    await sql`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id             SERIAL PRIMARY KEY,
        role           TEXT NOT NULL CHECK (role IN ('executive', 'it_manager', 'employee')),
        permission_key TEXT NOT NULL,
        enabled        BOOLEAN DEFAULT TRUE NOT NULL,
        UNIQUE (role, permission_key)
      )
    `;
    console.log("     ✓ role_permissions");

    // ── Step 3: Insert tenants ───────────────────────────────────────────────
    console.log("\n🏢  Step 3/5 — Inserting tenants...");

    const tenantsData = [
      { name: "Acme Corp",       domain: "acme.com"       },
      { name: "TechNova Ltd",    domain: "technova.com"   },
      { name: "BlueWave Inc",    domain: "bluewave.com"   },
    ];

    const insertedTenants = [];
    for (const t of tenantsData) {
      const [tenant] = await sql`
        INSERT INTO tenants (name, domain)
        VALUES (${t.name}, ${t.domain})
        ON CONFLICT DO NOTHING
        RETURNING id, name
      `;
      if (tenant) {
        insertedTenants.push(tenant);
        console.log(`     ✓ ${t.name} (id: ${tenant.id})`);
      } else {
        const [existing] = await sql`SELECT id, name FROM tenants WHERE domain = ${t.domain}`;
        insertedTenants.push(existing);
        console.log(`     ℹ  ${t.name} already exists (id: ${existing.id})`);
      }
    }

    // ── Step 4: Insert users ─────────────────────────────────────────────────
    console.log("\n👥  Step 4/5 — Inserting users...");

    const [t1, t2, t3] = insertedTenants;

    const users = [
      // Super admin
      { email: "superadmin@ops.com",   password: "super123",   isSuperAdmin: true,  roles: [] },
      // Acme Corp
      { email: "ceo@acme.com",         password: "ceo123",     isSuperAdmin: false, roles: [{ tenantId: t1.id, role: "executive"  }] },
      { email: "ithead@acme.com",      password: "ithead123",  isSuperAdmin: false, roles: [{ tenantId: t1.id, role: "it_manager" }] },
      { email: "staff1@acme.com",      password: "staff123",   isSuperAdmin: false, roles: [{ tenantId: t1.id, role: "employee"   }] },
      { email: "staff2@acme.com",      password: "staff123",   isSuperAdmin: false, roles: [{ tenantId: t1.id, role: "employee"   }] },
      // TechNova
      { email: "cto@technova.com",     password: "cto123",     isSuperAdmin: false, roles: [{ tenantId: t2.id, role: "executive"  }] },
      { email: "itmgr@technova.com",   password: "itmgr123",   isSuperAdmin: false, roles: [{ tenantId: t2.id, role: "it_manager" }] },
      { email: "dev@technova.com",     password: "dev123",     isSuperAdmin: false, roles: [{ tenantId: t2.id, role: "employee"   }] },
      // BlueWave
      { email: "vp@bluewave.com",      password: "vp123",      isSuperAdmin: false, roles: [{ tenantId: t3.id, role: "executive"  }] },
      { email: "support@bluewave.com", password: "support123", isSuperAdmin: false, roles: [{ tenantId: t3.id, role: "it_manager" }] },
      // User with access to multiple tenants
      { email: "admin@ops.com",        password: "admin123",   isSuperAdmin: false, roles: [
        { tenantId: t1.id, role: "executive"  },
        { tenantId: t2.id, role: "it_manager" },
      ]},
    ];

    for (const u of users) {
      const hash = await bcrypt.hash(u.password, 10);
      const [user] = await sql`
        INSERT INTO admin_users (email, password_hash, is_super_admin)
        VALUES (${u.email}, ${hash}, ${u.isSuperAdmin})
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `;
      if (user) {
        for (const r of u.roles) {
          await sql`
            INSERT INTO user_tenant_roles (user_id, tenant_id, role)
            VALUES (${user.id}, ${r.tenantId}, ${r.role})
            ON CONFLICT (user_id, tenant_id) DO NOTHING
          `;
        }
        const roleStr = u.isSuperAdmin ? "super_admin" : u.roles.map(r => r.role).join(", ") || "no role";
        console.log(`     ✓ ${u.email.padEnd(28)} password: ${u.password.padEnd(12)} role: ${roleStr}`);
      } else {
        console.log(`     ℹ  ${u.email} already exists — skipped.`);
      }
    }

    // ── Step 5: Insert role permissions ─────────────────────────────────────
    console.log("\n🔐  Step 5/5 — Inserting role permissions...");

    const permissions = [
      // executive
      { role: "executive",  key: "view_overview",        enabled: true  },
      { role: "executive",  key: "view_service_requests", enabled: false },
      { role: "executive",  key: "view_change_requests",  enabled: false },
      { role: "executive",  key: "view_op_changes",       enabled: false },
      { role: "executive",  key: "view_ai_insights",      enabled: true  },
      { role: "executive",  key: "export_csv",            enabled: false },
      // it_manager
      { role: "it_manager", key: "view_overview",        enabled: true  },
      { role: "it_manager", key: "view_service_requests", enabled: true  },
      { role: "it_manager", key: "view_change_requests",  enabled: true  },
      { role: "it_manager", key: "view_op_changes",       enabled: true  },
      { role: "it_manager", key: "view_ai_insights",      enabled: true  },
      { role: "it_manager", key: "export_csv",            enabled: true  },
      // employee
      { role: "employee",   key: "view_overview",        enabled: false },
      { role: "employee",   key: "view_service_requests", enabled: true  },
      { role: "employee",   key: "view_change_requests",  enabled: true  },
      { role: "employee",   key: "view_op_changes",       enabled: true  },
      { role: "employee",   key: "view_ai_insights",      enabled: false },
      { role: "employee",   key: "export_csv",            enabled: false },
    ];

    for (const p of permissions) {
      await sql`
        INSERT INTO role_permissions (role, permission_key, enabled)
        VALUES (${p.role}, ${p.key}, ${p.enabled})
        ON CONFLICT (role, permission_key) DO NOTHING
      `;
    }
    console.log(`     ✓ ${permissions.length} permissions inserted.`);

  } catch (e) {
    console.error(`\n✗ Error: ${e.message}`);
    await sql.end();
    process.exit(1);
  }

  await sql.end();

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log("\n✅  Setup complete!\n");
  console.log("Add this to your .env file:");
  console.log("─".repeat(55));
  console.log(`DATABASE_URL=${appUrl}`);
  console.log(`PORT=3001`);
  console.log(`SESSION_SECRET=change-me-in-production`);
  console.log("─".repeat(55));
  console.log("\nTest credentials:");
  console.log("  superadmin@ops.com    / super123    (super_admin)");
  console.log("  admin@ops.com         / admin123    (executive + it_manager across tenants)");
  console.log("  ceo@acme.com          / ceo123      (executive  — Acme Corp)");
  console.log("  ithead@acme.com       / ithead123   (it_manager — Acme Corp)");
  console.log("  staff1@acme.com       / staff123    (employee   — Acme Corp)");
  console.log("  cto@technova.com      / cto123      (executive  — TechNova Ltd)");
  console.log("  itmgr@technova.com    / itmgr123    (it_manager — TechNova Ltd)");
  console.log("  vp@bluewave.com       / vp123       (executive  — BlueWave Inc)");
  console.log("");
}

run().catch((e) => {
  console.error("\n❌  Unexpected error:", e.message);
  process.exit(1);
});
