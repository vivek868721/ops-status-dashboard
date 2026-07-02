import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, Square, RefreshCw, ToggleLeft, ToggleRight, Pencil, X, Check, Loader2, Activity } from "lucide-react";
import { batchJobsQueryOptions } from "../lib/queries";
import { api, type BatchJob } from "../lib/api";
import { useTenant } from "../contexts/tenant";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function StatusBadge({ activeYn }: { activeYn: string | null }) {
  const active = activeYn === "Y";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-green-500" : "bg-gray-400"}`} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function EditCronModal({ job, onClose, onSave }: { job: BatchJob; onClose: () => void; onSave: (cron: string) => void }) {
  const [cron, setCron] = useState(job.cronSchedule ?? "");
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Edit Cron Schedule</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-1">{job.jobName}</p>
        <input
          type="text"
          value={cron}
          onChange={(e) => setCron(e.target.value)}
          placeholder="e.g. 0 * * * *"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400 mt-1">Standard cron expression (minute hour day month weekday)</p>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSave(cron)} className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700">Save</button>
        </div>
      </div>
    </div>
  );
}

export function JobsPage() {
  const { selectedTenant, selectedPermission } = useTenant();
  const canManage = selectedPermission === "it_manager";
  const queryClient = useQueryClient();

  const [editingJob, setEditingJob] = useState<BatchJob | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const { data, isLoading, isError, refetch } = useQuery(batchJobsQueryOptions());

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { cronSchedule?: string; activeYn?: string } }) =>
      api.batch.jobs.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["batch", "jobs"] }),
  });

  async function handleAction(id: number, action: "run" | "stop" | "retry") {
    const key = `${id}-${action}`;
    setActionLoading((p) => ({ ...p, [key]: true }));
    try {
      if (action === "run") await api.batch.jobs.run(id);
      else if (action === "stop") await api.batch.jobs.stop(id);
      else await api.batch.jobs.retry(id);
      queryClient.invalidateQueries({ queryKey: ["batch", "jobs"] });
    } finally {
      setActionLoading((p) => ({ ...p, [key]: false }));
    }
  }

  function handleToggleActive(job: BatchJob) {
    updateMutation.mutate({ id: job.collectorId, data: { activeYn: job.activeYn === "Y" ? "N" : "Y" } });
  }

  function handleSaveCron(cron: string) {
    if (!editingJob) return;
    updateMutation.mutate({ id: editingJob.collectorId, data: { cronSchedule: cron } });
    setEditingJob(null);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Job Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {selectedTenant?.name ?? "—"} · Batch collectors
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-16 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-sm font-medium text-red-700">Failed to load jobs</p>
          <button onClick={() => refetch()} className="mt-2 text-xs text-red-600 underline">Try again</button>
        </div>
      )}

      {/* Table */}
      {data && data.jobs.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center">
          <Activity size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No batch jobs found for this tenant</p>
        </div>
      )}

      {data && data.jobs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Job Name</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Integration</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Cron</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Last Run</th>
                {canManage && (
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.jobs.map((job) => (
                <tr key={job.collectorId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{job.jobName}</td>
                  <td className="px-5 py-3.5 text-gray-600">{job.integrationId ?? "—"}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-700">
                        {job.cronSchedule ?? "—"}
                      </code>
                      {canManage && (
                        <button
                          onClick={() => setEditingJob(job)}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                          title="Edit cron"
                        >
                          <Pencil size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <StatusBadge activeYn={job.activeYn} />
                      {canManage && (
                        <button
                          onClick={() => handleToggleActive(job)}
                          disabled={updateMutation.isPending}
                          className="text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-40"
                          title={job.activeYn === "Y" ? "Disable job" : "Enable job"}
                        >
                          {job.activeYn === "Y" ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} />}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs">
                    {job.lastRunAt ? new Date(job.lastRunAt).toLocaleString() : "Never"}
                  </td>
                  {canManage && (
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <ActionButton
                          icon={<Play size={12} />}
                          label="Run"
                          loading={!!actionLoading[`${job.collectorId}-run`]}
                          onClick={() => handleAction(job.collectorId, "run")}
                          className="text-green-600 hover:bg-green-50 border-green-200"
                        />
                        <ActionButton
                          icon={<Square size={12} />}
                          label="Stop"
                          loading={!!actionLoading[`${job.collectorId}-stop`]}
                          onClick={() => handleAction(job.collectorId, "stop")}
                          className="text-orange-600 hover:bg-orange-50 border-orange-200"
                        />
                        <ActionButton
                          icon={<RefreshCw size={12} />}
                          label="Retry"
                          loading={!!actionLoading[`${job.collectorId}-retry`]}
                          onClick={() => handleAction(job.collectorId, "retry")}
                          className="text-blue-600 hover:bg-blue-50 border-blue-200"
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingJob && (
        <EditCronModal job={editingJob} onClose={() => setEditingJob(null)} onSave={handleSaveCron} />
      )}
    </div>
  );
}

function ActionButton({ icon, label, loading, onClick, className }: {
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  onClick: () => void;
  className: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium transition-colors disabled:opacity-40 ${className}`}
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}
