<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import OrderFormModal from "../../components/Orders/OrderFormModal.vue";
import type { Order, OrderFormPayload, OrderStatus } from "../../types/order";
import { useManagerOrdersStore } from "../../stores/managerOrders";

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
const router = useRouter();
const ordersStore = useManagerOrdersStore();
const orders = ordersStore.orders;

const isModalOpen = ref(false);
const modalMode = ref<"create" | "edit">("create");
const selectedOrder = ref<Order | null>(null);
const orderIdToDelete = ref<number | null>(null);
const isColumnListOpen = ref(false);
const selectedColumnStatus = ref<OrderStatus | null>(null);
const listSearch = ref("");
const listSort = ref<"created_old" | "created_new" | "deadline_asc" | "deadline_desc" | "name_asc">("created_old");

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
    orders: orders.value
      .filter((order) => order.status === column.status)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
  }));
});

const columnListTitle = computed(() => {
  const column = columns.find((item) => item.status === selectedColumnStatus.value);
  return column?.title ?? "";
});

const fullColumnOrders = computed(() => {
  if (!selectedColumnStatus.value) {
    return [];
  }

  const filtered = orders.value.filter((order) => order.status === selectedColumnStatus.value);
  const search = listSearch.value.trim().toLowerCase();
  const searched = search
    ? filtered.filter((order) => {
        return (
          order.agreement_number.toLowerCase().includes(search) ||
          order.full_name.toLowerCase().includes(search) ||
          order.phone.toLowerCase().includes(search)
        );
      })
    : filtered;

  return [...searched].sort((a, b) => {
    switch (listSort.value) {
      case "created_new":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "deadline_asc":
        return new Date(a.target_date).getTime() - new Date(b.target_date).getTime();
      case "deadline_desc":
        return new Date(b.target_date).getTime() - new Date(a.target_date).getTime();
      case "name_asc":
        return a.full_name.localeCompare(b.full_name, "ru");
      case "created_old":
      default:
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
  });
});

async function loadOrders() {
  isLoading.value = true;
  await new Promise((resolve) => setTimeout(resolve, 400));
  ordersStore.ensureLoaded();
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

function openColumnList(status: OrderStatus) {
  selectedColumnStatus.value = status;
  listSearch.value = "";
  listSort.value = "created_old";
  isColumnListOpen.value = true;
}

function closeColumnList() {
  isColumnListOpen.value = false;
  selectedColumnStatus.value = null;
}

function upsertOrder(payload: OrderFormPayload) {
  if (modalMode.value === "create") {
    ordersStore.createOrder(payload);
    isModalOpen.value = false;
    return;
  }

  if (!selectedOrder.value) {
    return;
  }

  ordersStore.updateOrder(selectedOrder.value.id, payload);

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

  ordersStore.deleteOrder(orderIdToDelete.value);
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
            v-for="order in column.orders.slice(0, 2)"
            :key="order.id"
            class="rounded-lg border p-3 shadow-sm"
            :class="{
              'border-danger bg-red-50': isOverdue(order),
              'border-warning bg-amber-50': !isOverdue(order) && isNearDeadline(order),
              'border-slate-200 bg-white': !isOverdue(order) && !isNearDeadline(order),
            }"
          >
            <div class="mb-2 flex min-w-0 items-start justify-between gap-2">
              <p class="min-w-0 text-xs font-semibold text-slate-700 break-all line-clamp-2" :title="order.agreement_number">
                {{ order.agreement_number }}
              </p>
              <span
                class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                :class="{
                  'bg-amber-100 text-amber-700': order.status !== 'ready_to_ship',
                  'bg-green-100 text-green-700': order.status === 'ready_to_ship',
                }"
              >
                {{ order.status === "ready_to_ship" ? "Готов" : "В работе" }}
              </span>
            </div>

            <p class="text-sm font-medium text-slate-900 break-words line-clamp-2" :title="order.full_name">{{ order.full_name }}</p>
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

          <button
            v-if="column.orders.length > 2"
            type="button"
            class="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
            @click="openColumnList(column.status)"
          >
            Показать все ({{ column.orders.length }})
          </button>
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

    <Teleport to="body">
      <div v-if="orderToDelete" class="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 p-4">
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
    </Teleport>

    <Teleport to="body">
      <div v-if="isColumnListOpen" class="fixed inset-0 z-[105] flex items-center justify-center bg-slate-900/60 p-4">
        <section class="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl">
          <header class="border-b border-slate-200 p-4 sm:p-5">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h3 class="text-lg font-semibold text-slate-900">
                  Все заказы: {{ columnListTitle }}
                </h3>
                <p class="mt-1 text-sm text-slate-500">
                  Найдено: {{ fullColumnOrders.length }}
                </p>
              </div>
              <button type="button" class="rounded-md p-1 text-slate-500 hover:bg-slate-100" @click="closeColumnList">
                ✕
              </button>
            </div>

            <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                v-model="listSearch"
                type="text"
                placeholder="Поиск по договору, ФИО, телефону"
                class="w-full rounded-md border-slate-300 text-sm"
              />
              <select v-model="listSort" class="w-full rounded-md border-slate-300 text-sm">
                <option value="created_old">Сначала самые старые</option>
                <option value="created_new">Сначала новые</option>
                <option value="deadline_asc">По сроку сдачи (ближайшие)</option>
                <option value="deadline_desc">По сроку сдачи (поздние)</option>
                <option value="name_asc">По ФИО клиента (А-Я)</option>
              </select>
            </div>
          </header>

          <div class="overflow-y-auto p-3 sm:p-4">
            <div v-if="fullColumnOrders.length === 0" class="rounded-md border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              По текущим фильтрам ничего не найдено.
            </div>

            <div v-else class="space-y-3">
              <div class="space-y-2 md:hidden">
                <article
                  v-for="order in fullColumnOrders"
                  :key="`mobile-${order.id}`"
                  class="rounded-lg border border-slate-200 p-3"
                >
                  <p class="text-sm font-semibold text-slate-900 break-all">{{ order.agreement_number }}</p>
                  <p class="mt-1 text-sm text-slate-800 break-words">{{ order.full_name }}</p>
                  <p class="mt-1 text-xs text-slate-600">Телефон: {{ order.phone }}</p>
                  <p class="mt-1 text-xs text-slate-600">Срок: {{ order.target_date }}</p>
                  <p class="mt-1 text-xs text-slate-600">Сумма: {{ formatCurrency(order.total_cost) }}</p>
                  <div class="mt-2">
                    <details class="relative inline-block">
                      <summary
                        class="inline-flex cursor-pointer list-none items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                      >
                        Действия
                        <span class="text-[10px]">▼</span>
                      </summary>
                      <div class="absolute left-0 z-10 mt-1 w-36 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                        <button
                          type="button"
                          class="block w-full rounded px-2 py-1 text-left text-xs text-primary hover:bg-blue-50"
                          @click="openOrderDetail(order.id)"
                        >
                          Детали
                        </button>
                        <button
                          type="button"
                          class="mt-1 block w-full rounded px-2 py-1 text-left text-xs text-danger hover:bg-red-50"
                          @click="askDelete(order.id)"
                        >
                          Удалить
                        </button>
                      </div>
                    </details>
                  </div>
                </article>
              </div>

              <div class="hidden overflow-visible rounded-lg border border-slate-200 md:block">
                <table class="w-full table-fixed text-sm">
                <thead class="bg-slate-100 text-slate-700">
                  <tr>
                    <th class="w-[21%] px-2 py-2 text-left">Договор</th>
                    <th class="w-[26%] px-2 py-2 text-left">Клиент</th>
                    <th class="w-[16%] px-2 py-2 text-left">Телефон</th>
                    <th class="w-[10%] px-3 py-2 text-left">Срок</th>
                    <th class="w-[12%] px-2 py-2 text-right">Сумма</th>
                    <th class="w-[12%] px-2 py-2 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                v-for="order in fullColumnOrders"
                :key="order.id"
                    class="border-b border-slate-200 last:border-0"
              >
                    <td class="px-2 py-2 align-top font-medium text-slate-900">
                      <span class="line-clamp-2 break-all" :title="order.agreement_number">{{ order.agreement_number }}</span>
                    </td>
                    <td class="px-2 py-2 align-top">
                      <span class="line-clamp-3 break-words" :title="order.full_name">{{ order.full_name }}</span>
                    </td>
                    <td class="px-2 py-2 align-top whitespace-nowrap">{{ order.phone }}</td>
                    <td class="px-3 py-2 align-top whitespace-nowrap">{{ order.target_date }}</td>
                    <td class="px-2 py-2 align-top text-right">{{ formatCurrency(order.total_cost) }}</td>
                    <td class="px-2 py-2 text-right">
                      <details class="relative inline-block text-left">
                        <summary
                          class="inline-flex cursor-pointer list-none items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                        >
                          Действия
                          <span class="text-[10px]">▼</span>
                        </summary>
                        <div class="absolute right-0 z-20 mt-1 w-36 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                          <button
                            type="button"
                            class="block w-full rounded px-2 py-1 text-left text-xs text-primary hover:bg-blue-50"
                            @click="openOrderDetail(order.id)"
                          >
                            Детали
                          </button>
                          <button
                            type="button"
                            class="mt-1 block w-full rounded px-2 py-1 text-left text-xs text-danger hover:bg-red-50"
                            @click="askDelete(order.id)"
                          >
                            Удалить
                          </button>
                        </div>
                      </details>
                    </td>
                  </tr>
                </tbody>
              </table>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Teleport>
  </section>
</template>
