import { queryOptions } from "@tanstack/react-query";
import { api, type DateRange } from "./api";

function dateRangeDates(range: DateRange): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  from.setDate(from.getDate() - days);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export const authQueryOptions = queryOptions({
  queryKey: ["auth", "me"],
  queryFn: () => api.auth.me(),
  retry: false,
  staleTime: 5 * 60 * 1000,
});

export const tenantsQueryOptions = queryOptions({
  queryKey: ["tenants"],
  queryFn: () => api.tenants.list(),
  staleTime: 5 * 60 * 1000,
});

function hasTenantContext() {
  return !!localStorage.getItem("tenantId") && !!localStorage.getItem("permission");
}

export function overviewQueryOptions() {
  return queryOptions({
    queryKey: ["overview", "stats"],
    queryFn: () => api.overview.stats(),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
    enabled: hasTenantContext(),
  });
}

export function srQueryOptions(
  range: DateRange,
  filters: { status?: string; urgency?: string; assignee?: string },
) {
  return queryOptions({
    queryKey: ["service-requests", range, filters],
    queryFn: () => api.serviceRequests.list({ ...dateRangeDates(range), ...filters }),
    staleTime: 60 * 1000,
  });
}

export function crQueryOptions(range: DateRange, filters: { status?: string; chgCategory?: string }) {
  return queryOptions({
    queryKey: ["change-requests", range, filters],
    queryFn: () => api.changeRequests.list({ ...dateRangeDates(range), ...filters }),
    staleTime: 60 * 1000,
  });
}

export function ocQueryOptions(range: DateRange, filters: { status?: string; chgCategory?: string }) {
  return queryOptions({
    queryKey: ["operational-changes", range, filters],
    queryFn: () => api.operationalChanges.list({ ...dateRangeDates(range), ...filters }),
    staleTime: 60 * 1000,
  });
}

export const userPermissionsQueryOptions = queryOptions({
  queryKey: ["user", "permissions"],
  queryFn: () => api.userPermissions.list(),
  staleTime: 5 * 60 * 1000,
});

export function aiInsightsQueryOptions() {
  return queryOptions({
    queryKey: ["ai-insights"],
    queryFn: () => api.aiInsights.list(),
    staleTime: 30 * 1000,
    enabled: hasTenantContext(),
  });
}

export function rawDataQueryOptions(params?: { batchDate?: string; collectorId?: string; integrationId?: string }) {
  return queryOptions({
    queryKey: ["batch", "raw-data", params],
    queryFn: () => api.rawData.list(params),
    staleTime: 30 * 1000,
    enabled: hasTenantContext(),
  });
}

export function rawDataDetailQueryOptions(id: number | null) {
  return queryOptions({
    queryKey: ["batch", "raw-data", id],
    queryFn: () => api.rawData.get(id!),
    staleTime: 60 * 1000,
    enabled: id !== null && hasTenantContext(),
  });
}

export function batchHistoryQueryOptions(params?: { batchDate?: string; crawlingStatus?: string; integrationId?: string }) {
  return queryOptions({
    queryKey: ["batch", "history", params],
    queryFn: () => api.batchHistory.list(params),
    staleTime: 30 * 1000,
    enabled: hasTenantContext(),
  });
}

export function batchJobsQueryOptions() {
  return queryOptions({
    queryKey: ["batch", "jobs"],
    queryFn: () => api.batch.jobs.list(),
    staleTime: 30 * 1000,
    enabled: hasTenantContext(),
  });
}

export function batchSummaryQueryOptions(params?: { startDate?: string; endDate?: string }) {
  return queryOptions({
    queryKey: ["batch", "summary", params],
    queryFn: () => api.batch.summary(params),
    refetchInterval: 30 * 1000,
    staleTime: 15 * 1000,
    enabled: hasTenantContext(),
  });
}

export function batchTrendsQueryOptions(params?: { startDate?: string; endDate?: string }) {
  return queryOptions({
    queryKey: ["batch", "trends", params],
    queryFn: () => api.batch.trends(params),
    staleTime: 60 * 1000,
    enabled: hasTenantContext(),
  });
}
