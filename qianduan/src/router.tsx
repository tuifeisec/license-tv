import { lazy, Suspense, type ReactElement } from "react";
import { createBrowserRouter, Navigate, Outlet, useLocation } from "react-router-dom";

import { AppLayout } from "@/components/layout/AppLayout";
import { PageSkeleton } from "@/components/PageSkeleton";
import { homePathForRole } from "@/lib/navigation";
import { useAuthStore } from "@/store/auth-store";
import type { Role } from "@/types/api";

const ForbiddenPage = lazy(() => import("@/pages/ForbiddenPage").then((module) => ({ default: module.ForbiddenPage })));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })));
const LoginPage = lazy(() => import("@/pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const DesignGuidePage = lazy(() => import("@/pages/DesignGuidePage").then((module) => ({ default: module.DesignGuidePage })));
const ProfilePage = lazy(() => import("@/pages/ProfilePage").then((module) => ({ default: module.ProfilePage })));

const DashboardPage = lazy(() => import("@/pages/admin/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const ScriptListPage = lazy(() => import("@/pages/admin/ScriptListPage").then((module) => ({ default: module.ScriptListPage })));
const ScriptDetailPage = lazy(() =>
  import("@/pages/admin/ScriptDetailPage").then((module) => ({ default: module.ScriptDetailPage })),
);
const ReviewListPage = lazy(() => import("@/pages/admin/ReviewListPage").then((module) => ({ default: module.ReviewListPage })));
const ReviewDetailPage = lazy(() =>
  import("@/pages/admin/ReviewDetailPage").then((module) => ({ default: module.ReviewDetailPage })),
);
const SubscriptionListPage = lazy(() =>
  import("@/pages/admin/SubscriptionListPage").then((module) => ({ default: module.SubscriptionListPage })),
);
const SubscriptionDetailPage = lazy(() =>
  import("@/pages/admin/SubscriptionDetailPage").then((module) => ({ default: module.SubscriptionDetailPage })),
);
const CustomerListPage = lazy(() => import("@/pages/admin/CustomerListPage").then((module) => ({ default: module.CustomerListPage })));
const CustomerDetailPage = lazy(() =>
  import("@/pages/admin/CustomerDetailPage").then((module) => ({ default: module.CustomerDetailPage })),
);
const TVAccessOverviewPage = lazy(() =>
  import("@/pages/admin/TVAccessOverviewPage").then((module) => ({ default: module.TVAccessOverviewPage })),
);
const SubAdminListPage = lazy(() =>
  import("@/pages/admin/SubAdminListPage").then((module) => ({ default: module.SubAdminListPage })),
);
const AgentListPage = lazy(() => import("@/pages/admin/AgentListPage").then((module) => ({ default: module.AgentListPage })));
const AgentDetailPage = lazy(() =>
  import("@/pages/admin/AgentDetailPage").then((module) => ({ default: module.AgentDetailPage })),
);
const SettingsPage = lazy(() => import("@/pages/admin/SettingsPage").then((module) => ({ default: module.SettingsPage })));

const AgentDashboardPage = lazy(() =>
  import("@/pages/agent/AgentDashboardPage").then((module) => ({ default: module.AgentDashboardPage })),
);
const AgentRequestListPage = lazy(() =>
  import("@/pages/agent/AgentRequestListPage").then((module) => ({ default: module.AgentRequestListPage })),
);
const AgentRequestCreatePage = lazy(() =>
  import("@/pages/agent/AgentRequestCreatePage").then((module) => ({ default: module.AgentRequestCreatePage })),
);
const AgentRequestDetailPage = lazy(() =>
  import("@/pages/agent/AgentRequestDetailPage").then((module) => ({ default: module.AgentRequestDetailPage })),
);
const AgentCustomerListPage = lazy(() =>
  import("@/pages/agent/AgentCustomerListPage").then((module) => ({ default: module.AgentCustomerListPage })),
);
const AgentCustomerDetailPage = lazy(() =>
  import("@/pages/agent/AgentCustomerDetailPage").then((module) => ({ default: module.AgentCustomerDetailPage })),
);
const AgentTVRegisterPage = lazy(() =>
  import("@/pages/agent/AgentTVRegisterPage").then((module) => ({ default: module.AgentTVRegisterPage })),
);
const AgentScriptListPage = lazy(() =>
  import("@/pages/agent/AgentScriptListPage").then((module) => ({ default: module.AgentScriptListPage })),
);

function withSuspense(element: ReactElement, variant: "list" | "detail" = "list") {
  return <Suspense fallback={<PageSkeleton variant={variant} />}>{element}</Suspense>;
}

function RootRedirect() {
  const user = useAuthStore((state) => state.user);
  return <Navigate to={user ? homePathForRole(user.role) : "/login"} replace />;
}

function AuthGuard() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());

  if (!isAuthenticated) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  return <Outlet />;
}

function RoleGuard({ roles }: { roles: Role[] }) {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (roles.includes(user.role)) {
    return <Outlet />;
  }
  if (user.role === "super_admin" && roles.includes("admin")) {
    return <Outlet />;
  }
  return <Navigate to="/403" replace />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootRedirect />,
  },
  {
    path: "/login",
    element: withSuspense(<LoginPage />, "detail"),
  },
  {
    path: "/design-guide",
    element: withSuspense(<DesignGuidePage />, "detail"),
  },
  {
    path: "/403",
    element: withSuspense(<ForbiddenPage />, "detail"),
  },
  {
    element: <AuthGuard />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/profile", element: withSuspense(<ProfilePage />, "detail") },
          {
            element: <RoleGuard roles={["admin", "sub_admin", "super_admin"]} />,
            children: [
              { path: "/dashboard", element: withSuspense(<DashboardPage />) },
              { path: "/scripts", element: withSuspense(<ScriptListPage />) },
              { path: "/scripts/:id", element: withSuspense(<ScriptDetailPage />, "detail") },
              { path: "/reviews", element: withSuspense(<ReviewListPage />) },
              { path: "/reviews/:id", element: withSuspense(<ReviewDetailPage />, "detail") },
              { path: "/subscriptions", element: withSuspense(<SubscriptionListPage />) },
              { path: "/subscriptions/:id", element: withSuspense(<SubscriptionDetailPage />, "detail") },
              { path: "/customers", element: withSuspense(<CustomerListPage />) },
              { path: "/customers/:id", element: withSuspense(<CustomerDetailPage />, "detail") },
              { path: "/agents", element: withSuspense(<AgentListPage />) },
              { path: "/agents/:id", element: withSuspense(<AgentDetailPage />, "detail") },
            ],
          },
          {
            element: <RoleGuard roles={["admin", "super_admin"]} />,
            children: [
              { path: "/tv-access", element: withSuspense(<TVAccessOverviewPage />) },
              { path: "/sub-admins", element: withSuspense(<SubAdminListPage />) },
              { path: "/settings", element: withSuspense(<SettingsPage />, "detail") },
            ],
          },
          {
            element: <RoleGuard roles={["agent"]} />,
            children: [
              { path: "/agent/dashboard", element: withSuspense(<AgentDashboardPage />) },
              { path: "/agent/requests", element: withSuspense(<AgentRequestListPage />) },
              { path: "/agent/requests/new", element: withSuspense(<AgentRequestCreatePage />, "detail") },
              { path: "/agent/requests/:id", element: withSuspense(<AgentRequestDetailPage />, "detail") },
              { path: "/agent/customers", element: withSuspense(<AgentCustomerListPage />) },
              { path: "/agent/customers/:id", element: withSuspense(<AgentCustomerDetailPage />, "detail") },
              { path: "/agent/tv-register", element: withSuspense(<AgentTVRegisterPage />, "detail") },
              { path: "/agent/scripts", element: withSuspense(<AgentScriptListPage />) },
            ],
          },
        ],
      },
    ],
  },
  {
    path: "*",
    element: withSuspense(<NotFoundPage />, "detail"),
  },
]);
