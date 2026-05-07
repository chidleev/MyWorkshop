import type { RouteLocationRaw } from "vue-router";
import type { UserRole } from "../stores/auth";

const DEFAULT_ROUTE_BY_ROLE = {
  Менеджер: "orders",
  "Мастер цеха": "workshop-tasks",
  Монтажник: "installer-deployments",
  Кладовщик: "storekeeper-inventory",
  Закупщик: "buyer-deficit",
  Руководитель: "director-monitoring",
} satisfies Record<UserRole, string>;

export function getDefaultRouteForRole(role: UserRole | null | undefined): RouteLocationRaw {
  if (!role) {
    return { name: "login" };
  }

  return { name: DEFAULT_ROUTE_BY_ROLE[role] };
}
