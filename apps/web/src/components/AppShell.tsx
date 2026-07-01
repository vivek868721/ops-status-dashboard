import { useEffect, useRef, useState } from "react";
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
  ShieldCheck,
  Server,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authQueryOptions, tenantsQueryOptions, userPermissionsQueryOptions } from "../lib/queries";
import { api } from "../lib/api";
import { useTenant } from "../contexts/tenant";
import type { TenantItem, Permission } from "../lib/api";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard, permissions: ["executive", "it_manager"] },
  { to: "/service-requests", label: "Service Requests", icon: ClipboardList, permissions: ["it_manager", "employee"] },
  { to: "/change-requests", label: "Change Requests", icon: ArrowLeftRight, permissions: ["it_manager", "employee"] },
  { to: "/operational-changes", label: "Operational Changes", icon: Wrench, permissions: ["it_manager", "employee"] },
  { to: "/ai-insights", label: "AI Insights", icon: Sparkles, permissions: ["it_manager"] },
  { to: "/batch", label: "Batch Dashboard", icon: Server, permissions: ["executive", "it_manager"] },
] as const;

const PERMISSION_LABEL: Record<Permission, string> = {
  executive: "Executive",
  it_manager: "IT Manager",
  employee: "Employee",
};

// ── Generic header dropdown ──────────────────────────────────────────────────

function HeaderDropdown<T>({
  icon: Icon,
  placeholder,
  value,
  options,
  getKey,
  getLabel,
  onSelect,
}: {
  icon: React.ElementType;
  placeholder: string;
  value: T | null;
  options: T[] | undefined;
  getKey: (item: T) => string | number;
  getLabel: (item: T) => string;
  onSelect: (item: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sm text-slate-100 transition-colors min-w-36"
      >
        <Icon size={14} className="text-slate-400 shrink-0" />
        <span className="flex-1 truncate text-left">
          {value ? getLabel(value) : <span className="text-slate-400">{placeholder}</span>}
        </span>
        <ChevronDown size={13} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1 overflow-hidden">
          {!options?.length && (
            <p className="px-3 py-2 text-xs text-gray-400">None available</p>
          )}
          {options?.map((opt) => {
            const isSelected = value && getKey(value) === getKey(opt);
            return (
              <button
                key={getKey(opt)}
                onClick={() => { onSelect(opt); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                  isSelected
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}
                <span className={isSelected ? "" : "ml-3.5"}>{getLabel(opt)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── AppShell ─────────────────────────────────────────────────────────────────

export function AppShell() {
  const { data: user } = useQuery(authQueryOptions);
  const { selectedTenant, selectedPermission, setSelection } = useTenant();
  const { data: tenants } = useQuery(tenantsQueryOptions);
  const { data: permissions } = useQuery(userPermissionsQueryOptions);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  // Auto-select first available when lists load and nothing is stored
  useEffect(() => {
    if (!tenants?.length || !permissions?.length) return;
    const tenant = selectedTenant ?? tenants[0];
    const permission = selectedPermission ?? permissions[0];
    if (!selectedTenant || !selectedPermission) {
      setSelection(tenant, permission);
      queryClient.invalidateQueries();
    }
  }, [tenants, permissions]);

  function handleTenantChange(t: TenantItem) {
    setSelection(t, selectedPermission ?? permissions?.[0] ?? "employee");
    queryClient.invalidateQueries();
  }

  function handlePermissionChange(p: Permission) {
    if (!selectedTenant && tenants?.length) {
      setSelection(tenants[0], p);
    } else if (selectedTenant) {
      setSelection(selectedTenant, p);
    }
    queryClient.invalidateQueries();
  }

  async function handleLogout() {
    await api.auth.logout().catch(() => {});
    // Intentionally keep tenant/permission in localStorage — restored on next login
    queryClient.clear();
    navigate({ to: "/login" });
  }

  const visibleNav = NAV.filter(
    (item) =>
      selectedPermission && (item.permissions as readonly string[]).includes(selectedPermission),
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* ── Top header ───────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 bg-slate-900 border-b border-slate-700 px-4 h-12 flex items-center gap-3">
        {/* Logo */}
        <span className="text-sm font-semibold text-white mr-4 shrink-0">Ops Dashboard</span>

        {/* Tenant dropdown */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 shrink-0">Tenant</span>
          <HeaderDropdown<TenantItem>
            icon={Building2}
            placeholder="Select tenant"
            value={selectedTenant}
            options={tenants}
            getKey={(t) => t.tenantId}
            getLabel={(t) => t.name ?? `Tenant ${t.tenantId}`}
            onSelect={handleTenantChange}
          />
        </div>

        {/* Permission dropdown */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 shrink-0">View as</span>
          <HeaderDropdown<Permission>
            icon={ShieldCheck}
            placeholder="Select role"
            value={selectedPermission}
            options={permissions}
            getKey={(p) => p}
            getLabel={(p) => PERMISSION_LABEL[p] ?? p}
            onSelect={handlePermissionChange}
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* User + logout */}
        <span className="text-xs text-slate-400 truncate max-w-48 hidden sm:block">{user?.email}</span>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-slate-800"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </header>

      {/* ── Body: sidebar + content ───────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 flex-shrink-0 flex flex-col bg-slate-900 border-r border-slate-700">
          <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
            {visibleNav.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-500">
                {selectedPermission ? "No pages available" : "Select a tenant & role"}
              </p>
            )}
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
                  <Icon size={15} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
