import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, useLocation, type RouteObject } from "react-router";
import { LoginPage } from "./pages/LoginPage";
import { getToken } from "./lib/api";

// Signed-in pages carry the charts: loaded on demand, so the login page stays light.
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const LivePage = lazy(() => import("./pages/LivePage").then((m) => ({ default: m.LivePage })));

function PageFallback() {
  return (
    <div className="app-backdrop grid min-h-screen place-items-center" aria-busy="true" aria-label="Sahifa yuklanmoqda">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-[var(--accent-brand)]" />
    </div>
  );
}

// Protected route wrapper: a shared link opened without a session comes back to the same filters after login.
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = getToken();
  const location = useLocation();

  if (!token) {
    const next = location.pathname + location.search;
    return <Navigate to={next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`} replace />;
  }
  
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

export const routes: RouteObject[] = [
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/live",
    element: (
      <ProtectedRoute>
        <LivePage />
      </ProtectedRoute>
    ),
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
];

export const router = createBrowserRouter(routes);
