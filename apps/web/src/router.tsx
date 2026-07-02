import { createRootRouteWithContext, createRoute, redirect, Outlet } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { authQueryOptions } from "./lib/queries";
import { AppShell } from "./components/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ServiceRequestsPage } from "./pages/ServiceRequestsPage";
import { ChangeRequestsPage } from "./pages/ChangeRequestsPage";
import { OperationalChangesPage } from "./pages/OperationalChangesPage";
import { AiInsightsPage } from "./pages/AiInsightsPage";
import { BatchDashboardPage } from "./pages/BatchDashboardPage";
import { JobsPage } from "./pages/JobsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { RawDataPage } from "./pages/RawDataPage";
import { ParsedDataPage } from "./pages/ParsedDataPage";
import { ConfigPage } from "./pages/ConfigPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { AuditLogPage } from "./pages/AuditLogPage";
import { SystemHealthPage } from "./pages/SystemHealthPage";

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
    if (user) throw redirect({ to: "/" });
  },
  component: LoginPage,
});

// ── Auth-required (app shell layout) ────────────────────────────────────────

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  beforeLoad: async ({ context }) => {
    const user = await getUser(context.queryClient);
    if (!user) throw redirect({ to: "/login" });
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
  beforeLoad: async () => {
    const permission = localStorage.getItem("permission");
    if (permission && permission !== "it_manager") throw redirect({ to: "/" });
  },
  component: AiInsightsPage,
});

const batchDashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/batch",
  beforeLoad: async () => {
    const permission = localStorage.getItem("permission");
    if (permission === "employee") throw redirect({ to: "/" });
  },
  component: BatchDashboardPage,
});

const batchJobsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/batch/jobs",
  beforeLoad: async () => {
    const permission = localStorage.getItem("permission");
    if (permission === "employee") throw redirect({ to: "/" });
  },
  component: JobsPage,
});

const rawDataRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/batch/raw-data",
  beforeLoad: async () => {
    const permission = localStorage.getItem("permission");
    if (permission !== "it_manager") throw redirect({ to: "/" });
  },
  component: RawDataPage,
});

const parsedDataRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/batch/parsed-data",
  beforeLoad: async () => {
    const permission = localStorage.getItem("permission");
    if (permission !== "it_manager") throw redirect({ to: "/" });
  },
  component: ParsedDataPage,
});

const batchHistoryRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/batch/history",
  beforeLoad: async () => {
    const permission = localStorage.getItem("permission");
    if (permission === "employee") throw redirect({ to: "/" });
  },
  component: HistoryPage,
});

const configRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/batch/config",
  beforeLoad: async () => {
    const permission = localStorage.getItem("permission");
    if (permission !== "it_manager") throw redirect({ to: "/" });
  },
  component: ConfigPage,
});

const notificationsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/batch/notifications",
  beforeLoad: async () => {
    const permission = localStorage.getItem("permission");
    if (permission !== "it_manager") throw redirect({ to: "/" });
  },
  component: NotificationsPage,
});

const auditLogRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/batch/audit",
  beforeLoad: async () => {
    const permission = localStorage.getItem("permission");
    if (permission !== "it_manager") throw redirect({ to: "/" });
  },
  component: AuditLogPage,
});

const systemHealthRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/batch/health",
  beforeLoad: async () => {
    const permission = localStorage.getItem("permission");
    if (permission !== "it_manager") throw redirect({ to: "/" });
  },
  component: SystemHealthPage,
});

export const routeTree = rootRoute.addChildren([
  loginRoute,
  appRoute.addChildren([
    indexRoute,
    serviceRequestsRoute,
    changeRequestsRoute,
    operationalChangesRoute,
    aiInsightsRoute,
    batchDashboardRoute,
    batchJobsRoute,
    batchHistoryRoute,
    rawDataRoute,
    parsedDataRoute,
    configRoute,
    notificationsRoute,
    auditLogRoute,
    systemHealthRoute,
  ]),
]);
