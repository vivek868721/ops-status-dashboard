import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, AlertCircle, Info, AlertTriangle } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { aiInsightsQueryOptions } from "../lib/queries";
import { api, type Analysis, type InsightSeverity, type ChartConfig } from "../lib/api";
import { useTenant } from "../contexts/tenant";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />;
}

const SEVERITY_CONFIG: Record<
  InsightSeverity,
  { icon: React.ElementType; bg: string; border: string; text: string; badge: string }
> = {
  info: {
    icon: Info,
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-800",
    badge: "bg-blue-100 text-blue-700",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-800",
    badge: "bg-yellow-100 text-yellow-700",
  },
  critical: {
    icon: AlertCircle,
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    badge: "bg-red-100 text-red-700",
  },
};

function AiChart({ config }: { config: ChartConfig }) {
  if (config.type === "LineChart") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={config.data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={config.data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function AnalysisView({ analysis }: { analysis: Analysis }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-4">
        {new Date(analysis.generatedAt).toLocaleString()}
        {analysis.customQuery && (
          <span className="ml-2 italic text-gray-500">"{analysis.customQuery}"</span>
        )}
      </p>

      <div className="space-y-3 mb-6">
        {analysis.insights.map((insight, i) => {
          const cfg = SEVERITY_CONFIG[insight.severity];
          const Icon = cfg.icon;
          return (
            <div key={i} className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border}`}>
              <div className="flex items-start gap-3">
                <Icon size={16} className={`mt-0.5 shrink-0 ${cfg.text}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm font-medium ${cfg.text}`}>{insight.title}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${cfg.badge}`}>
                      {insight.severity}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{insight.detail}</p>
                  <p className="text-xs text-gray-500">
                    <span className="font-medium">Action: </span>
                    {insight.recommendedAction}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {analysis.charts.length > 0 && (
        <div className="space-y-4">
          {analysis.charts.map((chart, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-medium text-gray-900 mb-0.5">{chart.title}</h3>
              <p className="text-xs text-gray-500 mb-4">{chart.description}</p>
              <AiChart config={chart} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AiInsightsPage() {
  const { selectedTenant } = useTenant();
  const queryClient = useQueryClient();
  const [customQuery, setCustomQuery] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);

  const { data, isLoading } = useQuery(aiInsightsQueryOptions());

  const { mutate: runAnalysis, isPending, error: analyzeError } = useMutation({
    mutationFn: () => api.aiInsights.analyze(customQuery.trim() || undefined),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: aiInsightsQueryOptions().queryKey });
      setActiveId(result.id);
      setCustomQuery("");
    },
  });

  const activeAnalysis =
    activeId != null
      ? data?.analyses.find((a) => a.id === activeId)
      : data?.analyses[0];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">AI Insights</h1>
        <p className="text-sm text-gray-500 mt-0.5">{selectedTenant?.name}</p>
      </div>

      {/* Analyze panel */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Run New Analysis</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            placeholder="Optional: focus the analysis on a specific concern…"
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => runAnalysis()}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Sparkles size={14} />
            {isPending ? "Analyzing…" : "Analyze Now"}
          </button>
        </div>
        {analyzeError && (
          <p className="mt-2 text-xs text-red-600">
            {analyzeError instanceof Error ? analyzeError.message : "Analysis failed"}
          </p>
        )}
      </div>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      )}

      {data && data.analyses.length === 0 && !isPending && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center">
          <Sparkles size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600">No analyses yet</p>
          <p className="text-xs text-gray-400 mt-1">Click "Analyze Now" to generate your first AI insight report.</p>
        </div>
      )}

      {data && data.analyses.length > 0 && (
        <div className="grid grid-cols-4 gap-5">
          {/* Sidebar: history */}
          <div className="col-span-1">
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">History</h2>
            <ul className="space-y-1">
              {data.analyses.slice(0, 10).map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => setActiveId(a.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                      activeAnalysis?.id === a.id
                        ? "bg-blue-600 text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <p className="font-medium">{new Date(a.generatedAt).toLocaleDateString()}</p>
                    <p className="opacity-70 truncate">{a.customQuery || "General analysis"}</p>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Main: active analysis */}
          <div className="col-span-3">
            {isPending && (
              <div className="space-y-3">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </div>
            )}
            {!isPending && activeAnalysis && <AnalysisView analysis={activeAnalysis} />}
          </div>
        </div>
      )}
    </div>
  );
}
