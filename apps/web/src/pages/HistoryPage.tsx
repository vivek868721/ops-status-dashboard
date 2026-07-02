import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Download, RefreshCcw, Loader2, History } from "lucide-react";
import { batchHistoryQueryOptions } from "../lib/queries";
import { api } from "../lib/api";
import { useTenant } from "../contexts/tenant";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

const STATUS_STYLES: Record<string, string> = {
  S: "bg-green-100 text-green-700",
  F: "bg-red-100 text-red-700",
  R: "bg-blue-100 text-blue-700",
  P: "bg-yellow-100 text-yellow-700",
};
const STATUS_LABELS: Record<string, string> = { S: "Success", F: "Failed", R: "Running", P: "Pending" };

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-400 text-xs">—</span>;
  const cls = STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function HistoryPage() {
  const { selectedTenant, selectedPermission } = useTenant();
  const canManage = selectedPermission === "it_manager";
  const queryClient = useQueryClient();

  const [batchDate, setBatchDate] = useState("");
  const [crawlingStatus, setCrawlingStatus] = useState("");
  const [integrationId, setIntegrationId] = useState("");
  const [retryingId, setRetryingId] = useState<number | null>(null);

  const filters = {
    ...(batchDate ? { batchDate } : {}),
    ...(crawlingStatus ? { crawlingStatus } : {}),
    ...(integrationId ? { integrationId } : {}),
  };

  const { data, isLoading, isError, refetch } = useQuery(batchHistoryQueryOptions(filters));

  const retryMutation = useMutation({
    mutationFn: (id: number) => api.batchHistory.retry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batch", "history"] });
      setRetryingId(null);
    },
    onError: () => setRetryingId(null),
  });

  function handleRetry(id: number) {
    setRetryingId(id);
    retryMutation.mutate(id);
  }

  function handleExport() {
    api.batchHistory.exportCsv();
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Execution History</h1>
          <p className="text-sm text-gray-500 mt-0.5">{selectedTenant?.name ?? "—"} · Batch run log</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors"
            >
              <Download size={13} />
              Export CSV
            </button>
          )}
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <input
          type="date"
          value={batchDate}
          onChange={(e) => setBatchDate(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Batch date"
        />
        <select
          value={crawlingStatus}
          onChange={(e) => setCrawlingStatus(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          <option value="S">Success</option>
          <option value="F">Failed</option>
          <option value="R">Running</option>
          <option value="P">Pending</option>
        </select>
        <input
          type="text"
          value={integrationId}
          onChange={(e) => setIntegrationId(e.target.value)}
          placeholder="Integration (e.g. JSM)"
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
        />
        {(batchDate || crawlingStatus || integrationId) && (
          <button
            onClick={() => { setBatchDate(""); setCrawlingStatus(""); setIntegrationId(""); }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear filters
          </button>
        )}
        {data && (
          <span className="ml-auto text-xs text-gray-400">{data.total} record{data.total !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-gray-100 last:border-0">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-28 ml-auto" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-sm font-medium text-red-700">Failed to load execution history</p>
          <button onClick={() => refetch()} className="mt-2 text-xs text-red-600 underline">Try again</button>
        </div>
      )}

      {/* Empty */}
      {data && data.items.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center">
          <History size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No execution records found</p>
          <p className="text-xs text-gray-400 mt-1">Try adjusting the filters or check back after jobs have run.</p>
        </div>
      )}

      {/* Table */}
      {data && data.items.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">ID</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Batch Date</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Integration</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Collector</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Crawl</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Parse</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Created</th>
                  {canManage && (
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-500 font-mono text-xs">{item.id}</td>
                    <td className="px-5 py-3 text-gray-700">{item.batchDate ?? "—"}</td>
                    <td className="px-5 py-3 font-medium text-gray-900">{item.integrationId ?? "—"}</td>
                    <td className="px-5 py-3 text-gray-500">{item.collectorId ?? "—"}</td>
                    <td className="px-5 py-3"><StatusBadge status={item.crawlingStatus} /></td>
                    <td className="px-5 py-3"><StatusBadge status={item.parseStatus} /></td>
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}
                    </td>
                    {canManage && (
                      <td className="px-5 py-3 text-right">
                        {item.crawlingStatus === "F" && (
                          <button
                            onClick={() => handleRetry(item.id)}
                            disabled={retryingId === item.id}
                            className="flex items-center gap-1 px-2 py-1 rounded border border-blue-200 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40 ml-auto"
                          >
                            {retryingId === item.id
                              ? <Loader2 size={12} className="animate-spin" />
                              : <RefreshCcw size={12} />}
                            Retry
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
