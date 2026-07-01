# ADR-0006: Independent Tenant Selection and Permission Model

**Status:** Accepted  
**Date:** 2026-07-01  
**Replaces:** The role model described in ADR-0003

---

## Context

The original model (ADR-0003) stored a single `role` value (executive | it_manager | employee) per user-tenant pair. This conflated two distinct concerns:

1. **Administrative role** — what a user can *do* within a tenant (manage users, run operations, view data)
2. **Data-access permission** — what *data* a user can see (overview only, full access, own records only)

The UI requirement is that users see **two independent dropdowns** on the landing page — one for tenant selection, one for permission level — and can choose any valid combination.

---

## Decision

Split the old `user_tenant_roles.role` into two independent dimensions:

### 1. System Role (`admin_users.role`)
Global, not tenant-scoped.

| Value | Who |
|-------|-----|
| `super_admin` | System Administrator — full access to all tenants and all permissions |

### 2. Tenant Administrative Role (`user_tenant_roles.system_role`)
Per-tenant, controls what a user can *manage* within that tenant.

| Value | Capability |
|-------|------------|
| `tenant_admin` | Manages users and permissions within the tenant; can be multiple per tenant |
| `operator` | Operational role; can belong to multiple tenants |
| `member` | Basic membership; read-only access scoped by permission |

### 3. Data-Access Permission (`user_permissions` table)
**Global per user, not per tenant.** Controls what data pages the user can see, independent of which tenant is selected.

| Value | Access |
|-------|--------|
| `executive` | Overview dashboard only |
| `it_manager` | All pages + CSV export + AI Insights |
| `employee` | SR / CR / OC for own records only (`assignee_id` filter) |

A user can hold **multiple** permission levels (e.g., both `executive` and `it_manager`).

### API Request Headers

Every tenant-scoped API request carries two headers:

```
X-Tenant-Id: <tenantId>       — which tenant to query
X-Permission: <permissionLevel> — which data-access level to apply
```

The frontend populates these from the two independent dropdowns.

### Access Rules

| Scenario | Tenant access | Permission check |
|----------|--------------|-----------------|
| `super_admin` | All tenants, no check | Any permission, no check |
| `tenant_admin` / `operator` / `member` | Must have a row in `user_tenant_roles` | Must have a row in `user_permissions` |

The `role_permissions` table (unchanged) still maps permission level → feature key → enabled/disabled.

---

## Consequences

**Positive:**
- Two completely independent UI dropdowns map cleanly to two DB dimensions.
- A user can hold IT Manager access and simultaneously have Executive view on a second tenant without a separate account.
- Tenant administrative authority (who can manage a tenant) is decoupled from what data they see.

**Negative:**
- One additional DB table (`user_permissions`) and one additional request header (`X-Permission`).
- Existing clients must be updated to send `X-Permission` alongside `X-Tenant-Id`.

---

## Superseded ADR

ADR-0003 described per-tenant role assignments where `role ∈ {executive, it_manager, employee}`. That single field is now split across `user_tenant_roles.system_role` and `user_permissions.permission`.
