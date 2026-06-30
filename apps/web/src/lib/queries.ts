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

export const overviewQueryOptions = queryOptions({
  queryKey: ["overview", "stats"],
  queryFn: () => api.overview.stats(),
  refetchInterval: 5 * 60 * 1000,
  staleTime: 60 * 1000,
});

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

export const aiInsightsQueryOptions = queryOptions({
  queryKey: ["ai-insights"],
  queryFn: () => api.aiInsights.list(),
  staleTime: 30 * 1000,
});
