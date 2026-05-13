import { createRouter, createWebHistory, type RouteLocationNormalized } from "vue-router";
import AppLayout from "../layouts/AppLayout.vue";
import AuthLayout from "../layouts/AuthLayout.vue";
import LeadCaptureWidget from "../components/Client/LeadCaptureWidget.vue";
import LoginView from "../views/Auth/LoginView.vue";
import { useAuthStore, type UserRole } from "../stores/auth";
import { getDefaultRouteForRole } from "../utils/roleRoutes";
import OrdersView from "../views/Manager/OrdersView.vue";
import WebApplicationsView from "../views/Manager/WebApplicationsView.vue";
import OrderDetailView from "../views/Manager/OrderDetailView.vue";
import ShiftTasksView from "../views/Workshop/ShiftTasksView.vue";
import DeploymentsView from "../views/Installer/DeploymentsView.vue";
import DeploymentDetailView from "../views/Installer/DeploymentDetailView.vue";
import InventoryView from "../views/Storekeeper/InventoryView.vue";
import TransactionsView from "../views/Storekeeper/TransactionsView.vue";
import DeficitReportView from "../views/Buyer/DeficitReportView.vue";
import GlobalMonitoringView from "../views/Director/GlobalMonitoringView.vue";
import DirectorOrderDetailView from "../views/Director/DirectorOrderDetailView.vue";
import WorkloadDashboardView from "../views/Director/WorkloadDashboardView.vue";
import ProfitabilityReportView from "../views/Director/ProfitabilityReportView.vue";
import NotFoundView from "../views/NotFoundView.vue";
import PublicDocumentView from "../views/Public/PublicDocumentView.vue";

const APP_NAME = "Моя Мастерская";

function formatDocumentTitle(pageTitle: string | undefined): string {
  const page = pageTitle?.trim();
  if (!page) {
    return APP_NAME;
  }
  return `${page} — ${APP_NAME}`;
}

function resolveDocumentTitle(to: RouteLocationNormalized): string {
  const id = to.params.id;
  const idStr = id == null || Array.isArray(id) ? "" : String(id);

  if (to.name === "order-detail" && idStr) {
    return formatDocumentTitle(`Заказ №${idStr}`);
  }
  if (to.name === "installer-deployment-detail" && idStr) {
    return formatDocumentTitle(`Выезд №${idStr}`);
  }
  if (to.name === "director-order-detail" && idStr) {
    return formatDocumentTitle(`Заказ №${idStr} · руководитель`);
  }

  if (to.name === "public-document") {
    const fn = to.params.filename;
    const name = Array.isArray(fn) ? fn[0] : fn;
    const s = String(name ?? "");
    if (/^receipt_/i.test(s)) {
      return formatDocumentTitle("Товарный чек");
    }
    if (/^act_/i.test(s)) {
      return formatDocumentTitle("Акт выполненных работ");
    }
    return formatDocumentTitle("Документ");
  }

  const recordWithTitle = [...to.matched].reverse().find((r) => Boolean(r.meta.title));
  return formatDocumentTitle(recordWithTitle?.meta.title as string | undefined);
}

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
          meta: { title: "Вход" },
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
          meta: { title: "Виджет заявки" },
        },
      ],
    },
    {
      path: "/documents/:filename(receipt_\\d+\\.pdf|act_\\d+\\.pdf)",
      name: "public-document",
      component: PublicDocumentView,
      meta: { requiresAuth: false, title: "Документ" },
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
          meta: { allowedRoles: ["Менеджер"] satisfies UserRole[], title: "Мои заказы" },
        },
        {
          path: "orders/applications",
          name: "manager-applications",
          component: WebApplicationsView,
          meta: { allowedRoles: ["Менеджер"] satisfies UserRole[], title: "Заявки с сайта" },
        },
        {
          path: "orders/:id",
          name: "order-detail",
          component: OrderDetailView,
          meta: { allowedRoles: ["Менеджер"] satisfies UserRole[], title: "Заказ" },
        },
        {
          path: "workshop/tasks",
          name: "workshop-tasks",
          component: ShiftTasksView,
          meta: { allowedRoles: ["Мастер цеха"] satisfies UserRole[], title: "Сменные задания" },
        },
        {
          path: "installer/deployments",
          name: "installer-deployments",
          component: DeploymentsView,
          meta: { allowedRoles: ["Монтажник"] satisfies UserRole[], title: "Мои выезды" },
        },
        {
          path: "installer/deployments/:id",
          name: "installer-deployment-detail",
          component: DeploymentDetailView,
          meta: { allowedRoles: ["Монтажник"] satisfies UserRole[], title: "Выезд" },
        },
        {
          path: "storekeeper/inventory",
          name: "storekeeper-inventory",
          component: InventoryView,
          meta: { allowedRoles: ["Кладовщик"] satisfies UserRole[], title: "Остатки склада" },
        },
        {
          path: "storekeeper/transactions",
          name: "storekeeper-transactions",
          component: TransactionsView,
          meta: { allowedRoles: ["Кладовщик"] satisfies UserRole[], title: "Транзакции склада" },
        },
        {
          path: "buyer/deficit",
          name: "buyer-deficit",
          component: DeficitReportView,
          meta: { allowedRoles: ["Закупщик"] satisfies UserRole[], title: "Дефицит материалов" },
        },
        {
          path: "director/monitoring",
          name: "director-monitoring",
          component: GlobalMonitoringView,
          meta: { allowedRoles: ["Руководитель"] satisfies UserRole[], title: "Мониторинг сделок" },
        },
        {
          path: "director/orders/:id",
          name: "director-order-detail",
          component: DirectorOrderDetailView,
          meta: { allowedRoles: ["Руководитель"] satisfies UserRole[], title: "Заказ" },
        },
        {
          path: "director/workload",
          name: "director-workload",
          component: WorkloadDashboardView,
          meta: { allowedRoles: ["Руководитель"] satisfies UserRole[], title: "Загрузка линий" },
        },
        {
          path: "director/profitability",
          name: "director-profitability",
          component: ProfitabilityReportView,
          meta: { allowedRoles: ["Руководитель"] satisfies UserRole[], title: "Рентабельность" },
        },
      ],
    },
    {
      path: "/:pathMatch(.*)*",
      name: "not-found",
      component: NotFoundView,
      meta: { requiresAuth: false, title: "Страница не найдена" },
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

router.afterEach((to) => {
  document.title = resolveDocumentTitle(to);
});

export default router;
