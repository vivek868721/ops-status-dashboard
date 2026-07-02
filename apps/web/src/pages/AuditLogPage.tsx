import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, Download, RefreshCw } from "lucide-react";
import { api, type AuditItem } from "../lib/api";
import { queryOptions } from "@tanstack/react-query";
import { useTenant } from "../contexts/tenant";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function auditQueryOptions(params?: { action?: string; module?: string }) {
  return queryOptions({
    queryKey: ["batch", "audit", params],
    queryFn: () => api.audit.list(params),
    staleTime: 30000,
    enabled: !!localStorage.getItem("tenantId"),
  });
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
  LOGIN: "bg-purple-100 text-purple-700",
};

export function AuditLogPage() {
  const { selectedTenant } = useTenant();
  const [action, setAction] = useState("");
  const [module, setModule] = useState("");

  const filters = {
    ...(action ? { action } : {}),
    ...(module ? { module } : {}),
  };

  const { data, isLoading, isError, refetch } = useQuery(auditQueryOptions(filters));

  function handleExport() {
    api.audit.exportCsv();
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ClipboardCheck size={20} className="text-gray-400" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Audit Log</h1>
            <p className="text-sm text-gray-500 mt-0.5">{selectedTenant?.name ?? "—"} · System activity trail</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors">
            <Download size={13} /> Export CSV
          </button>
          <button onClick={() => refetch()} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <select value={action} onChange={(e) => setAction(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Actions</option>
          {["CREATE", "UPDATE", "DELETE", "LOGIN"].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input type="text" value={module} onChange={(e) => setModule(e.target.value)} placeholder="Module (e.g. collector)"
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-44" />
        {(action || module) && (
          <button onClick={() => { setAction(""); setModule(""); }} className="text-xs text-gray-500 hover:text-gray-700 underline">Clear</button>
        )}
        {data && <span className="ml-auto text-xs text-gray-400">{data.total} record{data.total !== 1 ? "s" : ""}</span>}
      </div>

      {isLoading && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-gray-100 last:border-0">
              <Skeleton className="h-4 w-8" /> <Skeleton className="h-4 w-16" /> <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40" /> <Skeleton className="h-4 w-32 ml-auto" />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-sm font-medium text-red-700">Failed to load audit log</p>
          <button onClick={() => refetch()} className="mt-2 text-xs text-red-600 underline">Try again</button>
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center">
          <ClipboardCheck size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No audit records found</p>
          <p className="text-xs text-gray-400 mt-1">Try adjusting filters or system actions will appear here.</p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["ID", "Action", "Module", "Old Value", "New Value", "Timestamp"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.items.map((item: AuditItem) => (
                <tr key={item.auditId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">{item.auditId}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[item.action] ?? "bg-gray-100 text-gray-600"}`}>
                      {item.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{item.module}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono max-w-[200px] truncate" title={item.oldValue ?? undefined}>
                    {item.oldValue ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 font-mono max-w-[200px] truncate" title={item.newValue ?? undefined}>
                    {item.newValue ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
