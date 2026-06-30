# ADR-0001: Trust `is_ontime` from the database view

## Status
Accepted

## Context
The `v_jsm_sr_cr_oc` view contains an `is_ontime` flag alongside raw date fields (`due_date`, `resolution_date`). SLA compliance is the primary KPI of the dashboard. Two options existed: trust the pre-calculated `is_ontime` field, or derive it in the application layer from `due_date` vs `resolution_date`.

## Decision
Trust `is_ontime` as-is from the view. Do not recalculate SLA compliance in the application.

## Consequences
- SLA business logic lives in one place (the DB view), not split between DB and app
- If the view's logic is wrong, all SLA metrics are wrong — there is no app-layer fallback
- `is_ontime` may mean different things for SR, CR, and OC — the view encapsulates that distinction; the app does not need to know the rules per type
- Any change to SLA rules requires updating the view, not the application code
