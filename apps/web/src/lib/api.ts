export type User = { id: number; email: string };

export type TenantRole = {
  tenantId: number;
  name: string | null;
  role: "executive" | "it_manager" | "employee";
};

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
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  const tenantId = localStorage.getItem("tenantId");
  if (tenantId) headers["X-Tenant-Id"] = tenantId;

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
    list: () => req<TenantRole[]>("/tenants"),
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
};
