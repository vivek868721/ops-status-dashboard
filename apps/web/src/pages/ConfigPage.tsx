import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Plus, Trash2, Edit2, Save, X, Eye, EyeOff } from "lucide-react";
import { api, type CollectorItem, type IntegrationConfigItem, type ParserItem } from "../lib/api";
import { queryOptions } from "@tanstack/react-query";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

type Collector = CollectorItem;
type IntegrationConfig = IntegrationConfigItem;
type Parser = ParserItem;

const collectorsQuery = queryOptions({
  queryKey: ["batch", "collectors"],
  queryFn: () => api.config.collectors.list(),
  staleTime: 30000,
});
const integrationConfigQuery = queryOptions({
  queryKey: ["batch", "integration-config"],
  queryFn: () => api.config.integrationConfig.list(),
  staleTime: 30000,
});
const parsersQuery = queryOptions({
  queryKey: ["batch", "parsers"],
  queryFn: () => api.config.parsers.list(),
  staleTime: 30000,
});

type Tab = "collectors" | "integration-config" | "parsers";

export function ConfigPage() {
  const [tab, setTab] = useState<Tab>("collectors");
  const qc = useQueryClient();

  const collectors = useQuery(collectorsQuery);
  const configs = useQuery(integrationConfigQuery);
  const parsers = useQuery(parsersQuery);

  const deleteCollector = useMutation({
    mutationFn: (id: number) => api.config.collectors.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["batch", "collectors"] }),
  });
  const deleteConfig = useMutation({
    mutationFn: (id: number) => api.config.integrationConfig.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["batch", "integration-config"] }),
  });
  const deleteParser = useMutation({
    mutationFn: (id: number) => api.config.parsers.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["batch", "parsers"] }),
  });

  const TABS: { key: Tab; label: string }[] = [
    { key: "collectors", label: "Collectors" },
    { key: "integration-config", label: "Integration Config" },
    { key: "parsers", label: "Parsers" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Settings size={20} className="text-gray-400" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Integration Configuration</h1>
          <p className="text-sm text-gray-500 mt-0.5">Super-admin: manage collectors, credentials, and parsers</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              tab === t.key ? "bg-white text-gray-900 shadow-sm font-medium" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Collectors Tab */}
      {tab === "collectors" && (
        <CollectorsSection
          data={collectors.data?.collectors ?? []}
          isLoading={collectors.isLoading}
          onDelete={(id) => deleteCollector.mutate(id)}
          onRefresh={() => qc.invalidateQueries({ queryKey: ["batch", "collectors"] })}
        />
      )}

      {/* Integration Config Tab */}
      {tab === "integration-config" && (
        <IntegrationConfigSection
          data={configs.data?.configs ?? []}
          isLoading={configs.isLoading}
          onDelete={(id) => deleteConfig.mutate(id)}
          onRefresh={() => qc.invalidateQueries({ queryKey: ["batch", "integration-config"] })}
        />
      )}

      {/* Parsers Tab */}
      {tab === "parsers" && (
        <ParsersSection
          data={parsers.data?.parsers ?? []}
          isLoading={parsers.isLoading}
          onDelete={(id) => deleteParser.mutate(id)}
          onRefresh={() => qc.invalidateQueries({ queryKey: ["batch", "parsers"] })}
        />
      )}
    </div>
  );
}

// ── Collectors ────────────────────────────────────────────────────────────────

function CollectorsSection({ data, isLoading, onDelete, onRefresh }: {
  data: Collector[]; isLoading: boolean;
  onDelete: (id: number) => void; onRefresh: () => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Collector>>({});
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState({ jobName: "", cronSchedule: "", integrationId: "", tenantId: "", activeYn: "Y" });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Collector> }) => api.config.collectors.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["batch", "collectors"] }); setEditing(null); },
  });
  const createMutation = useMutation({
    mutationFn: (data: typeof newForm) => api.config.collectors.create({ ...data, tenantId: data.tenantId ? Number(data.tenantId) : undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["batch", "collectors"] }); setAdding(false); setNewForm({ jobName: "", cronSchedule: "", integrationId: "", tenantId: "", activeYn: "Y" }); },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm text-gray-500">{data.length} collector{data.length !== 1 ? "s" : ""}</span>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-xs bg-blue-600 text-white rounded-md px-3 py-1.5 hover:bg-blue-700">
          <Plus size={13} /> Add Collector
        </button>
      </div>

      {adding && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-medium text-blue-900 mb-3">New Collector</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {[["Job Name*", "jobName"], ["Cron Schedule", "cronSchedule"], ["Integration ID", "integrationId"], ["Tenant ID", "tenantId"]].map(([label, key]) => (
              <div key={key}>
                <label className="text-xs text-gray-600 mb-1 block">{label}</label>
                <input value={(newForm as Record<string, string>)[key]} onChange={(e) => setNewForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => createMutation.mutate(newForm)} disabled={!newForm.jobName} className="flex items-center gap-1 text-xs bg-blue-600 text-white rounded-md px-3 py-1.5 hover:bg-blue-700 disabled:opacity-50">
              <Save size={12} /> Save
            </button>
            <button onClick={() => setAdding(false)} className="text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-md px-3 py-1.5"><X size={12} /></button>
          </div>
        </div>
      )}

      {isLoading ? <Skeleton className="h-48 w-full" /> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["ID", "Job Name", "Cron", "Integration", "Tenant", "Active", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((c) => (
                <tr key={c.collectorId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">{c.collectorId}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {editing === c.collectorId
                      ? <input value={editForm.jobName ?? c.jobName} onChange={(e) => setEditForm((f) => ({ ...f, jobName: e.target.value }))} className="text-sm border rounded px-2 py-1 w-full" />
                      : c.jobName}
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                    {editing === c.collectorId
                      ? <input value={editForm.cronSchedule ?? c.cronSchedule ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, cronSchedule: e.target.value }))} className="text-sm border rounded px-2 py-1 w-full font-mono" />
                      : c.cronSchedule ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.integrationId ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{c.tenantId ?? "—"}</td>
                  <td className="px-4 py-3">
                    {editing === c.collectorId
                      ? <select value={editForm.activeYn ?? c.activeYn ?? "Y"} onChange={(e) => setEditForm((f) => ({ ...f, activeYn: e.target.value }))} className="text-sm border rounded px-2 py-1">
                          <option value="Y">Yes</option><option value="N">No</option>
                        </select>
                      : <span className={`px-2 py-0.5 rounded-full text-xs ${c.activeYn === "Y" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{c.activeYn === "Y" ? "Active" : "Inactive"}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editing === c.collectorId ? (
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => updateMutation.mutate({ id: c.collectorId, data: editForm })} className="text-xs text-blue-600 hover:text-blue-800"><Save size={14} /></button>
                        <button onClick={() => setEditing(null)} className="text-xs text-gray-400 hover:text-gray-600"><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => { setEditing(c.collectorId); setEditForm({}); }} className="text-gray-400 hover:text-blue-600"><Edit2 size={14} /></button>
                        <button onClick={() => onDelete(c.collectorId)} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">No collectors configured</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Integration Config ────────────────────────────────────────────────────────

function IntegrationConfigSection({ data, isLoading, onDelete, onRefresh }: {
  data: IntegrationConfig[]; isLoading: boolean;
  onDelete: (id: number) => void; onRefresh: () => void;
}) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [showMasked, setShowMasked] = useState<Record<number, boolean>>({});
  const [newForm, setNewForm] = useState({ integrationId: "", tenantId: "", baseUrl: "", authType: "", token: "", apiKey: "" });

  const createMutation = useMutation({
    mutationFn: (data: typeof newForm) => api.config.integrationConfig.create({ ...data, tenantId: data.tenantId ? Number(data.tenantId) : undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["batch", "integration-config"] }); setAdding(false); },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm text-gray-500">{data.length} config{data.length !== 1 ? "s" : ""}</span>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-xs bg-blue-600 text-white rounded-md px-3 py-1.5 hover:bg-blue-700">
          <Plus size={13} /> Add Config
        </button>
      </div>

      {adding && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-medium text-blue-900 mb-3">New Integration Config</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {[["Integration ID*", "integrationId"], ["Tenant ID", "tenantId"], ["Base URL", "baseUrl"], ["Auth Type", "authType"], ["Token", "token"], ["API Key", "apiKey"]].map(([label, key]) => (
              <div key={key}>
                <label className="text-xs text-gray-600 mb-1 block">{label}</label>
                <input type={["token","apiKey"].includes(key) ? "password" : "text"} value={(newForm as Record<string, string>)[key]} onChange={(e) => setNewForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => createMutation.mutate(newForm)} disabled={!newForm.integrationId} className="flex items-center gap-1 text-xs bg-blue-600 text-white rounded-md px-3 py-1.5 hover:bg-blue-700 disabled:opacity-50">
              <Save size={12} /> Save
            </button>
            <button onClick={() => setAdding(false)} className="text-xs text-gray-500 border border-gray-300 rounded-md px-3 py-1.5"><X size={12} /></button>
          </div>
        </div>
      )}

      {isLoading ? <Skeleton className="h-48 w-full" /> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["ID", "Integration", "Tenant", "Base URL", "Auth", "Credentials", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((c) => (
                <tr key={c.configId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">{c.configId}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{c.integrationId}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{c.tenantId ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 truncate max-w-xs">{c.baseUrl ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{c.authType ?? "—"}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setShowMasked((m) => ({ ...m, [c.configId]: !m[c.configId] }))} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                      {showMasked[c.configId] ? <><EyeOff size={12} /> Hide</> : <><Eye size={12} /> *** (masked)</>}
                    </button>
                    {showMasked[c.configId] && (
                      <div className="mt-1 text-xs text-gray-400 font-mono">
                        {c.token !== "***" ? "" : "token: ***"}{c.apiKey !== "***" ? "" : " apiKey: ***"}
                        <span className="text-orange-500 ml-1">Credentials are always masked in GET responses</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => onDelete(c.configId)} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">No integration configs</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Parsers ───────────────────────────────────────────────────────────────────

function ParsersSection({ data, isLoading, onDelete, onRefresh }: {
  data: Parser[]; isLoading: boolean;
  onDelete: (id: number) => void; onRefresh: () => void;
}) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState({ integrationId: "", tenantId: "", parserClass: "", configJson: "" });

  const createMutation = useMutation({
    mutationFn: (data: typeof newForm) => api.config.parsers.create({ ...data, tenantId: data.tenantId ? Number(data.tenantId) : undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["batch", "parsers"] }); setAdding(false); },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm text-gray-500">{data.length} parser{data.length !== 1 ? "s" : ""}</span>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-xs bg-blue-600 text-white rounded-md px-3 py-1.5 hover:bg-blue-700">
          <Plus size={13} /> Add Parser
        </button>
      </div>

      {adding && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-medium text-blue-900 mb-3">New Parser</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {[["Integration ID*", "integrationId"], ["Tenant ID", "tenantId"], ["Parser Class", "parserClass"], ["Config JSON", "configJson"]].map(([label, key]) => (
              <div key={key}>
                <label className="text-xs text-gray-600 mb-1 block">{label}</label>
                <input value={(newForm as Record<string, string>)[key]} onChange={(e) => setNewForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => createMutation.mutate(newForm)} disabled={!newForm.integrationId} className="flex items-center gap-1 text-xs bg-blue-600 text-white rounded-md px-3 py-1.5 hover:bg-blue-700 disabled:opacity-50">
              <Save size={12} /> Save
            </button>
            <button onClick={() => setAdding(false)} className="text-xs text-gray-500 border border-gray-300 rounded-md px-3 py-1.5"><X size={12} /></button>
          </div>
        </div>
      )}

      {isLoading ? <Skeleton className="h-48 w-full" /> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["ID", "Integration", "Tenant", "Parser Class", "Config", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((p) => (
                <tr key={p.parserId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">{p.parserId}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.integrationId}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{p.tenantId ?? "—"}</td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-600">{p.parserClass ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 truncate max-w-xs">{p.configJson ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => onDelete(p.parserId)} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No parsers configured</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
