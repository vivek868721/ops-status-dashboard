import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Play,
  Activity,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { batchSummaryQueryOptions, batchTrendsQueryOptions } from "../lib/queries";
import { useTenant } from "../contexts/tenant";

// ── Shared helpers ─────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />;
}

function KpiCard({
  label,
  value,
  icon: Icon,
  iconBg,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconBg: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{label}</span>
        <span className={`p-2 rounded-lg ${iconBg}`}>
          <Icon size={15} />
        </span>
      </div>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── Date range helpers ────────────────────────────────────────────────────────

type Preset = "7d" | "30d" | "90d" | "custom";

function presetDates(preset: Exclude<Preset, "custom">) {
  const to = new Date();
  const from = new Date();
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  from.setDate(from.getDate() - days);
  return {
    startDate: from.toISOString().slice(0, 10),
    endDate: to.toISOString().slice(0, 10),
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function BatchDashboardPage() {
  const { selectedTenant } = useTenant();

  const [preset, setPreset] = useState<Preset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const dateParams =
    preset === "custom"
      ? { startDate: customFrom || undefined, endDate: customTo || undefined }
      : presetDates(preset);

  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
    refetch: refetchSummary,
    isFetching: summaryFetching,
  } = useQuery(batchSummaryQueryOptions(dateParams));

  const {
    data: trends,
    isLoading: trendsLoading,
    isError: trendsError,
    refetch: refetchTrends,
  } = useQuery(batchTrendsQueryOptions(dateParams));

  function handleRefresh() {
    refetchSummary();
    refetchTrends();
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Batch Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {selectedTenant?.name ?? "—"} · Job execution health
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Preset buttons */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            {(["7d", "30d", "90d", "custom"] as Preset[]).map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-3 py-1.5 transition-colors ${
                  preset === p
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {p === "custom" ? "Custom" : p}
              </button>
            ))}
          </div>

          <button
            onClick={handleRefresh}
            disabled={summaryFetching}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={13} className={summaryFetching ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Custom date inputs ─────────────────────────────────────────────── */}
      {preset === "custom" && (
        <div className="flex items-center gap-3 mb-6 p-4 bg-white border border-gray-200 rounded-xl">
          <label className="text-xs text-gray-500">From</label>
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <label className="text-xs text-gray-500">To</label>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      {summaryLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}

      {summaryError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center mb-8">
          <p className="text-sm font-medium text-red-700">Failed to load batch summary</p>
          <button onClick={() => refetchSummary()} className="mt-2 text-xs text-red-600 underline">
            Try again
          </button>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard
            label="Total Executions"
            value={summary.total}
            icon={Activity}
            iconBg="bg-blue-100 text-blue-600"
          />
          <KpiCard
            label="Success Rate"
            value={`${summary.successRate.toFixed(1)}%`}
            icon={TrendingUp}
            iconBg={
              summary.successRate >= 90
                ? "bg-green-100 text-green-600"
                : summary.successRate >= 75
                  ? "bg-yellow-100 text-yellow-600"
                  : "bg-red-100 text-red-600"
            }
          />
          <KpiCard
            label="Successful"
            value={summary.success}
            icon={CheckCircle2}
            iconBg="bg-green-100 text-green-600"
          />
          <KpiCard
            label="Failed"
            value={summary.failed}
            icon={XCircle}
            iconBg={summary.failed > 0 ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-400"}
          />
          <KpiCard
            label="Running"
            value={summary.running}
            icon={Loader2}
            iconBg="bg-blue-100 text-blue-600"
          />
          <KpiCard
            label="Pending"
            value={summary.pending}
            icon={Clock}
            iconBg="bg-yellow-100 text-yellow-600"
          />
          <KpiCard
            label="Active Jobs"
            value={summary.active}
            icon={Play}
            iconBg="bg-indigo-100 text-indigo-600"
            sub="collectors with active_yn=Y"
          />
        </div>
      )}

      {/* ── Charts ────────────────────────────────────────────────────────── */}
      {trendsLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      )}

      {trendsError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-sm font-medium text-red-700">Failed to load trends</p>
          <button onClick={() => refetchTrends()} className="mt-2 text-xs text-red-600 underline">
            Try again
          </button>
        </div>
      )}

      {trends && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily execution trend */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-medium text-gray-700 mb-4">Daily Execution Trend</h2>
            {trends.dailyTrend.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">No execution data for this period</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trends.dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    labelFormatter={(v: string) => `Date: ${v}`}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Total"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="success"
                    name="Success"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="failed"
                    name="Failed"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Integration distribution */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-medium text-gray-700 mb-4">Integration Distribution</h2>
            {trends.integrationDistribution.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">No integration data for this period</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trends.integrationDistribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="integrationId"
                    tick={{ fontSize: 10 }}
                    width={64}
                  />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="count" name="Executions" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!summaryLoading && !trendsLoading && summary?.total === 0 && (
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-10 text-center">
          <Activity size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No batch executions found</p>
          <p className="text-xs text-gray-400 mt-1">
            Try a different date range or check back once jobs have run.
          </p>
        </div>
      )}
    </div>
  );
}
