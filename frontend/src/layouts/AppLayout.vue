<script setup lang="ts">
import { computed, ref } from "vue";
import { Icon } from "@iconify/vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import type { UserRole } from "../stores/auth";

const authStore = useAuthStore();
const router = useRouter();
const sidebarOpen = ref(false);

interface MenuItem {
  label: string;
  routeName: string;
  icon: string;
  roles: UserRole[];
}

const menuItems: MenuItem[] = [
  {
    label: "Мои заказы",
    routeName: "orders",
    icon: "heroicons:clipboard-document-list",
    roles: ["Менеджер"],
  },
  {
    label: "Сменные задания",
    routeName: "workshop-tasks",
    icon: "heroicons:wrench-screwdriver",
    roles: ["Мастер цеха"],
  },
  {
    label: "Склад",
    routeName: "warehouse",
    icon: "heroicons:archive-box",
    roles: ["Кладовщик", "Закупщик", "Руководитель"],
  },
  {
    label: "Мои выезды",
    routeName: "installer-deployments",
    icon: "heroicons:truck",
    roles: ["Монтажник"],
  },
  {
    label: "Загрузка цеха",
    routeName: "analytics",
    icon: "heroicons:chart-bar-square",
    roles: ["Руководитель"],
  },
];

const visibleMenuItems = computed(() => {
  const role = authStore.userRole;
  if (!role) {
    return [];
  }

  return menuItems.filter((item) => item.roles.includes(role));
});

async function handleLogout() {
  authStore.logout();
  sidebarOpen.value = false;
  await router.push("/login");
}
</script>

<template>
  <div class="min-h-screen bg-slate-100 text-slate-900">
    <header class="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="inline-flex items-center rounded-md border border-slate-200 p-2 md:hidden"
          @click="sidebarOpen = !sidebarOpen"
        >
          <Icon icon="heroicons:bars-3" class="h-5 w-5" />
        </button>
        <strong>Моя Мастерская</strong>
      </div>
      <div class="text-right">
        <p class="text-sm font-medium text-slate-900">{{ authStore.userInfo?.fullName ?? "Сотрудник" }}</p>
        <p class="text-xs text-slate-500">{{ authStore.userRole ?? "Роль не выбрана" }}</p>
      </div>
    </header>

    <div class="mx-auto flex max-w-7xl gap-4 p-4 sm:p-6">
      <aside
        :class="[
          'w-72 shrink-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:block',
          sidebarOpen ? 'block' : 'hidden',
        ]"
      >
        <nav class="space-y-1">
          <RouterLink
            v-for="item in visibleMenuItems"
            :key="item.routeName"
            :to="{ name: item.routeName }"
            class="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            active-class="bg-primary/10 text-primary"
            @click="sidebarOpen = false"
          >
            <Icon :icon="item.icon" class="h-4 w-4" />
            <span>{{ item.label }}</span>
          </RouterLink>
        </nav>

        <button
          type="button"
          class="mt-4 w-full rounded-md border border-danger px-3 py-2 text-sm font-medium text-danger hover:bg-red-50"
          @click="handleLogout"
        >
          Выйти
        </button>
      </aside>

      <main class="min-w-0 flex-1">
        <RouterView />
      </main>
    </div>
  </div>
</template>
