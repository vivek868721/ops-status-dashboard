# Operations Status Dashboard — Claude Code Guide

## Project Overview

An internal Operations Status Dashboard for the ops team. Reads from the `v_jsm_sr_cr_oc` JSM PostgreSQL view and presents SLA compliance, issue trends, and AI-generated insights in a role-appropriate, tenant-scoped interface.

- **Full PRD**: `docs/PRD-operations-status-dashboard.md`
- **Architectural decisions**: `docs/adr/` (ADR-0001 through ADR-0005)
- **GitHub issues**: #1–#10 at `https://github.com/vivek868721/ops-status-dashboard/issues`

---

## Monorepo Structure

```
ops-status-dashboard/
├── apps/
│   ├── api/          Fastify v5 backend
│   └── web/          React 19 + Vite 8 frontend
├── packages/
│   └── db/           Drizzle ORM schema + createDb() factory
├── docs/
│   ├── PRD-operations-status-dashboard.md
│   └── adr/          ADR-0001 through ADR-0005
├── turbo.json
└── CLAUDE.md
```

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Bun 1.3.9 (production), Node 20 via nvm (WSL package management) |
| Monorepo | Turborepo 2.x |
| Backend | Fastify v5, Drizzle ORM, PostgreSQL 17 |
| Frontend | React 19, Vite 8, TanStack Router, TanStack Query, Tailwind CSS v4, shadcn/ui, Recharts, React Hook Form + Zod |
| AI | Anthropic SDK — model `claude-sonnet-4-6` |
| Testing | Vitest, PGlite (`@electric-sql/pglite`) — in-memory PostgreSQL, no real DB needed in tests |
| Icons | Lucide React |
| Theme | Light only |

---

## Dev Environment (WSL)

Node and npm must be loaded via nvm — do NOT use the Windows Bun binary for install commands inside WSL:

```bash
export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh"
```

This is already in `~/.bashrc` — new shells load it automatically.

### Common commands

```bash
# Install dependencies (from repo root)
npm install

# Run all tests
cd apps/api && npx vitest run

# Type-check API
cd apps/api && npx tsc --noEmit

# Run API dev server
cd apps/api && bun run src/index.ts

# Run frontend dev server
cd apps/web && bun run dev
```

### GitHub CLI

`gh` is a wrapper at `~/.local/bin/gh` pointing to the Windows `gh.exe`. It is on PATH.

---

## Environment Variables

### `apps/api/.env`
```
DATABASE_URL=postgres://user:password@localhost:5432/ops_dashboard
SESSION_SECRET=<32-char random hex>
ANTHROPIC_API_KEY=<your key>
PORT=3001
NODE_ENV=development
```

The app fails fast at startup if `DATABASE_URL` or `ANTHROPIC_API_KEY` is missing.

---

## Application Database Schema

Managed by Drizzle ORM in `packages/db/src/schema.ts`. Migrations via `drizzle-kit`.

```
admin_users       id, email, password_hash, role (null | 'super_admin'), created_at
sessions          id, admin_user_id, token, expires_at
tenants           id (BIGINT), name, created_at
user_tenant_roles id, user_id, tenant_id (FK→tenants), role ('executive'|'it_manager'|'employee'), created_at
role_permissions  id, role, permission_key, enabled, updated_at
ai_insights       id, tenant_id, generated_at, input_snapshot (JSONB), insights_json (JSONB), charts_json (JSONB), custom_query
```

**JSM view** (read-only, not managed by Drizzle):
```
v_jsm_sr_cr_oc    tenant_id, issue_type ('SR'|'CR'|'OC'), issue_key, title,
                  status_category, service_level, urgency_yn, assignee_id, assignee_name,
                  issue_create_date, resolution_date, due_date, is_ontime,
                  total_leadtime, chg_category, chg_purpose, chg_charge_of, chg_req_by,
                  req_class, req_type, cancel_reason, stop_reason, company, company_key,
                  client_company, client_name
```

---

## API Middleware Chain

Every protected route runs these preHandlers in order:

1. **`requireAuth`** — validates `session` cookie. Returns 401 if missing or expired.
2. **`requireTenantAccess`** — reads `X-Tenant-Id` header, queries `user_tenant_roles`, attaches `req.tenant = { tenantId, role }`. Returns 403 if not authorized.
3. **`requirePermission(key)`** — checks `role_permissions` for `(req.tenant.role, key)`. Returns 403 if disabled.

Super-admin routes (`/api/admin/*`) replace step 2+3 with:
- **`requireSuperAdmin`** — checks `admin_users.role = 'super_admin'`. Returns 403 otherwise.

---

## Key Architecture Decisions

| ADR | Decision |
|-----|---------|
| ADR-0001 | Trust `is_ontime` from the JSM view — never recalculate from `due_date` vs `resolution_date` |
| ADR-0002 | Separate pages for SR / CR / OC — not a single unified filtered list |
| ADR-0003 | Per-tenant role assignments — one user can have different roles for different tenants |
| ADR-0004 | AI agent uses pre-built JSON snapshot + predefined tool functions — no raw SQL, no cross-tenant data |
| ADR-0005 | Dashboard is read-only + CSV export only — no PDF, no write-back to JSM |

---

## Testing Approach

**Rule**: Tests verify external behavior through public interfaces, never implementation details. A test must survive an internal refactor.

**Primary seam — Fastify route level** (backend):
- Use `buildApp(db)` factory + PGlite in-memory DB.
- Call routes via `app.inject()`.
- Assert on HTTP status codes and response shapes.
- Pattern established in `apps/api/src/routes/__tests__/auth.test.ts`.

**JSM view in tests**:
- Create a plain PGlite table `v_jsm_sr_cr_oc` with the same column shape as the real view.
- Seed with fixture rows. The real view is never available in tests.

**Secondary seam — React** (frontend):
- Vitest + React Testing Library.
- Mock API calls at the TanStack Query boundary.
- Focus on: loading skeletons, empty states, error states, role-conditioned navigation.

**Anthropic SDK**:
- Mocked at the SDK boundary in AI Insights tests only.
- This is the sole external API mock in the project.

**Never mock the application database** — always use PGlite.

---

## Role Visibility Defaults

| Role | Accessible pages | Notes |
|------|-----------------|-------|
| `super_admin` | `/admin/*` only | System-level, no tenant context |
| `executive` | Overview (`/`) | Configurable via `role_permissions` |
| `it_manager` | All pages + CSV export + AI Insights | Full access |
| `employee` | SR, CR, OC — own issues only | `assignee_id` filter enforced server-side |

Defaults are seeded in `role_permissions`. Super-admin can change them at runtime.

---

## Issue Progress

| # | Title | Status |
|---|-------|--------|
| 1 | Monorepo Scaffolding | ✅ Done |
| 2 | Authentication | ✅ Done |
| 3 | Tenant Selector + Role Enforcement | 🔵 Next |
| 4 | Super-Admin — User & Tenant Management | ⬜ |
| 5 | Role Permissions Matrix | ⬜ |
| 6 | Overview Dashboard | ⬜ |
| 7 | Service Requests Page | ⬜ |
| 8 | Change Requests Page | ⬜ |
| 9 | Operational Changes Page | ⬜ |
| 10 | AI Insights Page | ⬜ |

Master PRD issue: #11 on GitHub.
