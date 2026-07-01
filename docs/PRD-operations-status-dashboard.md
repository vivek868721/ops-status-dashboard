# PRD: CPORTAL Operations & Batch Monitoring Dashboard

## Problem Statement

The internal operations team faces two distinct but related problems:

**JSM Operations Visibility**: There is no centralized view of JSM service operations data. To check SLA compliance, issue volumes, or operational health, team members must log into JSM directly — a context-switching overhead that delays decision-making and obscures trends across Service Requests (SR), Change Requests (CR), and Operational Changes (OC). There is no role-appropriate view for each team member, no AI-powered analysis of patterns, and no way to see metrics scoped to a specific tenant.

**Batch Processing Observability**: The CPORTAL Batch processing system (Spring Boot) collects data from multiple external integrations, processes it, and stores the output in PostgreSQL — but it has no UI. Operators must query the database directly to diagnose failures, check job health, or manage schedules. There is no centralized dashboard for batch execution monitoring, job management, raw data inspection, or configuration management.

## Solution

A unified internal dashboard that:

1. **JSM Operations Dashboard** — reads from the `v_jsm_sr_cr_oc` view and presents SLA compliance, issue trends, and AI-generated insights in a role-appropriate, tenant-scoped interface.
2. **Batch Monitoring Dashboard** — reads from CPORTAL batch tables (`tb_batch_history`, `tb_integration_collector`, etc.) and provides execution monitoring, job management, raw/parsed data viewing, integration configuration, notifications, audit logging, and system health.

Both modules share the same auth, tenant model, role/permission system, and frontend/backend stack.

---

## User Stories

### Authentication & Session

1. As an ops team member, I want to log in with my email and password, so that I can access the dashboard securely.
2. As an ops team member, I want my session to persist across browser refreshes, so that I do not have to log in repeatedly.
3. As an ops team member, I want to be redirected to the login page when my session expires.
4. As an ops team member, I want to log out from any page.

### Tenant Selection & Role Enforcement

5. As an ops team member, I want a tenant dropdown in the header to scope data to a specific organization.
6. As an ops team member, I want a permission-level dropdown (Executive / IT Manager / Employee) independent of the tenant selector.
7. As an IT Manager, I want to see all pages and filters for the selected tenant.
8. As an Executive, I want to see only KPI summary cards without operational detail.
9. As an Employee, I want to see only issues assigned to me (`assignee_id` filter, server-side).

### Overview Dashboard (`/`)

10. As an IT Manager, I want SLA Compliance Rate, Open Issues by type, Urgent/Overdue counts, and Avg Resolution Time KPI cards.
11. As any user, I want 5-minute auto-refresh, a "last updated" timestamp, loading skeletons, empty state, and error state.

### Service Requests Page (`/service-requests`)

12. As an IT Manager, I want a filterable SR list with SLA rate, resolution trend, and top assignees chart.
13. As an IT Manager, I want to export filtered SRs as CSV.

### Change Requests Page (`/change-requests`)

14. As an IT Manager, I want a filterable CR list with SLA rate, chg_category breakdown, and on-time vs overdue by category charts.
15. As an IT Manager, I want to export filtered CRs as CSV.

### Operational Changes Page (`/operational-changes`)

16. As an IT Manager, I want a filterable OC list with SLA rate, cancellation/stop reason charts, and avg resolution time.
17. As an IT Manager, I want to export filtered OCs as CSV.

### AI Insights Page (`/ai-insights`)

18. As an IT Manager, I want to trigger an AI analysis of the current tenant's JSM data and receive severity-coded insight cards and custom charts.
19. As any user, I want to enter an optional custom query to focus the analysis.
20. As any user, I want the last 10 analyses stored and viewable for the selected tenant.

### Super-Admin Area (`/admin`)

21. As a super-admin, I want to manage tenants, users, tenant-role assignments, and the permissions matrix.

### Batch Dashboard (`/batch`)

22. As an IT Manager, I want a summary of batch job health: Total / Active / Failed / Success / Running / Pending counts and success rate.
23. As an IT Manager, I want daily execution trend, failure trend, integration distribution, and success ratio charts.
24. As an IT Manager, I want to filter by date range, tenant, integration, and status.

### Job Management (`/batch/jobs`)

25. As an IT Manager, I want to view all batch jobs with their collector ID, cron expression, active status, last run, next run, and current status.
26. As an IT Manager, I want to enable/disable a job (toggle `active_yn`).
27. As an IT Manager, I want to edit a job's cron schedule.
28. As an IT Manager, I want to manually trigger a job execution.
29. As an IT Manager, I want to stop a running job.
30. As an IT Manager, I want to retry a failed job.
31. As an Executive, I want to view the jobs list (read-only) without execution controls.

### Execution History (`/batch/history`)

32. As an IT Manager, I want to see all batch executions with crawling status, parsing status, start/end times, and duration.
33. As an IT Manager, I want to filter by date, status, job name, and tenant.
34. As an IT Manager, I want to retry a failed execution from the history row.
35. As an IT Manager, I want to export execution history as CSV.

### Raw Data Viewer (`/batch/raw-data`)

36. As an IT Manager, I want to browse raw JSON API responses stored in `tb_raw_data`, filtered by batch date and collector.
37. As an IT Manager, I want to view a pretty-printed JSON viewer for individual records.
38. As an IT Manager, I want to download raw data as a JSON file.

### Parsed Data Viewer (`/batch/parsed-data`)

39. As an IT Manager, I want to browse parsed row-level records from `tb_raw_data_detail` with pagination and sorting.
40. As an IT Manager, I want to export filtered parsed data as CSV.

### Integration Configuration (`/batch/config`)

41. As a super-admin, I want CRUD management of integration collectors (`tb_integration_collector`).
42. As a super-admin, I want CRUD management of integration credentials (`tb_integration_config`) with secret values masked in GET responses.
43. As a super-admin, I want CRUD management of parser mappings (`tb_integration_parser`).

### Notification Module (`/batch/notifications`)

44. As an IT Manager, I want to configure Email / Slack / Webhook notifications for job failures, timeouts, and critical errors.
45. As an IT Manager, I want to view notification delivery history (sent / failed).

### Audit Log (`/batch/audit`)

46. As a super-admin, I want to see a full audit trail: all logins, config changes, job executions, and schedule updates with before/after values.
47. As an IT Manager, I want to filter the audit log by date, user, module, and action.
48. As an IT Manager, I want to export the audit log as CSV.

### System Health (`/batch/health`)

49. As an IT Manager, I want to see database connectivity and connection pool utilization.
50. As an IT Manager, I want to see scheduler status and the next 5 scheduled job runs.
51. As an IT Manager, I want the health page to auto-refresh every 30 seconds.

---

## Implementation Decisions

### Stack

- **Runtime**: Bun 1.3.9 (production), Node 20 via nvm (WSL package management)
- **Monorepo**: Turborepo 2.x — `apps/api`, `apps/web`, `packages/db`
- **Backend**: Fastify v5, Drizzle ORM, PostgreSQL 17
- **Frontend**: React 19, Vite 8, TanStack Router, TanStack Query, Tailwind CSS v4, shadcn/ui, Recharts, React Hook Form + Zod
- **AI**: Anthropic SDK, model `claude-sonnet-4-6`
- **Testing**: Vitest, PGlite (`@electric-sql/pglite`) for in-memory PostgreSQL in tests

### Multi-Tenancy & Role Model (ADR-0006)

Two independent dropdowns in the header:
- **Tenant** — which organization to view data for (from `user_tenant_roles`)
- **Permission Level** — what data-access level to apply (from `user_permissions`)

Every tenant-scoped API request carries:
```
X-Tenant-Id: <tenantId>
X-Permission: executive | it_manager | employee
```

#### System Roles (administrative)

| Role | Scope | Capability |
|------|-------|------------|
| `super_admin` | Global | All tenants, all permissions, all admin + config pages |
| `tenant_admin` | Per-tenant | Manages users and permissions within the tenant |
| `operator` | Per-tenant | Operational access; can belong to multiple tenants |
| `member` | Per-tenant | Basic read access |

#### Data-Access Permissions (global per user)

| Permission | JSM Access | Batch Access |
|------------|-----------|--------------|
| `executive` | Overview KPIs only | Batch dashboard (read-only) |
| `it_manager` | All pages + CSV + AI Insights | Full batch monitoring, job management, history, notifications |
| `employee` | Own assigned issues only | — |

A user can hold multiple permission levels.

### Application Database Schema

```
admin_users            id, email, password_hash, role ('super_admin'|null), jsm_assignee_id, created_at
sessions               id, admin_user_id, token, expires_at
tenants                id (BIGINT), name, created_at
user_tenant_roles      id, user_id, tenant_id, system_role ('tenant_admin'|'operator'|'member'), created_at
user_permissions       id, user_id, permission ('executive'|'it_manager'|'employee'), created_at
role_permissions       id, role, permission_key, enabled, updated_at
ai_insights            id, tenant_id, generated_at, input_snapshot, insights_json, charts_json, custom_query

-- Batch module (new, Drizzle-managed)
tb_audit_log           audit_id, user_id, action, module, old_value, new_value, created_at
tb_notification_config config_id, tenant_id, channel ('email'|'slack'|'webhook'), config_json, enabled, created_at, updated_at
tb_notification_history history_id, config_id, batch_history_id, status, message, sent_at
tb_job_execution_audit  audit_id, collector_id, triggered_by, trigger_type ('manual'|'scheduled'|'retry'), started_at, ended_at, status, notes
```

### Batch Read-Only Tables (exist in prod, mirrored in PGlite for tests)

```
tb_integration_collector   collector_id, job_name, cron_schedule, integration_id, tenant_id, app_id, request_param, request_path, active_yn, internal_yn, create_date, update_date
tb_integration_config      integration_config_id, app_id, tenant_id, integration_id, param_key, value, create_date, update_date
tb_tenant                  tenant_id, company_key, customer_code, delete_yn, create_date, update_date
tb_integration_parser      parser_id, tenant_id, integration_id, collector_id, parsing_code, create_date, update_date
tb_batch_history           batch_history_id, batch_date, integration_id, tenant_id, collector_id, execution_cnt, crawling_status, crawling_start_time, crawling_end_time, parsing_status, parsing_start_time, parsing_end_time, create_date, update_date
tb_raw_data                raw_data_id, batch_date, integration_id, tenant_id, app_id, collector_id, execution_cnt, parse_yn, data (JSONB), create_user_id, create_date, update_date
tb_raw_data_detail         raw_data_detail_id, batch_date, integration_id, tenant_id, app_id, collector_id, execution_cnt, seq_no, parse_yn, data (JSONB), create_user_id, create_date, update_date
```

Batch status codes: `S` = Success, `F` = Failed, `R` = Running, `P` = Pending

### role_permissions Keys

| Permission Key | executive | it_manager | employee |
|----------------|-----------|------------|----------|
| `view_overview` | ✓ | ✓ | ✓ |
| `view_service_requests` | — | ✓ | ✓ |
| `view_change_requests` | — | ✓ | ✓ |
| `view_operational_changes` | — | ✓ | ✓ |
| `view_ai_insights` | — | ✓ | — |
| `export_csv` | — | ✓ | — |
| `batch_view_dashboard` | ✓ | ✓ | — |
| `batch_manage_jobs` | — | ✓ | — |
| `batch_view_raw_data` | — | ✓ | — |
| `batch_manage_config` | — | — | — (super_admin only) |
| `batch_view_health` | — | ✓ | — |

### API Middleware Chain

```
requireAuth → requireTenantAccess → requirePermission(key)
```

Super-admin routes use `requireSuperAdmin` instead of steps 2+3.

### API Surface

#### JSM / Auth
```
POST /api/auth/login                          GET  /api/overview/stats
POST /api/auth/logout                         GET  /api/service-requests
GET  /api/auth/me                             GET  /api/service-requests/export
GET  /api/tenants                             GET  /api/change-requests
GET  /api/user/permissions                    GET  /api/change-requests/export
                                              GET  /api/operational-changes
POST /api/ai-insights/analyze                 GET  /api/operational-changes/export
GET  /api/ai-insights
```

#### Admin
```
GET/POST       /api/admin/tenants
PUT            /api/admin/tenants/:id
GET/POST       /api/admin/users
GET/PUT        /api/admin/users/:id/roles
GET/PUT        /api/admin/role-permissions
POST/DELETE    /api/admin/user-tenant-roles
POST/DELETE    /api/admin/user-permissions
```

#### Batch
```
GET  /api/batch/dashboard/summary
GET  /api/batch/dashboard/trends

GET  /api/batch/jobs
POST /api/batch/jobs/:id/run
POST /api/batch/jobs/:id/stop
POST /api/batch/jobs/:id/retry
PUT  /api/batch/jobs/:id

GET  /api/batch/history
GET  /api/batch/history/:id
POST /api/batch/history/:id/retry
GET  /api/batch/history/export

GET  /api/batch/raw-data
GET  /api/batch/raw-data/:id
GET  /api/batch/raw-data/export

GET  /api/batch/parsed-data
GET  /api/batch/parsed-data/:id
GET  /api/batch/parsed-data/export

GET/POST/PUT/DELETE /api/batch/collectors
GET/POST/PUT/DELETE /api/batch/integration-config
GET/POST/PUT/DELETE /api/batch/parsers

GET/POST/PUT/DELETE /api/batch/notifications/config
GET                 /api/batch/notifications/history

GET  /api/batch/audit
GET  /api/batch/audit/export

GET  /api/system/health
GET  /api/system/db-pool
GET  /api/system/scheduler
GET  /api/system/thread
```

### Routes

```
/login
/                          → JSM Overview Dashboard
/service-requests          → SR page
/change-requests           → CR page
/operational-changes       → OC page
/ai-insights               → AI Agent Panel

/admin                     → Super-admin overview
/admin/tenants             → Manage tenants
/admin/users               → Manage users
/admin/users/:id/roles     → Assign tenant-role pairs
/admin/roles               → Configure role permissions matrix

/batch                     → Batch execution summary dashboard
/batch/jobs                → Job management
/batch/history             → Execution history
/batch/raw-data            → Raw data viewer
/batch/parsed-data         → Parsed data viewer
/batch/config              → Integration configuration (collectors, config, parsers)
/batch/notifications       → Notification config + history
/batch/audit               → Audit log
/batch/health              → System health
```

### JSM Data Source Rules

- All JSM dashboard data is read from `v_jsm_sr_cr_oc` PostgreSQL view (read-only).
- Every query must include `WHERE tenant_id = ?` — no cross-tenant data.
- `is_ontime` is trusted as-is from the view; never recalculated (ADR-0001).
- SR, CR, OC have dedicated pages — not a unified view (ADR-0002).

### Batch Data Source Rules

- `tb_batch_history`, `tb_raw_data`, `tb_raw_data_detail` are read-only from our layer.
- `tb_integration_collector`, `tb_integration_config`, `tb_integration_parser` support CRUD (super_admin only for writes).
- All batch queries include `WHERE tenant_id = ?`.
- Credential values (`access_key`, `secret_key`, `token`, `password`, `api_key`, `authorization`) are masked as `"***"` in GET responses.

### AI Agent

- Model: `claude-sonnet-4-6` via Anthropic SDK.
- Receives a pre-built JSON snapshot of aggregated tenant metrics — no raw SQL results.
- Invokes predefined parameterized tool functions only. No arbitrary SQL (ADR-0004).
- Scoped strictly to the selected tenant.
- Last 10 analyses per tenant stored in `ai_insights`.

---

## Testing Decisions

**Rule**: Tests verify external behavior through public interfaces, not implementation details. A test survives any internal refactor.

**Primary seam — Fastify route level**: Every API endpoint tested via `app.inject()` + PGlite in-memory database. Same `buildApp(db)` factory in production and tests. No mocking of the application database.

**JSM view / batch tables in tests**: Plain PGlite tables with the same column shapes as the real views/tables, created in `createTestDb()` and seeded with fixture rows.

**Batch-specific invariants**:
- Every `/api/batch/*` route rejects without a valid session (401).
- Every batch data route scopes results to `tenant_id` — no cross-tenant rows.
- Job run/stop/retry creates an audit row in `tb_job_execution_audit`.
- Config GET responses never return plaintext credential values.
- `batch_manage_config` routes return 403 for non-super-admin.

**Secondary seam — React (Vitest + RTL)**: Loading skeletons, empty states, error states, role-conditioned navigation.

**Anthropic SDK**: Mocked at the SDK boundary in AI Insights tests only.

---

## Implementation Issues

| # | Issue | Module | Status | Blocked by |
|---|-------|--------|--------|------------|
| 1 | Monorepo Scaffolding | Infra | ✅ Done | — |
| 2 | Authentication | Auth | ✅ Done | #1 |
| 3 | Tenant Selector + Role Enforcement | Auth | ✅ Done | #2 |
| 4 | Super-Admin — User & Tenant Management | Admin | ✅ Done | #3 |
| 5 | Role Permissions Matrix | Admin | ✅ Done | #4 |
| 6 | Overview Dashboard | JSM | ✅ Done | #3 |
| 7 | Service Requests Page | JSM | ✅ Done | #6 |
| 8 | Change Requests Page | JSM | ✅ Done | #6 |
| 9 | Operational Changes Page | JSM | ✅ Done | #6 |
| 10 | AI Insights Page | JSM | ✅ Done | #6 |
| 11 | Master PRD | Docs | ✅ Done | — |
| 15 | Batch DB Schema & Data Access Layer | Batch | ⬜ | #1 |
| 16 | Batch Dashboard (FR-1) | Batch | ⬜ | #15, #3 |
| 17 | Job Management Module (FR-2) | Batch | ⬜ | #15, #3 |
| 18 | Execution History Module (FR-3) | Batch | ⬜ | #15, #3 |
| 19 | Raw Data Viewer (FR-4) | Batch | ⬜ | #15, #3 |
| 20 | Parsed Data Viewer (FR-5) | Batch | ⬜ | #15, #3 |
| 21 | Integration Configuration Module (FR-6) | Batch | ⬜ | #15, #4 |
| 22 | Notification Module (FR-7) | Batch | ⬜ | #15, #3 |
| 23 | Audit Log Module (FR-8) | Batch | ⬜ | #15, #3 |
| 24 | System Health Monitor (FR-9) | Batch | ⬜ | #15 |

---

## Out of Scope

- Write-back to JSM (read-only throughout — ADR-0005)
- PDF or chart screenshot export
- SSO / LDAP / external identity provider
- Cross-tenant AI analysis or benchmarking
- Mobile app (tablet and desktop only)
- Custom dashboard builder
- Historical snapshots of JSM data (real-time view only)
- JVM / Spring Boot internal metrics (observable from Fastify layer: DB pool + scheduler only)
- Direct database editing from the UI (configuration changes go through API)
- Grafana integration (future enhancement)
- AI anomaly detection on batch data (future enhancement)

---

## Further Notes

- ADRs for key architectural decisions: `docs/adr/` (ADR-0001 through ADR-0006).
- Full SRS for batch module: `docs/SRS-cportal-batch-dashboard.md`.
- `status_category` distinct values must be confirmed against the production JSM view before implementing color-coded KPI grouping.
- `company` in the JSM view = tenant; `client_company` = issue reporter's org. Never conflate in queries or labels.
- Batch credential fields to mask: `access_key`, `secret_key`, `token`, `password`, `api_key`, `authorization`, `username`.
