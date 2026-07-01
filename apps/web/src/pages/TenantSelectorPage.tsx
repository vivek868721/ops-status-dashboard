import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ShieldCheck, LogOut, ArrowRight } from "lucide-react";
import { tenantsQueryOptions, userPermissionsQueryOptions } from "../lib/queries";
import { authQueryOptions } from "../lib/queries";
import { api } from "../lib/api";
import { useTenant } from "../contexts/tenant";
import type { TenantItem, Permission } from "../lib/api";

const PERMISSION_LABELS: Record<Permission, string> = {
  executive: "Executive",
  it_manager: "IT Manager",
  employee: "Employee",
};

const PERMISSION_DESC: Record<Permission, string> = {
  executive: "Overview dashboard only",
  it_manager: "Full access — all pages, exports, AI Insights",
  employee: "Your own tickets only",
};

export function TenantSelectorPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useQuery(authQueryOptions);
  const { data: tenants, isLoading: tenantsLoading, isError: tenantsError } = useQuery(tenantsQueryOptions);
  const { data: permissions, isLoading: permsLoading } = useQuery(userPermissionsQueryOptions);
  const { setSelection } = useTenant();

  const [chosenTenant, setChosenTenant] = useState<TenantItem | null>(null);
  const [chosenPermission, setChosenPermission] = useState<Permission | null>(null);

  const isLoading = tenantsLoading || permsLoading;
  const canContinue = chosenTenant !== null && chosenPermission !== null;

  function handleContinue() {
    if (!chosenTenant || !chosenPermission) return;
    setSelection(chosenTenant, chosenPermission);
    navigate({ to: "/" });
  }

  async function handleLogout() {
    await api.auth.logout().catch(() => {});
    queryClient.clear();
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-8 py-10">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Select workspace</h1>
          <p className="text-sm text-gray-500 mb-8">
            Signed in as <span className="font-medium text-gray-700">{user?.email}</span>
          </p>

          {isLoading && (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          )}

          {tenantsError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              Failed to load tenants. Please refresh the page.
            </p>
          )}

          {!isLoading && tenants && tenants.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-6">
              You have not been assigned to any tenants yet. Contact your administrator.
            </p>
          )}

          {!isLoading && tenants && tenants.length > 0 && (
            <div className="space-y-6">
              {/* Tenant selector */}
              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  <Building2 size={13} />
                  Tenant
                </label>
                <div className="space-y-2">
                  {tenants.map((t) => (
                    <button
                      key={t.tenantId}
                      onClick={() => setChosenTenant(t)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left ${
                        chosenTenant?.tenantId === t.tenantId
                          ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                          : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <Building2 size={15} className="text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {t.name ?? `Tenant ${t.tenantId}`}
                        </p>
                        <p className="text-xs text-gray-400 capitalize">{t.systemRole.replace("_", " ")}</p>
                      </div>
                      {chosenTenant?.tenantId === t.tenantId && (
                        <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Permission selector */}
              {permissions && permissions.length > 0 && (
                <div>
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    <ShieldCheck size={13} />
                    Permission level
                  </label>
                  <div className="space-y-2">
                    {permissions.map((p) => (
                      <button
                        key={p}
                        onClick={() => setChosenPermission(p)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left ${
                          chosenPermission === p
                            ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
                            : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                          <ShieldCheck size={15} className="text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{PERMISSION_LABELS[p]}</p>
                          <p className="text-xs text-gray-400">{PERMISSION_DESC[p]}</p>
                        </div>
                        {chosenPermission === p && (
                          <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Continue */}
              <button
                onClick={handleContinue}
                disabled={!canContinue}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Continue
                <ArrowRight size={15} />
              </button>
            </div>
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
