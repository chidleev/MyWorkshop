<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import OrderFormModal from "../../components/Orders/OrderFormModal.vue";
import type { Order, OrderFormPayload, OrderStatus } from "../../types/order";

interface KanbanColumn {
  status: OrderStatus;
  title: string;
}

const columns: KanbanColumn[] = [
  { status: "new", title: "В обработке" },
  { status: "cutting", title: "Распил" },
  { status: "edging", title: "Кромление" },
  { status: "assembly", title: "Сборка" },
  { status: "ready_to_ship", title: "Готов к отгрузке" },
];

const isLoading = ref(true);
const orders = ref<Order[]>([]);
const router = useRouter();

const isModalOpen = ref(false);
const modalMode = ref<"create" | "edit">("create");
const selectedOrder = ref<Order | null>(null);
const orderIdToDelete = ref<number | null>(null);

function nowIso() {
  return new Date().toISOString();
}

function futureDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatCurrency(amount: string | null) {
  if (!amount) {
    return "Не рассчитана";
  }

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

function isOverdue(order: Order) {
  return order.status !== "ready_to_ship" && order.target_date < new Date().toISOString().slice(0, 10);
}

function isNearDeadline(order: Order) {
  if (order.status === "ready_to_ship") {
    return false;
  }

  const today = new Date();
  const targetDate = new Date(order.target_date);
  const days = Math.ceil((targetDate.getTime() - today.getTime()) / 86400000);
  return days >= 0 && days <= 2;
}

const columnOrders = computed(() => {
  return columns.map((column) => ({
    ...column,
    orders: orders.value.filter((order) => order.status === column.status),
  }));
});

async function loadOrders() {
  isLoading.value = true;

  const mockOrders: Order[] = [
    {
      id: 1,
      agreement_number: "MM-2026-001",
      client_id: "crm-client-001",
      manager_ext_id: "crm-manager-001",
      full_name: "Павлов Артем",
      phone: "+7 (901) 123-45-67",
      email: "pavlov@example.com",
      address: "г. Москва, ул. Тверская, 10",
      status: "new",
      target_date: futureDate(1),
      total_cost: "128500.00",
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      id: 2,
      agreement_number: "MM-2026-002",
      client_id: "crm-client-002",
      manager_ext_id: "crm-manager-001",
      full_name: "Ильина Ольга",
      phone: "+7 (925) 555-77-99",
      email: "ilina@example.com",
      address: "г. Химки, ул. Молодежная, 4",
      status: "cutting",
      target_date: futureDate(4),
      total_cost: "84500.00",
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      id: 3,
      agreement_number: "MM-2026-003",
      client_id: "crm-client-003",
      manager_ext_id: "crm-manager-001",
      full_name: "Крылов Денис",
      phone: "+7 (916) 888-12-34",
      email: "krylov@example.com",
      address: "г. Москва, Ленинский пр-т, 88",
      status: "assembly",
      target_date: futureDate(-1),
      total_cost: "219900.00",
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      id: 4,
      agreement_number: "MM-2026-004",
      client_id: "crm-client-004",
      manager_ext_id: "crm-manager-001",
      full_name: "Семенова Ирина",
      phone: "+7 (903) 765-43-21",
      email: "semenova@example.com",
      address: "г. Мытищи, ул. Юбилейная, 15",
      status: "ready_to_ship",
      target_date: futureDate(0),
      total_cost: "156000.00",
      created_at: nowIso(),
      updated_at: nowIso(),
    },
  ];

  await new Promise((resolve) => setTimeout(resolve, 400));
  orders.value = mockOrders;
  isLoading.value = false;
}

function openCreateModal() {
  modalMode.value = "create";
  selectedOrder.value = null;
  isModalOpen.value = true;
}

function openEditModal(order: Order) {
  modalMode.value = "edit";
  selectedOrder.value = order;
  isModalOpen.value = true;
}

async function openOrderDetail(orderId: number) {
  await router.push({ name: "order-detail", params: { id: orderId } });
}

function closeModal() {
  isModalOpen.value = false;
}

function upsertOrder(payload: OrderFormPayload) {
  if (modalMode.value === "create") {
    const nextId = Math.max(0, ...orders.value.map((order) => order.id)) + 1;
    const timestamp = nowIso();
    const newOrder: Order = {
      id: nextId,
      client_id: `crm-client-${nextId}`,
      manager_ext_id: "crm-manager-001",
      status: "new",
      total_cost: null,
      created_at: timestamp,
      updated_at: timestamp,
      ...payload,
    };

    orders.value = [newOrder, ...orders.value];
    isModalOpen.value = false;
    return;
  }

  if (!selectedOrder.value) {
    return;
  }

  orders.value = orders.value.map((order) =>
    order.id === selectedOrder.value?.id
      ? {
          ...order,
          ...payload,
          updated_at: nowIso(),
        }
      : order
  );

  isModalOpen.value = false;
}

function askDelete(orderId: number) {
  orderIdToDelete.value = orderId;
}

function cancelDelete() {
  orderIdToDelete.value = null;
}

function confirmDelete() {
  if (orderIdToDelete.value === null) {
    return;
  }

  orders.value = orders.value.filter((order) => order.id !== orderIdToDelete.value);
  orderIdToDelete.value = null;
}

const orderToDelete = computed(
  () => orders.value.find((order) => order.id === orderIdToDelete.value) ?? null
);

onMounted(() => {
  void loadOrders();
});
</script>

<template>
  <section class="space-y-4">
    <header class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Мои заказы</h1>
        <p class="text-sm text-slate-500">Канбан по этапам производства с контролем сроков.</p>
      </div>
      <button
        type="button"
        class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        @click="openCreateModal"
      >
        + Новый заказ
      </button>
    </header>

    <div
      v-if="isLoading"
      class="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm"
    >
      Загрузка заказов...
    </div>

    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
      <article
        v-for="column in columnOrders"
        :key="column.status"
        class="flex min-h-[360px] flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
      >
        <header class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-slate-900">{{ column.title }}</h2>
          <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{{ column.orders.length }}</span>
        </header>

        <div class="space-y-3 overflow-y-auto pr-1">
          <div
            v-for="order in column.orders"
            :key="order.id"
            class="rounded-lg border p-3 shadow-sm"
            :class="{
              'border-danger bg-red-50': isOverdue(order),
              'border-warning bg-amber-50': !isOverdue(order) && isNearDeadline(order),
              'border-slate-200 bg-white': !isOverdue(order) && !isNearDeadline(order),
            }"
          >
            <div class="mb-2 flex items-center justify-between gap-2">
              <p class="text-xs font-semibold text-slate-700">{{ order.agreement_number }}</p>
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="{
                  'bg-amber-100 text-amber-700': order.status !== 'ready_to_ship',
                  'bg-green-100 text-green-700': order.status === 'ready_to_ship',
                }"
              >
                {{ order.status === "ready_to_ship" ? "Готов" : "В работе" }}
              </span>
            </div>

            <p class="text-sm font-medium text-slate-900">{{ order.full_name }}</p>
            <p class="mt-1 text-xs text-slate-600">Сдать до: {{ order.target_date }}</p>
            <p class="mt-1 text-xs text-slate-600">Сумма: {{ formatCurrency(order.total_cost) }}</p>

            <div class="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-md border border-primary px-2 py-1 text-xs text-primary hover:bg-blue-50"
                @click="openOrderDetail(order.id)"
              >
                Детали
              </button>
              <button
                type="button"
                class="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                @click="openEditModal(order)"
              >
                Редактировать
              </button>
              <button
                type="button"
                class="rounded-md border border-danger px-2 py-1 text-xs text-danger hover:bg-red-50"
                @click="askDelete(order.id)"
              >
                Удалить
              </button>
            </div>
          </div>

          <p v-if="column.orders.length === 0" class="rounded-md border border-dashed border-slate-200 p-3 text-xs text-slate-400">
            Нет заказов
          </p>
        </div>
      </article>
    </div>

    <OrderFormModal
      :is-open="isModalOpen"
      :mode="modalMode"
      :initial-data="selectedOrder"
      @close="closeModal"
      @submit="upsertOrder"
    />

    <div v-if="orderToDelete" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <section class="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h3 class="text-lg font-semibold text-slate-900">Подтвердите удаление</h3>
        <p class="mt-2 text-sm text-slate-600">
          Вы уверены, что хотите удалить заказ {{ orderToDelete.agreement_number }}? Это действие необратимо.
        </p>
        <div class="mt-4 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            @click="cancelDelete"
          >
            Отмена
          </button>
          <button
            type="button"
            class="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            @click="confirmDelete"
          >
            Удалить
          </button>
        </div>
      </section>
    </div>
  </section>
</template>
