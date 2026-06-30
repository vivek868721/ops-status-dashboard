# ADR-0002: Separate pages per issue type (SR / CR / OC)

## Status
Accepted

## Context
The `v_jsm_sr_cr_oc` view covers three issue types: Service Requests (SR), Change Requests (CR), and Operational Changes (OC). Two routing approaches were considered: a single unified page with an issue-type filter, or dedicated pages per type (`/service-requests`, `/change-requests`, `/operational-changes`).

## Decision
Dedicated pages per issue type.

## Consequences
- Each page can surface type-specific fields without cluttering others (e.g., `chg_category`, `chg_purpose` appear only on CR and OC pages)
- Role-based visibility can be applied per-page cleanly
- Adds more routes and components to maintain
- A unified cross-type view (e.g., "all open urgent issues regardless of type") is not available as a built-in page — it would require a custom AI insight or future feature
