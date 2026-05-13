<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import OrderFormModal from "../../components/Orders/OrderFormModal.vue";
import AppDataTable, { type DataTableColumn } from "../../components/Common/AppDataTable.vue";
import type { Order, OrderFormPayload, OrderStatus } from "../../types/order";
import { useManagerOrdersStore } from "../../stores/managerOrders";
import { formatDateTime } from "../../utils/datetime";
import { showError } from "../../utils/notification";
import { isServerAvailable, SERVER_UNAVAILABLE_MESSAGE } from "../../utils/serverHealth";

interface KanbanColumn {
  status: OrderStatus;
  title: string;
}

const columns: KanbanColumn[] = [
  { status: "new", title: "Новый" },
  { status: "in_production", title: "В производстве" },
  { status: "ready_to_ship", title: "Готов к отгрузке" },
  { status: "completed", title: "Завершен" },
];

const isLoading = ref(true);
const loadError = ref("");
const router = useRouter();
const ordersStore = useManagerOrdersStore();
const orders = ordersStore.orders;

const isModalOpen = ref(false);
const modalMode = ref<"create" | "edit">("create");
const selectedOrder = ref<Order | null>(null);
const orderIdToDelete = ref<number | null>(null);
const selectedColumnStatus = ref<OrderStatus | null>(null);
const listSearch = ref("");
const openedActionMenuOrderId = ref<number | null>(null);
const actionMenuStyle = ref({ top: "0px", left: "0px" });

const managerTableColumns: DataTableColumn[] = [
  { key: "agreement_number", label: "Договор", sortable: true, widthClass: "w-[21%]" },
  { key: "full_name", label: "Клиент", sortable: true, widthClass: "w-[26%]" },
  { key: "phone", label: "Телефон", sortable: true, widthClass: "w-[16%]" },
  { key: "target_date", label: "Срок", sortable: true, widthClass: "w-[12%]" },
  { key: "total_cost", label: "Сумма", sortable: true, align: "right", widthClass: "w-[13%]" },
  { key: "actions", label: "Действия", align: "right", widthClass: "w-[12%]" },
];

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

function formatTargetDate(value: string) {
  return formatDateTime(value);
}

function getWorkBadgeLabel(order: Order) {
  if (order.status === "completed") {
    return "Завершен";
  }
  if (order.status === "ready_to_ship") {
    return "Готов";
  }
  if (order.status === "in_production") {
    return order.production_stage || "В производстве";
  }
  if (order.status === "new") {
    return "Новый";
  }
  return "В работе";
}

function isOverdue(order: Order) {
  return (
    order.status !== "ready_to_ship" &&
    order.status !== "completed" &&
    order.target_date < new Date().toISOString().slice(0, 10)
  );
}

function isNearDeadline(order: Order) {
  if (order.status === "ready_to_ship" || order.status === "completed") {
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

  return searched;
});
const managerTableRows = computed(
  () => fullColumnOrders.value as unknown as Record<string, unknown>[]
);

async function loadOrders() {
  isLoading.value = true;
  loadError.value = "";
  if (!(await isServerAvailable())) {
    loadError.value = SERVER_UNAVAILABLE_MESSAGE;
    isLoading.value = false;
    return;
  }
  try {
    await ordersStore.ensureLoaded(true);
  } catch {
    loadError.value = "Не удалось загрузить заказы. Проверьте подключение к серверу.";
  } finally {
    isLoading.value = false;
  }
}

function openCreateModal() {
  modalMode.value = "create";
  selectedOrder.value = null;
  isModalOpen.value = true;
}

function canEditOrder(order: Order) {
  return order.status === "new";
}

function canCancelOrder(order: Order) {
  return order.status === "new";
}

function openEditModal(order: Order) {
  if (!canEditOrder(order)) {
    showError("Редактирование заказа недоступно после запуска производства.");
    return;
  }
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

function getRowTotalCost(row: Record<string, unknown>) {
  const value = row.total_cost;
  return formatCurrency(typeof value === "string" || value === null ? value : null);
}

function toOrderFromRow(row: Record<string, unknown>): Order {
  return row as unknown as Order;
}

function openColumnList(status: OrderStatus) {
  selectedColumnStatus.value = status;
  listSearch.value = "";
}

function closeColumnList() {
  selectedColumnStatus.value = null;
}

async function upsertOrder(payload: OrderFormPayload) {
  try {
    if (modalMode.value === "create") {
      await ordersStore.createOrder(payload);
      isModalOpen.value = false;
      return;
    }

    if (!selectedOrder.value) {
      return;
    }

    await ordersStore.updateOrder(selectedOrder.value.id, payload);
    isModalOpen.value = false;
  } catch {
    showError("Не удалось сохранить заказ. Проверьте доступность сервера.");
  }
}

function askDelete(orderId: number) {
  orderIdToDelete.value = orderId;
}

function cancelDelete() {
  orderIdToDelete.value = null;
}

async function confirmDelete() {
  if (orderIdToDelete.value === null) {
    return;
  }

  try {
    await ordersStore.deleteOrder(orderIdToDelete.value);
    orderIdToDelete.value = null;
  } catch (err: unknown) {
    const msg =
      err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
    showError(msg ?? "Не удалось отменить заказ. Проверьте доступность сервера.");
  }
}

function closeActionMenu() {
  openedActionMenuOrderId.value = null;
}

function toggleActionMenu(event: MouseEvent, orderId: number) {
  if (openedActionMenuOrderId.value === orderId) {
    closeActionMenu();
    return;
  }

  const trigger = event.currentTarget as HTMLElement | null;
  if (!trigger) {
    return;
  }

  const rect = trigger.getBoundingClientRect();
  actionMenuStyle.value = {
    top: `${rect.bottom + 4}px`,
    left: `${rect.right - 144}px`,
  };
  openedActionMenuOrderId.value = orderId;
}

function handleGlobalPointerDown(event: Event) {
  const target = event.target as HTMLElement | null;
  if (!target) {
    return;
  }
  if (target.closest("[data-action-menu]") || target.closest("[data-action-menu-trigger]")) {
    return;
  }
  closeActionMenu();
}

function handleViewportChange() {
  closeActionMenu();
}

const orderToDelete = computed(
  () => orders.value.find((order) => order.id === orderIdToDelete.value) ?? null
);

onMounted(() => {
  void loadOrders();
  window.addEventListener("pointerdown", handleGlobalPointerDown);
  window.addEventListener("scroll", handleViewportChange, true);
  window.addEventListener("resize", handleViewportChange);
});

onBeforeUnmount(() => {
  window.removeEventListener("pointerdown", handleGlobalPointerDown);
  window.removeEventListener("scroll", handleViewportChange, true);
  window.removeEventListener("resize", handleViewportChange);
});
</script>

<template>
  <section class="space-y-4">
    <header
      class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
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
    <div
      v-else-if="loadError"
      class="rounded-xl border border-red-200 bg-red-50 p-8 text-center text-sm text-red-700"
    >
      {{ loadError }}
    </div>

    <div
      v-else-if="orders.length === 0"
      class="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500"
    >
      У вас пока нет активных заказов.
    </div>

    <div
      v-else-if="!selectedColumnStatus"
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5"
    >
      <article
        v-for="column in columnOrders"
        :key="column.status"
        class="flex min-h-[360px] flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
      >
        <header class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-slate-900">{{ column.title }}</h2>
          <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{{
            column.orders.length
          }}</span>
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
              <p
                class="min-w-0 text-xs font-semibold text-slate-700 break-all line-clamp-2"
                :title="order.agreement_number"
              >
                {{ order.agreement_number }}
              </p>
              <span
                class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                :class="{
                  'bg-amber-100 text-amber-700': order.status === 'new' || order.status === 'in_production',
                  'bg-green-100 text-green-700': order.status === 'ready_to_ship',
                  'bg-slate-200 text-slate-700': order.status === 'completed',
                }"
              >
                {{ getWorkBadgeLabel(order) }}
              </span>
            </div>

            <p
              class="text-sm font-medium text-slate-900 break-words line-clamp-2"
              :title="order.full_name"
            >
              {{ order.full_name }}
            </p>
            <p class="mt-1 text-xs text-slate-600">
              Сдать до: {{ formatTargetDate(order.target_date) }}
            </p>
            <p class="mt-1 text-xs text-slate-600">Сумма: {{ formatCurrency(order.total_cost) }}</p>

            <div class="mt-3 flex flex-col gap-2">
              <button
                type="button"
                class="flex w-full min-h-[2.25rem] items-center justify-center rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-1"
                @click="openOrderDetail(order.id)"
              >
                Детали
              </button>
              <div class="flex gap-2">
                <button
                  v-if="canEditOrder(order)"
                  type="button"
                  class="flex min-h-[2.25rem] min-w-0 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-medium text-slate-800 transition hover:border-slate-300 hover:bg-slate-100 focus-visible:outline focus-visible:ring-2 focus-visible:ring-slate-300/60 focus-visible:ring-offset-1"
                  @click="openEditModal(order)"
                >
                  Редактировать
                </button>
                <button
                  v-if="canCancelOrder(order)"
                  type="button"
                  class="flex min-h-[2.25rem] min-w-0 flex-1 items-center justify-center rounded-lg px-2 py-2 text-xs font-medium text-danger transition hover:bg-red-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-danger/30 focus-visible:ring-offset-1"
                  @click="askDelete(order.id)"
                >
                  Отменить
                </button>
              </div>
            </div>
          </div>

          <p
            v-if="column.orders.length === 0"
            class="rounded-md border border-dashed border-slate-200 p-3 text-xs text-slate-400"
          >
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

    <section
      v-else
      class="flex max-h-[85vh] w-full flex-col rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <header class="border-b border-slate-200 p-4 sm:p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="text-lg font-semibold text-slate-900">Все заказы: {{ columnListTitle }}</h3>
            <p class="mt-1 text-sm text-slate-500">Найдено: {{ fullColumnOrders.length }}</p>
          </div>
          <button
            type="button"
            class="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
            @click="closeColumnList"
          >
            Назад к канбану
          </button>
        </div>

        <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input
            v-model="listSearch"
            type="text"
            placeholder="Поиск по договору, ФИО, телефону"
            class="rounded-md border-slate-300 text-sm focus:border-primary focus:ring-primary xl:col-span-3"
          />
          <p class="text-sm text-slate-600 xl:justify-self-end xl:self-center">
            Найдено: {{ fullColumnOrders.length }}
          </p>
        </div>
      </header>

      <div class="overflow-y-auto p-3 sm:p-4">
        <div
          v-if="fullColumnOrders.length === 0"
          class="rounded-md border border-dashed border-slate-200 p-4 text-sm text-slate-500"
        >
          По текущим фильтрам ничего не найдено.
        </div>

        <div v-else class="space-y-3">
          <div class="space-y-2 md:hidden">
            <article
              v-for="order in fullColumnOrders"
              :key="`mobile-${order.id}`"
              class="rounded-lg border border-slate-200 p-3"
            >
              <p class="text-sm font-semibold text-slate-900 break-all">
                {{ order.agreement_number }}
              </p>
              <p class="mt-1 text-sm text-slate-800 break-words">{{ order.full_name }}</p>
              <p class="mt-1 text-xs text-slate-600">Телефон: {{ order.phone }}</p>
              <p class="mt-1 text-xs text-slate-600">
                Срок: {{ formatTargetDate(order.target_date) }}
              </p>
              <p class="mt-1 text-xs text-slate-600">
                Сумма: {{ formatCurrency(order.total_cost) }}
              </p>
              <div class="mt-2">
                <details class="relative inline-block">
                  <summary
                    class="inline-flex cursor-pointer list-none items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    Действия
                    <span class="text-[10px]">▼</span>
                  </summary>
                  <div
                    class="absolute left-0 z-10 mt-1 w-36 rounded-md border border-slate-200 bg-white p-1 shadow-lg"
                  >
                    <button
                      type="button"
                      class="block w-full rounded-md px-2 py-2 text-left text-xs font-medium text-primary hover:bg-blue-50"
                      @click="openOrderDetail(order.id)"
                    >
                      Детали
                    </button>
                    <button
                      v-if="canCancelOrder(order)"
                      type="button"
                      class="mt-0.5 block w-full rounded-md px-2 py-2 text-left text-xs font-medium text-danger hover:bg-red-50"
                      @click="askDelete(order.id)"
                    >
                      Отменить
                    </button>
                  </div>
                </details>
              </div>
            </article>
          </div>

          <AppDataTable
            class="hidden md:block"
            :rows="managerTableRows"
            :columns="managerTableColumns"
            row-key="id"
            initial-sort-key="target_date"
            initial-sort-order="asc"
          >
            <template #cell-agreement_number="{ row }">
              <span class="line-clamp-2 break-all" :title="String(row.agreement_number)">
                {{ row.agreement_number }}
              </span>
            </template>
            <template #cell-full_name="{ row }">
              <span class="line-clamp-3 break-words" :title="String(row.full_name)">
                {{ row.full_name }}
              </span>
            </template>
            <template #cell-target_date="{ row }">
              <span class="whitespace-nowrap">{{ formatTargetDate(String(row.target_date)) }}</span>
            </template>
            <template #cell-total_cost="{ row }">
              <span class="whitespace-nowrap">{{ getRowTotalCost(row) }}</span>
            </template>
            <template #cell-actions="{ row }">
              <button
                type="button"
                data-action-menu-trigger
                class="inline-flex cursor-pointer list-none items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                @click="toggleActionMenu($event, Number(row.id))"
              >
                Действия
                <span class="text-[10px]">▼</span>
              </button>
              <Teleport to="body">
                <div
                  v-if="openedActionMenuOrderId === Number(row.id)"
                  data-action-menu
                  class="fixed z-[130] w-36 rounded-md border border-slate-200 bg-white p-1 shadow-lg"
                  :style="actionMenuStyle"
                >
                  <button
                    type="button"
                    class="block w-full rounded-md px-2 py-2 text-left text-xs font-medium text-primary hover:bg-blue-50"
                    @click="openOrderDetail(Number(row.id)); closeActionMenu()"
                  >
                    Детали
                  </button>
                  <button
                    type="button"
                    class="mt-0.5 block w-full rounded-md px-2 py-2 text-left text-xs font-medium text-slate-800 hover:bg-slate-100"
                    @click="openEditModal(toOrderFromRow(row)); closeActionMenu()"
                  >
                    Редактировать
                  </button>
                  <button
                    v-if="canCancelOrder(toOrderFromRow(row))"
                    type="button"
                    class="mt-0.5 block w-full rounded-md px-2 py-2 text-left text-xs font-medium text-danger hover:bg-red-50"
                    @click="askDelete(Number(row.id)); closeActionMenu()"
                  >
                    Отменить
                  </button>
                </div>
              </Teleport>
            </template>
          </AppDataTable>
        </div>
      </div>
    </section>

    <OrderFormModal
      :is-open="isModalOpen"
      :mode="modalMode"
      :initial-data="selectedOrder"
      @close="closeModal"
      @submit="upsertOrder"
    />

    <Teleport to="body">
      <div
        v-if="orderToDelete"
        class="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 p-4"
      >
        <section class="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
          <h3 class="text-lg font-semibold text-slate-900">Подтвердите отмену</h3>
          <p class="mt-2 text-sm text-slate-600">
            Отменить заказ {{ orderToDelete.agreement_number }}? Данные по заказу будут удалены без
            возможности восстановления.
          </p>
          <div class="mt-4 flex justify-end gap-2">
            <button
              type="button"
              class="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              @click="cancelDelete"
            >
              Назад
            </button>
            <button
              type="button"
              class="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              @click="confirmDelete"
            >
              Отменить
            </button>
          </div>
        </section>
      </div>
    </Teleport>

  </section>
</template>
