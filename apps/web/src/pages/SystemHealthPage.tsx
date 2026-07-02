import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Database, Clock, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { api, type ScheduledRun } from "../lib/api";
import { queryOptions } from "@tanstack/react-query";
import { useTenant } from "../contexts/tenant";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function healthQuery() {
  return queryOptions({
    queryKey: ["system", "health"],
    queryFn: () => api.system.health(),
    staleTime: 10000,
    refetchInterval: 30000,
    enabled: !!localStorage.getItem("tenantId"),
  });
}

function schedulerQuery() {
  return queryOptions({
    queryKey: ["system", "scheduler"],
    queryFn: () => api.system.scheduler(),
    staleTime: 15000,
    refetchInterval: 30000,
    enabled: !!localStorage.getItem("tenantId"),
  });
}

export function SystemHealthPage() {
  const { selectedTenant } = useTenant();
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const health = useQuery(healthQuery());
  const scheduler = useQuery(schedulerQuery());

  function refetchAll() {
    health.refetch();
    scheduler.refetch();
    setLastRefreshed(new Date());
  }

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(refetchAll, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity size={20} className="text-gray-400" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">System Health</h1>
            <p className="text-sm text-gray-500 mt-0.5">{selectedTenant?.name ?? "—"} · Auto-refreshes every 30s</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">Last checked: {lastRefreshed.toLocaleTimeString()}</span>
          <button onClick={refetchAll} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* DB Health Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database size={16} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Database</h2>
          </div>
          {health.isLoading ? <Skeleton className="h-16 w-full" /> : health.data ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                {health.data.db.connected
                  ? <CheckCircle size={20} className="text-green-500" />
                  : <AlertCircle size={20} className="text-red-500" />}
                <span className={`text-sm font-medium ${health.data.db.connected ? "text-green-700" : "text-red-700"}`}>
                  {health.data.db.connected ? "Connected" : "Disconnected"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-400 mb-0.5">Latency</p>
                  <p className="font-semibold text-gray-800">{health.data.db.latencyMs}ms</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-400 mb-0.5">Status</p>
                  <p className={`font-semibold ${health.data.status === "ok" ? "text-green-700" : "text-orange-600"}`}>
                    {health.data.status.toUpperCase()}
                  </p>
                </div>
              </div>
            </div>
          ) : <p className="text-sm text-gray-400">Unable to fetch health data</p>}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Scheduler</h2>
          </div>
          {scheduler.isLoading ? <Skeleton className="h-16 w-full" /> : scheduler.data ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={20} className="text-green-500" />
                <span className="text-sm font-medium text-green-700 capitalize">{scheduler.data.status}</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-xs">
                <p className="text-gray-400 mb-0.5">Active jobs scheduled</p>
                <p className="font-semibold text-gray-800">{scheduler.data.nextRuns.length}</p>
              </div>
            </div>
          ) : <p className="text-sm text-gray-400">Unable to fetch scheduler data</p>}
        </div>
      </div>

      {/* Next Runs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Clock size={14} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">Next Scheduled Runs</h2>
        </div>
        {scheduler.isLoading ? (
          <div className="p-5"><Skeleton className="h-32 w-full" /></div>
        ) : scheduler.data && scheduler.data.nextRuns.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Job", "Integration", "Cron", "Last Run", "Next Run"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(scheduler.data.nextRuns as ScheduledRun[]).map((run) => {
                const nextMs = new Date(run.nextRunAt).getTime() - Date.now();
                const minsUntil = Math.max(0, Math.round(nextMs / 60000));
                return (
                  <tr key={run.collectorId} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{run.jobName}</td>
                    <td className="px-5 py-3 text-gray-600">{run.integrationId ?? "—"}</td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">{run.cronSchedule}</td>
                    <td className="px-5 py-3 text-xs text-gray-400">
                      {run.lastRunAt ? new Date(run.lastRunAt).toLocaleString() : "Never"}
                    </td>
                    <td className="px-5 py-3">
                      <div>
                        <p className="text-xs text-gray-700">{new Date(run.nextRunAt).toLocaleString()}</p>
                        <p className="text-xs text-blue-500 mt-0.5">in ~{minsUntil} min</p>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-sm text-gray-400">No active scheduled jobs</div>
        )}
      </div>
    </div>
  );
}
