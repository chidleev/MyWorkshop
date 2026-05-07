<script setup lang="ts">
import { computed, ref } from "vue";
import { Icon } from "@iconify/vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import type { UserRole } from "../stores/auth";
import OrderFormModal from "../components/Orders/OrderFormModal.vue";
import { useManagerOrdersStore } from "../stores/managerOrders";
import type { OrderFormPayload, OrderStatus } from "../types/order";

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();
const sidebarOpen = ref(false);
const ordersStore = useManagerOrdersStore();
void ordersStore.ensureLoaded();
const isSidebarEditOpen = ref(false);

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
    label: "Остатки склада",
    routeName: "storekeeper-inventory",
    icon: "heroicons:archive-box",
    roles: ["Кладовщик"],
  },
  {
    label: "Транзакции склада",
    routeName: "storekeeper-transactions",
    icon: "heroicons:arrows-right-left",
    roles: ["Кладовщик"],
  },
  {
    label: "Дефицит материалов",
    routeName: "buyer-deficit",
    icon: "heroicons:exclamation-triangle",
    roles: ["Закупщик"],
  },
  {
    label: "Мои выезды",
    routeName: "installer-deployments",
    icon: "heroicons:truck",
    roles: ["Монтажник"],
  },
  {
    label: "Мониторинг сделок",
    routeName: "director-monitoring",
    icon: "heroicons:rectangle-stack",
    roles: ["Руководитель"],
  },
  {
    label: "Загрузка линий",
    routeName: "director-workload",
    icon: "heroicons:chart-bar-square",
    roles: ["Руководитель"],
  },
  {
    label: "Рентабельность",
    routeName: "director-profitability",
    icon: "heroicons:banknotes",
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

const isManagerOrderDetail = computed(() => authStore.userRole === "Менеджер" && route.name === "order-detail");
const currentOrderId = computed(() => Number(route.params.id));
const currentOrder = computed(() => {
  if (!isManagerOrderDetail.value || !Number.isFinite(currentOrderId.value)) {
    return null;
  }
  return ordersStore.findById(currentOrderId.value);
});

const statusButtons: Array<{ key: OrderStatus; label: string }> = [
  { key: "new", label: "В обработке" },
  { key: "cutting", label: "Распил" },
  { key: "edging", label: "Кромление" },
  { key: "assembly", label: "Сборка" },
  { key: "ready_to_ship", label: "Готов к отгрузке" }
];

function isCurrentStatus(status: OrderStatus) {
  return currentOrder.value?.status === status;
}

async function setStatus(status: OrderStatus) {
  if (!currentOrder.value) {
    return;
  }
  await ordersStore.updateOrderStatus(currentOrder.value.id, status);
}

async function deleteCurrentOrder() {
  if (!currentOrder.value) {
    return;
  }
  await ordersStore.deleteOrder(currentOrder.value.id);
  await router.push({ name: "orders" });
}

async function updateCurrentOrder(payload: OrderFormPayload) {
  if (!currentOrder.value) {
    return;
  }
  await ordersStore.updateOrder(currentOrder.value.id, payload);
  isSidebarEditOpen.value = false;
}

async function handleLogout() {
  authStore.logout();
  sidebarOpen.value = false;
  await router.push("/login");
}
</script>

<template>
  <div class="min-h-screen bg-slate-100 text-slate-900">
    <header
      class="relative z-20 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6"
    >
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
      <div class="flex items-center gap-2">
        <div class="text-right">
          <p class="text-sm font-medium text-slate-900">
            {{ authStore.userInfo?.fullName ?? "Сотрудник" }}
          </p>
          <p class="text-xs text-slate-500">{{ authStore.userRole ?? "Роль не выбрана" }}</p>
        </div>
        <button
          type="button"
          class="inline-flex h-10 w-10 items-center justify-center rounded-md border border-danger text-danger hover:bg-red-50"
          title="Выйти"
          aria-label="Выйти из аккаунта"
          @click="handleLogout"
        >
          <Icon icon="heroicons:arrow-left-on-rectangle" class="h-5 w-5" />
        </button>
      </div>
    </header>

    <div class="relative mx-auto flex max-w-7xl gap-4 p-4 sm:p-6">
      <!-- Overlay for mobile -->
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 z-10 bg-slate-900/20 md:hidden"
        @click="sidebarOpen = false"
      ></div>

      <aside
        :class="[
          'w-72 shrink-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:relative md:block md:z-auto',
          sidebarOpen ? 'absolute z-20 block' : 'hidden',
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

        <section v-if="isManagerOrderDetail && currentOrder" class="mt-4 rounded-lg border border-slate-200 p-3">
          <h3 class="text-sm font-semibold text-slate-900">Управление заказом</h3>
          <p class="mt-1 text-xs text-slate-500">Заказ {{ currentOrder.agreement_number }}</p>

          <div class="mt-3 space-y-2">
            <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Смена статуса</p>
            <div class="grid grid-cols-1 gap-2">
              <button
                v-for="item in statusButtons"
                :key="item.key"
                type="button"
                class="rounded-md border px-3 py-2 text-left text-sm"
                :class="isCurrentStatus(item.key) ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-slate-300 hover:bg-slate-100'"
                :disabled="isCurrentStatus(item.key)"
                @click="setStatus(item.key)"
              >
                {{ item.label }}
              </button>
            </div>
          </div>

          <div class="mt-3 flex flex-col gap-2">
            <button
              type="button"
              class="w-full rounded-md border border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-blue-50"
              @click="isSidebarEditOpen = true"
            >
              Редактировать заказ
            </button>
            <button
              type="button"
              class="w-full rounded-md border border-danger px-3 py-2 text-sm font-medium text-danger hover:bg-red-50"
              @click="deleteCurrentOrder"
            >
              Удалить заказ
            </button>
          </div>
        </section>
      </aside>

      <main class="min-w-0 flex-1">
        <RouterView />
      </main>
    </div>

    <OrderFormModal
      v-if="currentOrder"
      :is-open="isSidebarEditOpen"
      mode="edit"
      :initial-data="currentOrder"
      @close="isSidebarEditOpen = false"
      @submit="updateCurrentOrder"
    />
  </div>
</template>
