import { createContext, useContext, useState } from "react";
import type { TenantRole } from "../lib/api";

interface TenantContextValue {
  tenant: TenantRole | null;
  setTenant: (t: TenantRole) => void;
  clearTenant: () => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);

function loadFromStorage(): TenantRole | null {
  try {
    const raw = localStorage.getItem("tenant");
    return raw ? (JSON.parse(raw) as TenantRole) : null;
  } catch {
    return null;
  }
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenantState] = useState<TenantRole | null>(loadFromStorage);

  function setTenant(t: TenantRole) {
    localStorage.setItem("tenant", JSON.stringify(t));
    localStorage.setItem("tenantId", String(t.tenantId));
    setTenantState(t);
  }

  function clearTenant() {
    localStorage.removeItem("tenant");
    localStorage.removeItem("tenantId");
    setTenantState(null);
  }

  return <TenantContext.Provider value={{ tenant, setTenant, clearTenant }}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}
