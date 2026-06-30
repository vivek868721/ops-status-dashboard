# ADR-0005: Dashboard is read-only; export limited to CSV

## Status
Accepted

## Context
The dashboard reads from a JSM view (`v_jsm_sr_cr_oc`). Two questions arose: (1) should ops users be able to take actions on issues from within the dashboard (e.g., reassign, resolve), and (2) what export formats should be supported.

## Decision
The dashboard is strictly read-only — no write-back to JSM. Export is limited to CSV of the current filtered issue list. PDF export (charts included) is explicitly out of scope.

## Consequences
- Actions on issues must be performed in JSM directly — the dashboard is a visualization and insight layer only
- No JSM API write credentials are needed — reduces attack surface and integration complexity
- CSV export covers the "I need this in a spreadsheet" use case without server-side PDF rendering complexity
- If ops users need to share a report with charts, they must use AI insights or take a screenshot
