import { createRouter, createWebHistory } from "vue-router";
import AppLayout from "../layouts/AppLayout.vue";
import AuthLayout from "../layouts/AuthLayout.vue";
import HomeView from "../views/HomeView.vue";
import LoginView from "../views/Auth/LoginView.vue";
import { useAuthStore } from "../stores/auth";
import OrdersView from "../views/OrdersView.vue";
import TasksView from "../views/TasksView.vue";
import WarehouseView from "../views/WarehouseView.vue";
import AnalyticsView from "../views/AnalyticsView.vue";

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
        },
        {
          path: "tasks",
          name: "tasks",
          component: TasksView,
        },
        {
          path: "warehouse",
          name: "warehouse",
          component: WarehouseView,
        },
        {
          path: "analytics",
          name: "analytics",
          component: AnalyticsView,
        },
      ],
    },
  ],
});

router.beforeEach((to) => {
  const authStore = useAuthStore();
  const tokenFromStorage = localStorage.getItem("auth.token");
  const hasToken = authStore.isAuthenticated || Boolean(tokenFromStorage);
  const requiresAuth = to.matched.some((route) => route.meta.requiresAuth);

  if (requiresAuth && !hasToken) {
    return { name: "login" };
  }

  if (to.name === "login" && hasToken) {
    return { name: "home" };
  }

  return true;
});

export default router;
