import { createContext, useContext, useState } from "react";
import type { TenantItem, Permission } from "../lib/api";

interface TenantContextValue {
  selectedTenant: TenantItem | null;
  selectedPermission: Permission | null;
  setSelection: (tenant: TenantItem, permission: Permission) => void;
  clearSelection: () => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);

function loadTenant(): TenantItem | null {
  try {
    const raw = localStorage.getItem("tenant");
    return raw ? (JSON.parse(raw) as TenantItem) : null;
  } catch {
    return null;
  }
}

function loadPermission(): Permission | null {
  const raw = localStorage.getItem("permission");
  return raw ? (raw as Permission) : null;
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [selectedTenant, setTenantState] = useState<TenantItem | null>(loadTenant);
  const [selectedPermission, setPermissionState] = useState<Permission | null>(loadPermission);

  function setSelection(tenant: TenantItem, permission: Permission) {
    localStorage.setItem("tenant", JSON.stringify(tenant));
    localStorage.setItem("tenantId", String(tenant.tenantId));
    localStorage.setItem("permission", permission);
    setTenantState(tenant);
    setPermissionState(permission);
  }

  function clearSelection() {
    localStorage.removeItem("tenant");
    localStorage.removeItem("tenantId");
    localStorage.removeItem("permission");
    setTenantState(null);
    setPermissionState(null);
  }

  return (
    <TenantContext.Provider value={{ selectedTenant, selectedPermission, setSelection, clearSelection }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}
