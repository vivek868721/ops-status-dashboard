export type User = { id: number; email: string };

// What GET /api/tenants returns per entry
export type TenantItem = {
  tenantId: number;
  name: string | null;
  systemRole: string;
};

// Data-access permission level (shown as second dropdown)
export type Permission = "executive" | "it_manager" | "employee";

export type OverviewStats = {
  slaComplianceRate: number;
  openSR: number;
  openCR: number;
  openOC: number;
  urgentOpen: number;
  overdue: number;
  avgResolutionDays: number;
  lastUpdated: string;
};

export type IssueItem = {
  issueKey: string;
  title: string;
  statusCategory: string;
  serviceLevel: string;
  urgencyYn: string;
  assigneeName: string;
  issueCreateDate: string;
  dueDate: string | null;
  resolutionDate: string | null;
  isOntime: boolean | null;
  totalLeadtime: number | null;
};

export type SRData = {
  slaRate: number;
  avgLeadtime: number;
  topAssignees: { name: string; count: number }[];
  items: IssueItem[];
};

export type CRData = {
  slaRate: number;
  items: (IssueItem & { chgCategory: string })[];
  byCategory: { category: string | null; total: number; ontime: number; overdue: number }[];
};

export type OCData = {
  slaRate: number;
  avgLeadtime: number;
  items: IssueItem[];
  cancelReasons: { reason: string; count: number }[];
  stopReasons: { reason: string; count: number }[];
};

export type InsightSeverity = "info" | "warning" | "critical";

export type Insight = {
  title: string;
  detail: string;
  severity: InsightSeverity;
  recommendedAction: string;
};

export type ChartConfig = {
  type: "BarChart" | "LineChart" | "PieChart";
  title: string;
  description: string;
  data: { name: string; value: number }[];
};

export type Analysis = {
  id: number;
  generatedAt: string;
  customQuery?: string;
  insights: Insight[];
  charts: ChartConfig[];
};

export type DateRange = "7d" | "30d" | "90d";

export type RawDataItem = {
  id: number;
  batchDate: string | null;
  integrationId: string | null;
  tenantId: number | null;
  collectorId: number | null;
  parseYn: string | null;
  createdAt: string | null;
};

export type RawDataDetail = RawDataItem & { data: string | null };

export type HistoryItem = {
  id: number;
  batchDate: string | null;
  integrationId: string | null;
  tenantId: number | null;
  collectorId: number | null;
  crawlingStatus: string | null;
  parseStatus: string | null;
  createdAt: string | null;
};

export type BatchJob = {
  collectorId: number;
  jobName: string;
  cronSchedule: string | null;
  integrationId: string | null;
  activeYn: string | null;
  lastRunAt: string | null;
  createdAt: string | null;
};

export type BatchSummary = {
  total: number;
  success: number;
  failed: number;
  running: number;
  pending: number;
  active: number;
  successRate: number;
};

export type BatchTrends = {
  dailyTrend: { date: string; total: number; success: number; failed: number }[];
  integrationDistribution: { integrationId: string; count: number }[];
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = init.body ? { "Content-Type": "application/json" } : {};

  const tenantId = localStorage.getItem("tenantId");
  if (tenantId) headers["X-Tenant-Id"] = tenantId;

  const permission = localStorage.getItem("permission");
  if (permission) headers["X-Permission"] = permission;

  Object.assign(headers, init.headers);

  const res = await fetch(`/api${path}`, {
    credentials: "include",
    ...init,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (body as { error?: string }).error ?? res.statusText);
  }

  return res.json() as Promise<T>;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

async function downloadCsv(path: string, filename: string) {
  const headers: Record<string, string> = {};
  const tenantId = localStorage.getItem("tenantId");
  if (tenantId) headers["X-Tenant-Id"] = tenantId;
  const permission = localStorage.getItem("permission");
  if (permission) headers["X-Permission"] = permission;

  const res = await fetch(`/api${path}`, { credentials: "include", headers });
  if (!res.ok) throw new ApiError(res.status, res.statusText);

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const api = {
  auth: {
    me: () => req<User>("/auth/me"),
    login: (email: string, password: string) =>
      req<{ ok: boolean }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    logout: () => req<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  },

  tenants: {
    list: () => req<TenantItem[]>("/tenants"),
  },

  userPermissions: {
    list: () => req<Permission[]>("/user/permissions"),
  },

  overview: {
    stats: () => req<OverviewStats>("/overview/stats"),
  },

  serviceRequests: {
    list: (params: { from?: string; to?: string; status?: string; urgency?: string; assignee?: string }) =>
      req<SRData>(`/service-requests${buildQuery(params)}`),
    exportCsv: () => downloadCsv("/service-requests/export", "service-requests.csv"),
  },

  changeRequests: {
    list: (params: { from?: string; to?: string; status?: string; chgCategory?: string }) =>
      req<CRData>(`/change-requests${buildQuery(params)}`),
    exportCsv: () => downloadCsv("/change-requests/export", "change-requests.csv"),
  },

  operationalChanges: {
    list: (params: { from?: string; to?: string; status?: string; chgCategory?: string }) =>
      req<OCData>(`/operational-changes${buildQuery(params)}`),
    exportCsv: () => downloadCsv("/operational-changes/export", "operational-changes.csv"),
  },

  aiInsights: {
    list: () => req<{ analyses: Analysis[] }>("/ai-insights"),
    analyze: (customQuery?: string) =>
      req<Analysis>("/ai-insights/analyze", {
        method: "POST",
        body: JSON.stringify({ customQuery }),
      }),
  },

  rawData: {
    list: (params?: { batchDate?: string; collectorId?: string; integrationId?: string }) =>
      req<{ items: RawDataItem[]; total: number }>(`/batch/raw-data${buildQuery(params ?? {})}`),
    get: (id: number) => req<{ item: RawDataDetail }>(`/batch/raw-data/${id}`),
    exportJson: () => downloadCsv("/batch/raw-data/export", "raw-data.json"),
  },

  batchHistory: {
    list: (params?: { batchDate?: string; crawlingStatus?: string; integrationId?: string }) =>
      req<{ items: HistoryItem[]; total: number }>(`/batch/history${buildQuery(params ?? {})}`),
    get: (id: number) => req<{ item: HistoryItem }>(`/batch/history/${id}`),
    retry: (id: number) => req<{ ok: boolean }>(`/batch/history/${id}/retry`, { method: "POST" }),
    exportCsv: () => downloadCsv("/batch/history/export", "batch-history.csv"),
  },

  batch: {
    summary: (params?: { startDate?: string; endDate?: string }) =>
      req<BatchSummary>(`/batch/dashboard/summary${buildQuery(params ?? {})}`),
    trends: (params?: { startDate?: string; endDate?: string }) =>
      req<BatchTrends>(`/batch/dashboard/trends${buildQuery(params ?? {})}`),
    jobs: {
      list: () => req<{ jobs: BatchJob[] }>("/batch/jobs"),
      update: (id: number, data: { cronSchedule?: string; activeYn?: string }) =>
        req<{ job: BatchJob }>(`/batch/jobs/${id}`, { method: "PUT", body: JSON.stringify(data) }),
      run: (id: number) => req<{ ok: boolean }>(`/batch/jobs/${id}/run`, { method: "POST" }),
      stop: (id: number) => req<{ ok: boolean }>(`/batch/jobs/${id}/stop`, { method: "POST" }),
      retry: (id: number) => req<{ ok: boolean }>(`/batch/jobs/${id}/retry`, { method: "POST" }),
    },
  },
};
