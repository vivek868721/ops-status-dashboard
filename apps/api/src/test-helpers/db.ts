import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { adminUsers, sessions, userTenantRoles } from "@ops/db";

const schema = { adminUsers, sessions, userTenantRoles };

export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });

  await client.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      admin_user_id INTEGER NOT NULL REFERENCES admin_users(id),
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_tenant_roles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES admin_users(id),
      tenant_id BIGINT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('executive', 'it_manager', 'employee')),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  return { db, client };
}
