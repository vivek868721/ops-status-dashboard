/**
 * Database Setup Script
 * ---------------------
 * Run: node scripts/setup-db.mjs
 *
 * Set your DB credentials before running:
 *   Windows:  set DB_HOST=localhost & set DB_PORT=5432 & set DB_USER=postgres & set DB_PASS=yourpassword
 *   Mac/Linux: DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASS=yourpassword node scripts/setup-db.mjs
 *
 * Or edit the DEFAULT VALUES below to match your local setup.
 */

import postgres from "postgres";
import { createHash } from "crypto";

// ─── DEFAULT VALUES — change these to match your local PostgreSQL ────────────
const HOST = process.env.DB_HOST ?? "localhost";
const PORT = process.env.DB_PORT ?? "5432";
const USER = process.env.DB_USER ?? "postgres";
const PASS = process.env.DB_PASS ?? "postgres";
const DB   = process.env.DB_NAME ?? "ops_dashboard";
// ─────────────────────────────────────────────────────────────────────────────

const baseUrl = `postgresql://${USER}:${PASS}@${HOST}:${PORT}/postgres`;
const appUrl  = `postgresql://${USER}:${PASS}@${HOST}:${PORT}/${DB}`;

async function hashPassword(password) {
  // Simple bcrypt-compatible hash using the bcryptjs already in node_modules
  const { default: bcrypt } = await import(
    new URL("../node_modules/bcryptjs/dist/bcrypt.js", import.meta.url).href
  ).catch(() => import("bcryptjs"));
  return bcrypt.hash(password, 10);
}

async function run() {
  console.log("\n🔧  Ops Status Dashboard — Database Setup");
  console.log("==========================================");
  console.log(`Host : ${HOST}:${PORT}`);
  console.log(`DB   : ${DB}`);
  console.log(`User : ${USER}\n`);

  // ── Step 1: Create database ────────────────────────────────────────────────
  console.log("📦  Step 1/3 — Creating database...");
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

  // ── Step 2: Create tables ──────────────────────────────────────────────────
  console.log("\n📋  Step 2/3 — Creating tables...");
  const sql = postgres(appUrl, { max: 1, onnotice: () => {} });

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS admin_users (
        id           SERIAL PRIMARY KEY,
        email        TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at   TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    console.log("     ✓ admin_users");

    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id            SERIAL PRIMARY KEY,
        admin_user_id INTEGER NOT NULL REFERENCES admin_users(id),
        token         TEXT NOT NULL UNIQUE,
        expires_at    TIMESTAMP NOT NULL
      )
    `;
    console.log("     ✓ sessions");

    await sql`
      CREATE TABLE IF NOT EXISTS user_tenant_roles (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES admin_users(id),
        tenant_id  BIGINT NOT NULL,
        role       TEXT NOT NULL CHECK (role IN ('executive', 'it_manager', 'employee')),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    console.log("     ✓ user_tenant_roles");
  } catch (e) {
    console.error(`     ✗ Failed to create tables: ${e.message}`);
    await sql.end();
    process.exit(1);
  }

  // ── Step 3: Insert dummy data ──────────────────────────────────────────────
  console.log("\n👥  Step 3/3 — Inserting dummy users...");

  const users = [
    { email: "admin@ops.com",      password: "admin123",   role: "executive",  tenantId: 1001 },
    { email: "itmanager@ops.com",  password: "manager123", role: "it_manager", tenantId: 1001 },
    { email: "employee@ops.com",   password: "emp123",     role: "employee",   tenantId: 1002 },
    { email: "ceo@acme.com",       password: "ceo123",     role: "executive",  tenantId: 1002 },
  ];

  for (const u of users) {
    try {
      const hash = await hashPassword(u.password);
      const [user] = await sql`
        INSERT INTO admin_users (email, password_hash)
        VALUES (${u.email}, ${hash})
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `;
      if (user) {
        await sql`
          INSERT INTO user_tenant_roles (user_id, tenant_id, role)
          VALUES (${user.id}, ${u.tenantId}, ${u.role})
        `;
        console.log(`     ✓ ${u.email}  (password: ${u.password}, role: ${u.role})`);
      } else {
        console.log(`     ℹ  ${u.email} already exists — skipped.`);
      }
    } catch (e) {
      console.error(`     ✗ Failed for ${u.email}: ${e.message}`);
    }
  }

  await sql.end();

  // ── Done ───────────────────────────────────────────────────────────────────
  console.log("\n✅  Setup complete!\n");
  console.log("Add this to your .env file:");
  console.log("─".repeat(50));
  console.log(`DATABASE_URL=${appUrl}`);
  console.log(`PORT=3001`);
  console.log(`SESSION_SECRET=change-me-in-production`);
  console.log("─".repeat(50));
  console.log("\nTest credentials:");
  console.log("  admin@ops.com      / admin123   (executive)");
  console.log("  itmanager@ops.com  / manager123 (it_manager)");
  console.log("  employee@ops.com   / emp123     (employee)");
  console.log("  ceo@acme.com       / ceo123     (executive)\n");
}

run().catch((e) => {
  console.error("\n❌  Unexpected error:", e.message);
  process.exit(1);
});
