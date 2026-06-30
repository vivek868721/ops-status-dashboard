import { createRootRouteWithContext, createRoute, redirect, Outlet } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { authQueryOptions } from "./lib/queries";
import { AppShell } from "./components/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { TenantSelectorPage } from "./pages/TenantSelectorPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ServiceRequestsPage } from "./pages/ServiceRequestsPage";
import { ChangeRequestsPage } from "./pages/ChangeRequestsPage";
import { OperationalChangesPage } from "./pages/OperationalChangesPage";
import { AiInsightsPage } from "./pages/AiInsightsPage";

interface RouterContext {
  queryClient: QueryClient;
}

async function getUser(queryClient: QueryClient) {
  return queryClient.ensureQueryData(authQueryOptions).catch(() => null);
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
});

// ── Public ──────────────────────────────────────────────────────────────────

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  beforeLoad: async ({ context }) => {
    const user = await getUser(context.queryClient);
    if (user) {
      const tenantId = localStorage.getItem("tenantId");
      throw redirect({ to: tenantId ? "/" : "/select-tenant" });
    }
  },
  component: LoginPage,
});

// ── Auth-required (no tenant needed) ────────────────────────────────────────

const selectTenantRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/select-tenant",
  beforeLoad: async ({ context }) => {
    const user = await getUser(context.queryClient);
    if (!user) throw redirect({ to: "/login" });
  },
  component: TenantSelectorPage,
});

// ── Auth + tenant required (app shell layout) ────────────────────────────────

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  beforeLoad: async ({ context }) => {
    const user = await getUser(context.queryClient);
    if (!user) throw redirect({ to: "/login" });
    const tenantId = localStorage.getItem("tenantId");
    if (!tenantId) throw redirect({ to: "/select-tenant" });
  },
  component: AppShell,
});

const indexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  component: OverviewPage,
});

const serviceRequestsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/service-requests",
  component: ServiceRequestsPage,
});

const changeRequestsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/change-requests",
  component: ChangeRequestsPage,
});

const operationalChangesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/operational-changes",
  component: OperationalChangesPage,
});

const aiInsightsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/ai-insights",
  beforeLoad: async ({ context }) => {
    const stored = localStorage.getItem("tenant");
    if (stored) {
      const tenant = JSON.parse(stored) as { role: string };
      if (tenant.role !== "it_manager") throw redirect({ to: "/" });
    }
  },
  component: AiInsightsPage,
});

export const routeTree = rootRoute.addChildren([
  loginRoute,
  selectTenantRoute,
  appRoute.addChildren([
    indexRoute,
    serviceRequestsRoute,
    changeRequestsRoute,
    operationalChangesRoute,
    aiInsightsRoute,
  ]),
]);
