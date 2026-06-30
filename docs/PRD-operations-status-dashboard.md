# PRD: Operations Status Dashboard + AI Agent

## Problem Statement

The internal operations team has no centralized view of their JSM service operations data. To check SLA compliance, issue volumes, or operational health, team members must log into JSM directly and construct ad-hoc queries — a context-switching overhead that delays decision-making and obscures trends across Service Requests (SR), Change Requests (CR), and Operational Changes (OC). There is no role-appropriate view that surfaces the right level of detail for each team member (executive summary vs. assignee-level detail), no AI-powered analysis of patterns and anomalies, and no way to see metrics scoped to a specific tenant without manual filtering.

## Solution

An internal Operations Status Dashboard that reads directly from the `v_jsm_sr_cr_oc` JSM view in real-time and presents SLA compliance, issue trends, and AI-generated insights in a role-appropriate, tenant-scoped interface. The dashboard is read-only — actions on issues remain in JSM. A super-admin layer manages which users can access which tenants and with what role. An embedded AI agent (Claude) analyzes the current tenant's data and generates actionable insight cards and custom Recharts-compatible chart configurations.

## User Stories

### Authentication & Session

1. As an ops team member, I want to log in with my email and password, so that I can access the dashboard securely.
2. As an ops team member, I want my session to persist across browser refreshes, so that I do not have to log in repeatedly.
3. As an ops team member, I want to be redirected to the login page when my session expires, so that I am never silently logged out without feedback.
4. As an ops team member, I want to log out from any page, so that I can end my session on shared machines.

### Tenant Selection & Role Enforcement

5. As an ops team member, I want to select a tenant from a dropdown after logging in, so that I see data scoped to that organization only.
6. As an ops team member, I want the tenant dropdown to show only the tenants I have been granted access to, so that I cannot see data I am not authorized to view.
7. As an IT Manager, I want to see all pages and filters for the selected tenant, so that I have a complete operational picture.
8. As an Executive, I want to see only KPI summary cards and SLA trend charts, so that I get a high-level view without operational noise.
9. As an Employee, I want to see only issues assigned to me (`assignee_id`), so that I can focus on my own workload without cross-team visibility.
10. As any user, I want my role to be evaluated against the currently selected tenant, so that switching tenants correctly updates my permissions.

### Overview Dashboard (`/`)

11. As an IT Manager, I want to see a SLA Compliance Rate (% of `is_ontime = true`) across all issue types, so that I can assess overall operational health at a glance.
12. As an IT Manager, I want to see Open Issues counts broken down by type (SR / CR / OC), so that I understand current backlog distribution.
13. As an IT Manager, I want to see Urgent Open Issues count (`urgency_yn = 'Y'` and unresolved), so that I can prioritize immediate attention.
14. As an IT Manager, I want to see Overdue Issues count (past `due_date` and unresolved), so that I know what is at risk.
15. As an IT Manager, I want to see Average Resolution Time (`total_leadtime` average), so that I can benchmark operational efficiency.
16. As any user, I want the dashboard to auto-refresh every 5 minutes, so that I see current data without manually reloading.
17. As any user, I want a "last updated" timestamp on the overview, so that I know how fresh the data is.
18. As any user, I want loading skeletons during data fetch, so that the page does not feel broken while loading.
19. As any user, I want an empty state if no data is available for the selected tenant, so that I am not shown a blank screen.
20. As any user, I want an error state if the API call fails, so that I know data could not be loaded rather than assuming there is none.

### Service Requests Page (`/service-requests`)

21. As an IT Manager, I want to see a SLA compliance rate for SRs only, so that I can assess SR performance independently.
22. As an IT Manager, I want to see a filterable list of SRs by `status_category`, `service_level`, `urgency_yn`, and assignee, so that I can isolate specific segments.
23. As an IT Manager, I want to see average `total_leadtime` trend over the selected date range, so that I can track whether resolution speed is improving or degrading.
24. As an IT Manager, I want to see top assignees by SR volume, so that I can identify overloaded team members.
25. As any user, I want a default date range of the last 30 days, so that I see a meaningful window of data without waiting for the full history.
26. As any user, I want to change the date range (last 7 / 30 / 90 days or custom), so that I can investigate specific periods.
27. As an IT Manager, I want to export the current filtered SR list as CSV, so that I can perform further analysis in a spreadsheet.

### Change Requests Page (`/change-requests`)

28. As an IT Manager, I want to see a SLA compliance rate for CRs only, so that I can assess change management performance.
29. As an IT Manager, I want to see a filterable list of CRs by `status_category`, `chg_category`, and `service_level`, so that I can segment by change type.
30. As an IT Manager, I want to see a breakdown of CRs by `chg_category` as a bar or pie chart, so that I understand which change types dominate the workload.
31. As an IT Manager, I want to see on-time vs overdue counts grouped by `chg_category`, so that I know which change types miss SLA most often.
32. As an IT Manager, I want to export the current filtered CR list as CSV.

### Operational Changes Page (`/operational-changes`)

33. As an IT Manager, I want to see a SLA compliance rate for OCs only.
34. As an IT Manager, I want to see a filterable list of OCs by `status_category`, `chg_category`, and `service_level`.
35. As an IT Manager, I want to see OC cancellation and stop reason breakdowns (`cancel_reason`, `stop_reason`), so that I understand why operational changes fail.
36. As an IT Manager, I want to see average `total_leadtime` for OCs, so that I can assess operational execution speed.
37. As an IT Manager, I want to export the current filtered OC list as CSV.

### AI Insights Page (`/ai-insights`)

38. As an IT Manager, I want to trigger an AI analysis of the current tenant's data by clicking "Analyze Now", so that I get actionable insights without manually reviewing raw data.
39. As any user, I want to optionally enter a custom query before triggering analysis, so that I can focus the AI on a specific area of concern.
40. As any user, I want each AI insight to show a title, detail, severity (Info / Warning / Critical), and a recommended action, so that I know not just what is happening but what to do about it.
41. As any user, I want insight cards to be color-coded by severity (green / yellow / red), so that I can prioritize at a glance.
42. As any user, I want AI-generated custom charts rendered below the insight cards, so that I can see visualizations not available on the standard dashboard.
43. As any user, I want each AI chart to have a title and description explaining why it is useful, so that I understand its purpose without guessing.
44. As any user, I want to see the last 10 AI analyses for the selected tenant, so that I can review historical insights without re-running the analysis.
45. As any user, I want an empty state if no analysis has been run yet, so that I am prompted to trigger one rather than seeing a blank screen.

### Super-Admin Area (`/admin`)

46. As a super-admin, I want to add new tenants to the system, so that new customer organizations can be onboarded.
47. As a super-admin, I want to edit tenant details, so that I can keep tenant records accurate.
48. As a super-admin, I want to add new admin users, so that new ops team members can log in.
49. As a super-admin, I want to assign a user to a tenant with a specific role (Executive / IT Manager / Employee), so that I control exactly what each person sees for each customer.
50. As a super-admin, I want to remove a user's access to a tenant, so that I can revoke access without deleting the user.
51. As a super-admin, I want to configure the permissions matrix for each role (what each role can see on each page), so that I can adjust visibility without developer intervention.
52. As a super-admin, I want to see a list of all users and their tenant-role assignments, so that I can audit access at any time.

## Implementation Decisions

### Data Source
- All dashboard data is read from the `v_jsm_sr_cr_oc` PostgreSQL view, which is a real-time JSM view.
- The view is read-only. No write operations are performed against JSM.
- Every query to the view must include a `WHERE tenant_id = ?` clause. No query may return cross-tenant data.

### Multi-Tenancy
- `tenant_id` (BIGINT) is the isolation key. It corresponds to the `company` / `company_key` fields in the view.
- `client_company` / `client_name` refer to the issue reporter's organization — distinct from the tenant.
- The tenant dropdown at the top of the authenticated layout shows only tenants the current user has access to.

### Role Model
- Four roles: `super_admin`, `executive`, `it_manager`, `employee`.
- `super_admin` is a system-level role with no tenant context — manages users, tenants, and role permissions.
- `executive`, `it_manager`, and `employee` are tenant-scoped roles.
- A single user can have different roles for different tenants (stored in `user_tenant_roles`).
- Role permissions are configurable via the admin UI and stored in a `role_permissions` table.

### Role Visibility Defaults
- **Executive**: Overview KPIs and SLA trend charts only.
- **IT Manager**: Full access to all pages, filters, AI insights, and CSV export.
- **Employee**: Issue lists filtered to `assignee_id = current_user` only; no cross-team data.

### Database Schema (Application DB — not JSM)

```
admin_users         id, email, password_hash, created_at
sessions            id, admin_user_id, token, expires_at
user_tenant_roles   id, user_id, tenant_id, role, created_at
role_permissions    id, role, permission_key, enabled, updated_at
```

### SLA Compliance
- The `is_ontime` field from the view is trusted as the authoritative SLA signal. The app does not recalculate it from `due_date` vs `resolution_date` (see ADR-0001).
- `service_level` is an SLA tier (e.g., Gold / Silver / Bronze) and is available as a filter on every issue-type page.
- `status_category` is the primary grouping field for issue state. Exact values to be confirmed by running `SELECT DISTINCT status_category FROM v_jsm_sr_cr_oc`.

### Issue Type Pages
- SR, CR, and OC have dedicated pages rather than a single unified filtered view (see ADR-0002).
- CR and OC share the change-specific fields: `chg_category`, `chg_purpose`, `chg_charge_of`, `chg_req_by`.
- SR uses `req_class` and `req_type` for classification.

### Date Filtering
- Default date range: last 30 days on all pages.
- Options: last 7 days / 30 days / 90 days / custom range picker.

### Auto-Refresh
- TanStack Query handles background refetching every 5 minutes on all data pages.
- Stale data is visually indicated; loading skeletons shown during refetch.

### CSV Export
- Available to IT Managers on SR, CR, and OC pages.
- Exports the current filtered and date-scoped issue list.
- PDF export and chart export are out of scope (see ADR-0005).

### AI Agent
- Model: `claude-sonnet-4-6` via the Anthropic API.
- Claude receives a pre-built JSON snapshot of the current tenant's aggregated metrics on every analysis request.
- Claude can invoke a set of predefined, parameterized query tool functions. It cannot write or execute arbitrary SQL (see ADR-0004).
- All AI analysis is strictly scoped to the currently selected tenant.
- Each insight includes: `title`, `detail`, `severity` (Info | Warning | Critical), `recommended_action`.
- Each chart includes: `title`, `description`, and a Recharts-compatible config object.
- The last 10 analyses per tenant are stored in the `ai_insights` table.

### Frontend Stack
- Recharts for all charts (dashboard and AI-generated).
- Light theme only.
- Lucide React for all icons.
- Color coding: green = healthy, yellow = warning, red = critical.
- TanStack Router for routing; TanStack Query for all data fetching.
- React Hook Form + Zod for all forms (login, admin forms, date pickers).

### Routes

```
/login
/                          → Overview Dashboard
/service-requests          → SR page
/change-requests           → CR page
/operational-changes       → OC page
/ai-insights               → AI Agent Panel
/admin                     → Super-admin overview
/admin/tenants             → Manage tenants
/admin/users               → Manage users
/admin/users/:id/roles     → Assign tenant-role pairs to a user
/admin/roles               → Configure role permissions matrix
```

### API Endpoints

```
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me

GET  /api/tenants                        → tenants accessible to current user
GET  /api/metrics/overview               → 5 KPIs for selected tenant
GET  /api/metrics/service-requests       → SR list + metrics
GET  /api/metrics/change-requests        → CR list + metrics
GET  /api/metrics/operational-changes    → OC list + metrics
GET  /api/metrics/service-requests/export → CSV download
GET  /api/metrics/change-requests/export  → CSV download
GET  /api/metrics/operational-changes/export → CSV download

POST /api/ai/analyze                     → Trigger AI analysis
GET  /api/ai/insights/history            → Last 10 analyses for tenant

GET  /api/admin/tenants
POST /api/admin/tenants
PUT  /api/admin/tenants/:id
GET  /api/admin/users
POST /api/admin/users
GET  /api/admin/users/:id/roles
PUT  /api/admin/users/:id/roles
GET  /api/admin/role-permissions
PUT  /api/admin/role-permissions
```

## Testing Decisions

**What makes a good test**: Tests should verify external behavior at the highest seam possible — not implementation details. A test should remain valid after an internal refactor.

**Primary seam — Fastify route level (backend)**: Test each API endpoint by calling it through Fastify's test utilities with real database interactions (not mocked). This catches tenant scoping bugs, role enforcement failures, and data shape mismatches simultaneously.

Key behaviors to test at this seam:
- Every metrics endpoint rejects requests without a valid session.
- Every metrics endpoint rejects requests where the user does not have access to the requested `tenant_id`.
- Every metrics endpoint filters data by `tenant_id` — never leaks cross-tenant rows.
- Role enforcement middleware returns 403 for unauthorized roles (e.g., Employee hitting a cross-team endpoint).
- CSV export endpoints return `Content-Type: text/csv` with correct headers.
- The AI analysis endpoint calls predefined tool functions and never passes raw SQL to Claude.

**Secondary seam — React component / TanStack Query level (frontend)**: Test pages with Vitest and React Testing Library against mocked API responses. Focus on empty states, error states, loading skeletons, and role-conditioned UI rendering.

**No mocking of the application database**: Integration tests hit a real PostgreSQL test database seeded with fixtures (see ADR rationale in ADR-0003).

## Out of Scope

- Write-back to JSM (reassigning, resolving, or updating issues from the dashboard)
- PDF export or chart screenshot export
- Real-time alerts or push notifications for SLA breaches
- SSO / LDAP / external identity provider integration
- Cross-tenant AI analysis or benchmarking
- Mobile app (responsive to tablet and desktop only)
- Email reports or scheduled digests
- Custom dashboard builder (users cannot rearrange or configure widgets)
- Historical snapshots of JSM data (dashboard reflects current real-time view only)

## Further Notes

- The `status_category` distinct values must be confirmed by querying the production view before implementing status-based color coding and KPI grouping. Placeholder: assumes Jira standard categories (To Do / In Progress / Done) until confirmed.
- ADRs for the five key architectural decisions are in `docs/adr/` (ADR-0001 through ADR-0005).
- The `company` field in the view maps to the tenant. `client_company` maps to the issue reporter's organization. These are distinct and must not be conflated in any query or label.
