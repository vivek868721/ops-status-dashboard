# ADR-0003: Per-tenant role assignments stored in own database

## Status
Accepted

## Context
The dashboard is multi-tenant. Ops users can have different roles for different tenants (e.g., Executive for Tenant A, Employee for Tenant B). Two approaches were considered: global roles that apply across all tenants a user can access, or per-tenant role assignments managed in our own database.

## Decision
Per-tenant role assignments stored in a `user_tenant_roles (user_id, tenant_id, role)` table in the application's own database. No external identity provider.

## Consequences
- A user's permissions are always evaluated against the currently selected tenant — the same user sees different data and UI depending on which tenant is active
- The super-admin UI must manage this mapping (adding/removing user-tenant-role entries)
- Every API request must validate `(user_id, tenant_id, role)` — not just authentication, but also authorization per tenant
- No SSO or LDAP dependency — simpler to deploy, but no single sign-on across other internal tools
- Role changes take effect immediately on next request — no token re-issuance needed
