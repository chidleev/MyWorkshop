import { createRouter, createWebHistory } from "vue-router";
import AppLayout from "../layouts/AppLayout.vue";
import AuthLayout from "../layouts/AuthLayout.vue";
import LeadCaptureWidget from "../components/Client/LeadCaptureWidget.vue";
import LoginView from "../views/Auth/LoginView.vue";
import { useAuthStore, type UserRole } from "../stores/auth";
import { getDefaultRouteForRole } from "../utils/roleRoutes";
import OrdersView from "../views/Manager/OrdersView.vue";
import OrderDetailView from "../views/Manager/OrderDetailView.vue";
import ShiftTasksView from "../views/Workshop/ShiftTasksView.vue";
import DeploymentsView from "../views/Installer/DeploymentsView.vue";
import DeploymentDetailView from "../views/Installer/DeploymentDetailView.vue";
import InventoryView from "../views/Storekeeper/InventoryView.vue";
import TransactionsView from "../views/Storekeeper/TransactionsView.vue";
import DeficitReportView from "../views/Buyer/DeficitReportView.vue";
import GlobalMonitoringView from "../views/Director/GlobalMonitoringView.vue";
import WorkloadDashboardView from "../views/Director/WorkloadDashboardView.vue";
import ProfitabilityReportView from "../views/Director/ProfitabilityReportView.vue";
import NotFoundView from "../views/NotFoundView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/login",
      component: AuthLayout,
      meta: { requiresAuth: false },
      children: [
        {
          path: "",
          name: "login",
          component: LoginView,
        },
      ],
    },
    {
      path: "/feedback-widget",
      component: AuthLayout,
      meta: { requiresAuth: false },
      children: [
        {
          path: "",
          name: "feedback-widget-demo",
          component: LeadCaptureWidget,
        },
      ],
    },
    {
      path: "/",
      component: AppLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: "orders",
          name: "orders",
          component: OrdersView,
          meta: { allowedRoles: ["Менеджер"] satisfies UserRole[] },
        },
        {
          path: "orders/:id",
          name: "order-detail",
          component: OrderDetailView,
          meta: { allowedRoles: ["Менеджер"] satisfies UserRole[] },
        },
        {
          path: "workshop/tasks",
          name: "workshop-tasks",
          component: ShiftTasksView,
          meta: { allowedRoles: ["Мастер цеха"] satisfies UserRole[] },
        },
        {
          path: "installer/deployments",
          name: "installer-deployments",
          component: DeploymentsView,
          meta: { allowedRoles: ["Монтажник"] satisfies UserRole[] },
        },
        {
          path: "installer/deployments/:id",
          name: "installer-deployment-detail",
          component: DeploymentDetailView,
          meta: { allowedRoles: ["Монтажник"] satisfies UserRole[] },
        },
        {
          path: "storekeeper/inventory",
          name: "storekeeper-inventory",
          component: InventoryView,
          meta: { allowedRoles: ["Кладовщик"] satisfies UserRole[] },
        },
        {
          path: "storekeeper/transactions",
          name: "storekeeper-transactions",
          component: TransactionsView,
          meta: { allowedRoles: ["Кладовщик"] satisfies UserRole[] },
        },
        {
          path: "buyer/deficit",
          name: "buyer-deficit",
          component: DeficitReportView,
          meta: { allowedRoles: ["Закупщик"] satisfies UserRole[] },
        },
        {
          path: "director/monitoring",
          name: "director-monitoring",
          component: GlobalMonitoringView,
          meta: { allowedRoles: ["Руководитель"] satisfies UserRole[] },
        },
        {
          path: "director/workload",
          name: "director-workload",
          component: WorkloadDashboardView,
          meta: { allowedRoles: ["Руководитель"] satisfies UserRole[] },
        },
        {
          path: "director/profitability",
          name: "director-profitability",
          component: ProfitabilityReportView,
          meta: { allowedRoles: ["Руководитель"] satisfies UserRole[] },
        },
      ],
    },
    {
      path: "/:pathMatch(.*)*",
      name: "not-found",
      component: NotFoundView,
      meta: { requiresAuth: false },
    },
  ],
});

router.beforeEach((to) => {
  const authStore = useAuthStore();
  const tokenFromStorage = localStorage.getItem("auth.token");
  const roleFromStorage = localStorage.getItem("auth.role") as UserRole | null;
  const hasToken = authStore.isAuthenticated || Boolean(tokenFromStorage);
  const requiresAuth = to.matched.some((route) => route.meta.requiresAuth);
  const allowedRoles = to.matched.flatMap(
    (route) => (route.meta.allowedRoles as UserRole[] | undefined) ?? []
  );
  const currentRole = authStore.userRole ?? roleFromStorage;
  const hasValidSession = hasToken && Boolean(currentRole);

  if (requiresAuth && !hasValidSession) {
    return { name: "login" };
  }

  if ((to.path === "/" || to.name === "login") && hasValidSession) {
    return getDefaultRouteForRole(currentRole);
  }

  if (allowedRoles.length > 0 && !currentRole) {
    return { name: "login" };
  }

  if (allowedRoles.length > 0 && currentRole && !allowedRoles.includes(currentRole)) {
    return getDefaultRouteForRole(currentRole);
  }

  return true;
});

export default router;
