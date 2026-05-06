import { createRouter, createWebHistory } from "vue-router";
import AppLayout from "../layouts/AppLayout.vue";
import AuthLayout from "../layouts/AuthLayout.vue";
import HomeView from "../views/HomeView.vue";
import LoginView from "../views/Auth/LoginView.vue";
import { useAuthStore, type UserRole } from "../stores/auth";
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
      path: "/",
      component: AppLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: "",
          name: "home",
          component: HomeView,
        },
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
  ],
});

router.beforeEach((to) => {
  const authStore = useAuthStore();
  const tokenFromStorage = localStorage.getItem("auth.token");
  const roleFromStorage = localStorage.getItem("auth.role") as UserRole | null;
  const hasToken = authStore.isAuthenticated || Boolean(tokenFromStorage);
  const requiresAuth = to.matched.some((route) => route.meta.requiresAuth);
  const allowedRoles = to.matched
    .flatMap((route) => (route.meta.allowedRoles as UserRole[] | undefined) ?? []);
  const currentRole = authStore.userRole ?? roleFromStorage;

  if (requiresAuth && !hasToken) {
    return { name: "login" };
  }

  if (to.name === "login" && hasToken) {
    if (currentRole === "Менеджер") {
      return { name: "orders" };
    }
    if (currentRole === "Мастер цеха") {
      return { name: "workshop-tasks" };
    }
    if (currentRole === "Монтажник") {
      return { name: "installer-deployments" };
    }
    if (currentRole === "Кладовщик") {
      return { name: "storekeeper-inventory" };
    }
    if (currentRole === "Закупщик") {
      return { name: "buyer-deficit" };
    }
    if (currentRole === "Руководитель") {
      return { name: "director-monitoring" };
    }
    return { name: "home" };
  }

  if (allowedRoles.length > 0 && currentRole && !allowedRoles.includes(currentRole)) {
    return { name: "home" };
  }

  return true;
});

export default router;
