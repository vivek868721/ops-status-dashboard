import { useQuery } from "@tanstack/react-query";
import { overviewQueryOptions } from "../lib/queries";
import { useTenant } from "../contexts/tenant";
import { TrendingUp, AlertTriangle, Clock, CheckCircle, BarChart2, RefreshCw } from "lucide-react";

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{label}</span>
        <span className={`p-2 rounded-lg ${color}`}>
          <Icon size={16} />
        </span>
      </div>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />;
}

export function OverviewPage() {
  const { selectedTenant, selectedPermission } = useTenant();
  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useQuery(overviewQueryOptions());

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {selectedTenant?.name ?? `Tenant ${selectedTenant?.tenantId}`}
            {selectedPermission === "executive" && " · Executive view"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && <span className="text-xs text-gray-400">Updated {lastUpdated}</span>}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI cards */}
      {isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}

      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-sm font-medium text-red-700">Failed to load overview data</p>
          <p className="text-xs text-red-500 mt-1">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-3 text-xs text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <KpiCard
              label="SLA Compliance Rate"
              value={`${data.slaComplianceRate.toFixed(1)}%`}
              icon={CheckCircle}
              color={
                data.slaComplianceRate >= 90
                  ? "bg-green-100 text-green-600"
                  : data.slaComplianceRate >= 75
                    ? "bg-yellow-100 text-yellow-600"
                    : "bg-red-100 text-red-600"
              }
            />
            <KpiCard
              label="Open Issues"
              value={data.openSR + data.openCR + data.openOC}
              sub={`SR ${data.openSR} · CR ${data.openCR} · OC ${data.openOC}`}
              icon={BarChart2}
              color="bg-blue-100 text-blue-600"
            />
            <KpiCard
              label="Urgent Open"
              value={data.urgentOpen}
              icon={AlertTriangle}
              color={data.urgentOpen > 0 ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-400"}
            />
            <KpiCard
              label="Overdue Issues"
              value={data.overdue}
              icon={AlertTriangle}
              color={data.overdue > 0 ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-400"}
            />
            <KpiCard
              label="Avg Resolution"
              value={`${data.avgResolutionDays.toFixed(1)}d`}
              icon={Clock}
              color="bg-purple-100 text-purple-600"
            />
            <KpiCard
              label="SLA Trend"
              value={`${data.slaComplianceRate.toFixed(1)}%`}
              sub="Last 30 days"
              icon={TrendingUp}
              color="bg-indigo-100 text-indigo-600"
            />
          </div>

          {/* Issue breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-medium text-gray-700 mb-4">Open Issues by Type</h2>
            <div className="space-y-3">
              {[
                { label: "Service Requests", value: data.openSR, color: "bg-blue-500" },
                { label: "Change Requests", value: data.openCR, color: "bg-violet-500" },
                { label: "Operational Changes", value: data.openOC, color: "bg-teal-500" },
              ].map(({ label, value, color }) => {
                const total = data.openSR + data.openCR + data.openOC || 1;
                const pct = (value / total) * 100;
                return (
                  <div key={label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{label}</span>
                      <span className="font-medium text-gray-900">{value}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
