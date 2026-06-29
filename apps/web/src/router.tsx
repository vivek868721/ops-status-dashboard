import { createRootRoute, createRoute, Outlet } from "@tanstack/react-router";

const rootRoute = createRootRoute({ component: Outlet });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => <div className="p-8 text-lg font-medium">Operations Status Dashboard</div>,
});

export const routeTree = rootRoute.addChildren([indexRoute]);
