# ADR-0004: AI agent receives a snapshot and calls predefined query tools — no raw SQL

## Status
Accepted

## Context
The AI agent (Claude) needs data to generate insights and custom charts. Three approaches were considered: (1) send only a pre-built JSON snapshot, (2) allow Claude to generate and run arbitrary SQL, (3) hybrid — pre-built snapshot plus a set of named, parameterized query functions Claude can call as tools.

## Decision
Hybrid approach: Claude receives a pre-built JSON snapshot of the current tenant's aggregated metrics on every analysis request, and can invoke a fixed set of predefined query tool functions (e.g., `get_issues_by_status`, `get_sla_breach_rate`) with parameters. Claude cannot write or execute arbitrary SQL.

## Consequences
- Tenant isolation is guaranteed — every predefined tool function enforces `WHERE tenant_id = ?` internally
- No SQL injection risk from AI-generated queries
- Claude's analysis depth is bounded by the predefined tool set — adding a new query type requires a developer to implement a new tool function
- Predefined tools must be maintained and versioned as the schema evolves
- Using Claude (`claude-sonnet-4-6`) with Anthropic's tool use API
