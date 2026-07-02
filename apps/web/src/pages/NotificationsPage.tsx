import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Plus, Trash2, Save, X, CheckCircle, XCircle } from "lucide-react";
import { api, type NotifConfigItem, type NotifHistoryItem } from "../lib/api";
import { queryOptions } from "@tanstack/react-query";
import { useTenant } from "../contexts/tenant";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

type NotifConfig = NotifConfigItem;
type NotifHistory = NotifHistoryItem;

const notifConfigQuery = queryOptions({
  queryKey: ["batch", "notifications", "config"],
  queryFn: () => api.notifications.config.list(),
  staleTime: 30000,
  enabled: !!localStorage.getItem("tenantId"),
});
const notifHistoryQuery = queryOptions({
  queryKey: ["batch", "notifications", "history"],
  queryFn: () => api.notifications.history(),
  staleTime: 30000,
  enabled: !!localStorage.getItem("tenantId"),
});

type Tab = "config" | "history";

export function NotificationsPage() {
  const { selectedTenant } = useTenant();
  const [tab, setTab] = useState<Tab>("config");
  const qc = useQueryClient();

  const configs = useQuery(notifConfigQuery);
  const history = useQuery(notifHistoryQuery);

  const deleteConfig = useMutation({
    mutationFn: (id: number) => api.notifications.config.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["batch", "notifications"] }),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Bell size={20} className="text-gray-400" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Notification Module</h1>
          <p className="text-sm text-gray-500 mt-0.5">{selectedTenant?.name ?? "—"} · Email, Slack, and Webhook alerts</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {(["config", "history"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors capitalize ${tab === t ? "bg-white text-gray-900 shadow-sm font-medium" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "config" ? "Notification Config" : "Delivery History"}
          </button>
        ))}
      </div>

      {tab === "config" && (
        <ConfigTab
          data={configs.data?.configs ?? []}
          isLoading={configs.isLoading}
          onDelete={(id) => deleteConfig.mutate(id)}
        />
      )}
      {tab === "history" && (
        <HistoryTab data={history.data?.history ?? []} isLoading={history.isLoading} />
      )}
    </div>
  );
}

function ConfigTab({ data, isLoading, onDelete }: { data: NotifConfig[]; isLoading: boolean; onDelete: (id: number) => void }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState({ channel: "email", configJson: "", enabled: true });

  const createMutation = useMutation({
    mutationFn: (d: typeof newForm) => api.notifications.config.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["batch", "notifications"] }); setAdding(false); setNewForm({ channel: "email", configJson: "", enabled: true }); },
  });
  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => api.notifications.config.update(id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["batch", "notifications"] }),
  });

  const CHANNEL_PLACEHOLDER: Record<string, string> = {
    email: '{"to":"ops@example.com","subject":"Batch alert"}',
    slack: '{"webhook":"https://hooks.slack.com/services/..."}',
    webhook: '{"url":"https://example.com/hooks/batch","method":"POST"}',
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm text-gray-500">{data.length} notification{data.length !== 1 ? "s" : ""} configured</span>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-xs bg-blue-600 text-white rounded-md px-3 py-1.5 hover:bg-blue-700">
          <Plus size={13} /> Add Notification
        </button>
      </div>

      {adding && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-medium text-blue-900 mb-3">New Notification Channel</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Channel</label>
              <select value={newForm.channel} onChange={(e) => setNewForm((f) => ({ ...f, channel: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="email">Email</option>
                <option value="slack">Slack</option>
                <option value="webhook">Webhook</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Enabled</label>
              <select value={String(newForm.enabled)} onChange={(e) => setNewForm((f) => ({ ...f, enabled: e.target.value === "true" }))}
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="true">Yes</option><option value="false">No</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-600 mb-1 block">Config JSON</label>
              <textarea value={newForm.configJson} onChange={(e) => setNewForm((f) => ({ ...f, configJson: e.target.value }))}
                placeholder={CHANNEL_PLACEHOLDER[newForm.channel]}
                rows={3}
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => createMutation.mutate(newForm)} disabled={!newForm.configJson} className="flex items-center gap-1 text-xs bg-blue-600 text-white rounded-md px-3 py-1.5 hover:bg-blue-700 disabled:opacity-50">
              <Save size={12} /> Save
            </button>
            <button onClick={() => setAdding(false)} className="text-xs text-gray-500 border border-gray-300 rounded-md px-3 py-1.5"><X size={12} /></button>
          </div>
        </div>
      )}

      {isLoading ? <Skeleton className="h-48 w-full" /> : data.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center">
          <Bell size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No notifications configured</p>
          <p className="text-xs text-gray-400 mt-1">Add a channel above to start receiving alerts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((c) => (
            <div key={c.configId} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  c.channel === "email" ? "bg-blue-100 text-blue-700" :
                  c.channel === "slack" ? "bg-purple-100 text-purple-700" : "bg-orange-100 text-orange-700"
                }`}>
                  {c.channel[0].toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 capitalize">{c.channel}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {c.enabled ? "Active" : "Disabled"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 font-mono mt-1 max-w-md truncate">{c.configJson}</p>
                  {c.createdAt && <p className="text-xs text-gray-300 mt-1">{new Date(c.createdAt).toLocaleString()}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleMutation.mutate({ id: c.configId, enabled: !c.enabled })}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${c.enabled ? "border-gray-300 text-gray-500 hover:bg-gray-50" : "border-green-300 text-green-600 hover:bg-green-50"}`}>
                  {c.enabled ? "Disable" : "Enable"}
                </button>
                <button onClick={() => onDelete(c.configId)} className="text-gray-400 hover:text-red-600 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryTab({ data, isLoading }: { data: NotifHistory[]; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (data.length === 0) return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center">
      <p className="text-sm font-medium text-gray-500">No delivery history yet</p>
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {["ID", "Channel", "Status", "Message", "Sent At"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((h) => (
            <tr key={h.historyId} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-xs text-gray-400 font-mono">{h.historyId}</td>
              <td className="px-4 py-3 text-gray-600 capitalize">{h.channel ?? "—"}</td>
              <td className="px-4 py-3">
                <span className={`flex items-center gap-1 text-xs font-medium ${h.status === "sent" ? "text-green-600" : "text-red-600"}`}>
                  {h.status === "sent" ? <CheckCircle size={12} /> : <XCircle size={12} />}
                  {h.status}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{h.message ?? "—"}</td>
              <td className="px-4 py-3 text-xs text-gray-400">{h.createdAt ? new Date(h.createdAt).toLocaleString() : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
