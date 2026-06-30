import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, LogOut } from "lucide-react";
import { tenantsQueryOptions, authQueryOptions } from "../lib/queries";
import { api } from "../lib/api";
import { useTenant } from "../contexts/tenant";
import type { TenantRole } from "../lib/api";

const ROLE_LABELS: Record<TenantRole["role"], string> = {
  executive: "Executive",
  it_manager: "IT Manager",
  employee: "Employee",
};

export function TenantSelectorPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useQuery(authQueryOptions);
  const { data: tenants, isLoading, isError } = useQuery(tenantsQueryOptions);
  const { setTenant } = useTenant();

  function handleSelect(t: TenantRole) {
    setTenant(t);
    navigate({ to: "/" });
  }

  async function handleLogout() {
    await api.auth.logout().catch(() => {});
    queryClient.clear();
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-8 py-10">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Select a tenant</h1>
          <p className="text-sm text-gray-500 mb-6">
            Signed in as <span className="font-medium text-gray-700">{user?.email}</span>
          </p>

          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          )}

          {isError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              Failed to load tenants. Please refresh the page.
            </p>
          )}

          {tenants && tenants.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-6">
              You have not been assigned to any tenants yet. Contact your administrator.
            </p>
          )}

          {tenants && tenants.length > 0 && (
            <ul className="space-y-2">
              {tenants.map((t) => (
                <li key={t.tenantId}>
                  <button
                    onClick={() => handleSelect(t)}
                    className="w-full flex items-center gap-4 px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left group"
                  >
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                      <Building2 size={18} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700">
                        {t.name ?? `Tenant ${t.tenantId}`}
                      </p>
                      <p className="text-xs text-gray-500">{ROLE_LABELS[t.role]}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-8 pt-6 border-t border-gray-100">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
