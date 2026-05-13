import { computed, ref } from "vue";
import { createOrder, deleteOrder, fetchOrders, type OrderDto, updateOrder, updateOrderStatus } from "../api/orders";
import type { Order, OrderFormPayload, OrderStatus } from "../types/order";
import { useAuthStore } from "./auth";

const orders = ref<Order[]>([]);
const initialized = ref(false);

function mapStageToStatus(stage: string): OrderStatus {
  if (stage === "Новый") return "new";
  if (
    stage === "В производстве" ||
    stage === "Распил" ||
    stage === "Кромление" ||
    stage === "Присадка" ||
    stage === "Сборка"
  ) {
    return "in_production";
  }
  if (stage === "Готов к отгрузке") return "ready_to_ship";
  if (stage === "Завершен" || stage === "done") return "completed";
  return "new";
}

function mapStatusToStage(status: OrderStatus): string {
  if (status === "in_production") return "В производстве";
  if (status === "ready_to_ship") return "Готов к отгрузке";
  if (status === "completed") return "Завершен";
  return "Новый";
}

function parseTruthyFlag(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0 && Number.isFinite(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    return trimmed === "1" || trimmed === "true";
  }
  return Boolean(value);
}

function toOrderModel(dto: OrderDto): Order {
  const tasksTotalCount = Number(dto.tasks_total_count ?? 0);
  const tasksStartedCount = Number(dto.tasks_started_count ?? 0);
  const tasksCompletedCount = Number(dto.tasks_completed_count ?? 0);

  return {
    id: dto.id,
    agreement_number: dto.agreement_number,
    client_id: String(dto.client_id),
    manager_ext_id: dto.manager_ext_id,
    full_name: dto.full_name,
    phone: dto.phone ?? "",
    email: dto.email ?? "",
    address: dto.address ?? "",
    status: mapStageToStatus(dto.current_stage),
    production_stage: dto.production_stage,
    has_specification: parseTruthyFlag(dto.has_specification),
    tasks_total_count: Number.isNaN(tasksTotalCount) ? 0 : tasksTotalCount,
    tasks_started_count: Number.isNaN(tasksStartedCount) ? 0 : tasksStartedCount,
    tasks_completed_count: Number.isNaN(tasksCompletedCount) ? 0 : tasksCompletedCount,
    target_date: dto.target_date ?? "",
    total_cost: dto.total_cost,
    created_at: dto.created_at,
    updated_at: dto.updated_at,
  };
}

export function useManagerOrdersStore() {
  const hasOrders = computed(() => orders.value.length > 0);
  const authStore = useAuthStore();

  async function ensureLoaded(force = false) {
    if (initialized.value && !force) {
      return;
    }
    const response = await fetchOrders();
    orders.value = response.data.map(toOrderModel);
    initialized.value = true;
  }

  async function createOrderInStore(payload: OrderFormPayload) {
    await createOrder({
      ...payload,
      manager_ext_id: authStore.userInfo?.id ?? undefined,
    });
    await ensureLoaded(true);
  }

  async function updateOrderInStore(orderId: number, payload: OrderFormPayload) {
    await updateOrder(orderId, payload);
    await ensureLoaded(true);
  }

  async function updateOrderStatusInStore(orderId: number, status: OrderStatus) {
    await updateOrderStatus(orderId, mapStatusToStage(status));
    await ensureLoaded(true);
  }

  async function deleteOrderInStore(orderId: number) {
    await deleteOrder(orderId);
    orders.value = orders.value.filter((order) => order.id !== orderId);
  }

  function findById(orderId: number) {
    return orders.value.find((order) => order.id === orderId) ?? null;
  }

  return {
    orders,
    hasOrders,
    ensureLoaded,
    createOrder: createOrderInStore,
    updateOrder: updateOrderInStore,
    updateOrderStatus: updateOrderStatusInStore,
    deleteOrder: deleteOrderInStore,
    findById,
  };
}
