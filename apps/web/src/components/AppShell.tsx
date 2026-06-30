import { Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ClipboardList,
  ArrowLeftRight,
  Wrench,
  Sparkles,
  LogOut,
  ChevronDown,
  Building2,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authQueryOptions } from "../lib/queries";
import { api } from "../lib/api";
import { useTenant } from "../contexts/tenant";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard, roles: ["executive", "it_manager"] },
  { to: "/service-requests", label: "Service Requests", icon: ClipboardList, roles: ["it_manager", "employee"] },
  { to: "/change-requests", label: "Change Requests", icon: ArrowLeftRight, roles: ["it_manager", "employee"] },
  { to: "/operational-changes", label: "Operational Changes", icon: Wrench, roles: ["it_manager", "employee"] },
  { to: "/ai-insights", label: "AI Insights", icon: Sparkles, roles: ["it_manager"] },
] as const;

export function AppShell() {
  const { data: user } = useQuery(authQueryOptions);
  const { tenant, clearTenant } = useTenant();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  async function handleLogout() {
    await api.auth.logout().catch(() => {});
    clearTenant();
    queryClient.clear();
    navigate({ to: "/login" });
  }

  const role = tenant?.role ?? null;
  const visibleNav = NAV.filter((item) => role && (item.roles as readonly string[]).includes(role));

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 flex flex-col bg-slate-900 text-slate-100">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-700">
          <span className="text-base font-semibold tracking-tight">Ops Dashboard</span>
        </div>

        {/* Tenant badge */}
        {tenant && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-md bg-slate-800 flex items-center gap-2 text-sm">
            <Building2 size={14} className="text-slate-400 shrink-0" />
            <span className="truncate text-slate-200">{tenant.name ?? `Tenant ${tenant.tenantId}`}</span>
            <button
              onClick={() => {
                clearTenant();
                navigate({ to: "/select-tenant" });
              }}
              className="ml-auto text-slate-400 hover:text-white"
              title="Switch tenant"
            >
              <ChevronDown size={14} />
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visibleNav.map(({ to, label, icon: Icon }) => {
            const active = currentPath === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-slate-700 text-xs text-slate-400 space-y-2">
          <div className="truncate">{user?.email}</div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <LogOut size={14} />
            Log out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
