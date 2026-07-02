import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Download, X, Database, ChevronRight } from "lucide-react";
import { rawDataQueryOptions, rawDataDetailQueryOptions } from "../lib/queries";
import { api, type RawDataItem } from "../lib/api";
import { useTenant } from "../contexts/tenant";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function JsonViewer({ data }: { data: string | null }) {
  if (!data) return <p className="text-gray-400 text-xs italic">No data</p>;
  let formatted = data;
  try {
    formatted = JSON.stringify(JSON.parse(data), null, 2);
  } catch {
    // not valid JSON — show raw
  }
  return (
    <pre className="text-xs font-mono bg-gray-950 text-green-300 rounded-lg p-4 overflow-auto max-h-[70vh] whitespace-pre-wrap break-all">
      {formatted}
    </pre>
  );
}

function DetailPanel({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, isLoading } = useQuery(rawDataDetailQueryOptions(id));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-end z-50" onClick={onClose}>
      <div
        className="w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Raw Data Record #{id}</h3>
            {data && (
              <p className="text-xs text-gray-500 mt-0.5">
                {data.item.integrationId} · {data.item.batchDate}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading && <Skeleton className="h-96 w-full" />}
          {data && (
            <>
              <div className="grid grid-cols-2 gap-3 mb-5 text-xs">
                {[
                  ["ID", data.item.id],
                  ["Integration", data.item.integrationId],
                  ["Collector", data.item.collectorId],
                  ["Batch Date", data.item.batchDate],
                  ["Parsed", data.item.parseYn === "Y" ? "Yes" : "No"],
                  ["Created", data.item.createdAt ? new Date(data.item.createdAt).toLocaleString() : "—"],
                ].map(([label, value]) => (
                  <div key={String(label)} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-400 mb-0.5">{label}</p>
                    <p className="font-medium text-gray-800">{String(value ?? "—")}</p>
                  </div>
                ))}
              </div>
              <h4 className="text-xs font-medium text-gray-600 mb-2">Raw JSON Response</h4>
              <JsonViewer data={data.item.data} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function RawDataPage() {
  const { selectedTenant } = useTenant();

  const [batchDate, setBatchDate] = useState("");
  const [collectorId, setCollectorId] = useState("");
  const [integrationId, setIntegrationId] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const filters = {
    ...(batchDate ? { batchDate } : {}),
    ...(collectorId ? { collectorId } : {}),
    ...(integrationId ? { integrationId } : {}),
  };

  const { data, isLoading, isError, refetch } = useQuery(rawDataQueryOptions(filters));

  function handleExport() {
    api.rawData.exportJson();
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Raw Data Viewer</h1>
          <p className="text-sm text-gray-500 mt-0.5">{selectedTenant?.name ?? "—"} · API response store</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            <Download size={13} />
            Export JSON
          </button>
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
        />
        <input
          type="text"
          value={collectorId}
          onChange={(e) => setCollectorId(e.target.value)}
          placeholder="Collector ID"
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
        />
        <input
          type="text"
          value={integrationId}
          onChange={(e) => setIntegrationId(e.target.value)}
          placeholder="Integration (e.g. JSM)"
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
        />
        {(batchDate || collectorId || integrationId) && (
          <button
            onClick={() => { setBatchDate(""); setCollectorId(""); setIntegrationId(""); }}
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
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-28 ml-auto" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-sm font-medium text-red-700">Failed to load raw data</p>
          <button onClick={() => refetch()} className="mt-2 text-xs text-red-600 underline">Try again</button>
        </div>
      )}

      {/* Empty */}
      {data && data.items.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center">
          <Database size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No raw data records found</p>
          <p className="text-xs text-gray-400 mt-1">Try adjusting the filters.</p>
        </div>
      )}

      {/* Table */}
      {data && data.items.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">ID</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Batch Date</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Integration</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Collector</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Parsed</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Created</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.items.map((item: RawDataItem) => (
                <tr
                  key={item.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedId(item.id)}
                >
                  <td className="px-5 py-3 text-gray-500 font-mono text-xs">{item.id}</td>
                  <td className="px-5 py-3 text-gray-700">{item.batchDate ?? "—"}</td>
                  <td className="px-5 py-3 font-medium text-gray-900">{item.integrationId ?? "—"}</td>
                  <td className="px-5 py-3 text-gray-500">{item.collectorId ?? "—"}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${item.parseYn === "Y" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {item.parseYn === "Y" ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedId(item.id); }}
                      className="text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedId !== null && (
        <DetailPanel id={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
