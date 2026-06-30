import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { adminUsers, tenants, userTenantRoles } from "@ops/db";
import { requireAuth } from "../middleware/auth.js";
import { requireSuperAdmin } from "../middleware/superAdmin.js";

const preHandler = [requireAuth, requireSuperAdmin];

export async function adminRoutes(app: FastifyInstance) {
  // ── Tenants ──────────────────────────────────────────────────────────────

  app.get("/api/admin/tenants", { preHandler }, async (_req, reply) => {
    const rows = await app.db.select().from(tenants).orderBy(tenants.id);
    return reply.send(rows);
  });

  app.post("/api/admin/tenants", { preHandler }, async (req, reply) => {
    const { id, name } = req.body as { id: number; name: string };
    const [row] = await app.db.insert(tenants).values({ id, name }).returning();
    return reply.status(201).send(row);
  });

  app.delete("/api/admin/tenants/:id", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await app.db.delete(tenants).where(eq(tenants.id, Number(id)));
    return reply.status(204).send();
  });

  // ── Users ────────────────────────────────────────────────────────────────

  app.get("/api/admin/users", { preHandler }, async (_req, reply) => {
    const rows = await app.db
      .select({
        id: adminUsers.id,
        email: adminUsers.email,
        role: adminUsers.role,
        createdAt: adminUsers.createdAt,
      })
      .from(adminUsers)
      .orderBy(adminUsers.id);
    return reply.send(rows);
  });

  app.post("/api/admin/users", { preHandler }, async (req, reply) => {
    const { email, password } = req.body as { email: string; password: string };
    const passwordHash = await bcrypt.hash(password, 10);
    const [row] = await app.db
      .insert(adminUsers)
      .values({ email, passwordHash })
      .returning({ id: adminUsers.id, email: adminUsers.email, role: adminUsers.role, createdAt: adminUsers.createdAt });
    return reply.status(201).send(row);
  });

  app.delete("/api/admin/users/:id", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await app.db.delete(adminUsers).where(eq(adminUsers.id, Number(id)));
    return reply.status(204).send();
  });

  // ── User-Tenant Roles ────────────────────────────────────────────────────

  app.get("/api/admin/user-tenant-roles", { preHandler }, async (_req, reply) => {
    const rows = await app.db.select().from(userTenantRoles).orderBy(userTenantRoles.id);
    return reply.send(rows);
  });

  app.post("/api/admin/user-tenant-roles", { preHandler }, async (req, reply) => {
    const { userId, tenantId, role } = req.body as {
      userId: number;
      tenantId: number;
      role: "executive" | "it_manager" | "employee";
    };
    const [row] = await app.db
      .insert(userTenantRoles)
      .values({ userId, tenantId, role })
      .returning();
    return reply.status(201).send(row);
  });

  app.delete("/api/admin/user-tenant-roles/:id", { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await app.db.delete(userTenantRoles).where(eq(userTenantRoles.id, Number(id)));
    return reply.status(204).send();
  });
}
