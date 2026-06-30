import { useEffect } from "react";
import { createRootRoute, createRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "./hooks/useAuth";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";

function ProtectedLayout() {
  const { user, isLoading, isError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isError && !user) {
      navigate({ to: "/login" });
    }
  }, [isLoading, isError, user, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 text-sm">Unable to connect. Please refresh the page.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-indigo-600 text-sm hover:underline"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <Outlet />;
}

const rootRoute = createRootRoute({ component: Outlet });

const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "protected",
  component: ProtectedLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/",
  component: DashboardPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

export const routeTree = rootRoute.addChildren([
  protectedRoute.addChildren([indexRoute]),
  loginRoute,
]);
