import { computed, ref } from "vue";
import { createOrder, deleteOrder, fetchOrders, type OrderDto, updateOrder, updateOrderStatus } from "../api/orders";
import type { Order, OrderFormPayload, OrderStatus } from "../types/order";

const orders = ref<Order[]>([]);
const initialized = ref(false);

function mapStageToStatus(stage: string): OrderStatus {
  if (stage === "Распил") return "cutting";
  if (stage === "Кромление") return "edging";
  if (stage === "Сборка") return "assembly";
  if (stage === "Готов к отгрузке" || stage === "Завершен") return "ready_to_ship";
  return "new";
}

function mapStatusToStage(status: OrderStatus): string {
  if (status === "cutting") return "Распил";
  if (status === "edging") return "Кромление";
  if (status === "assembly") return "Сборка";
  if (status === "ready_to_ship") return "Готов к отгрузке";
  return "Новый";
}

function toOrderModel(dto: OrderDto): Order {
  return {
    id: dto.id,
    agreement_number: dto.agreement_number,
    client_id: String(dto.client_id),
    manager_ext_id: dto.manager_ext_id,
    full_name: dto.full_name,
    phone: dto.phone,
    email: "",
    address: "",
    status: mapStageToStatus(dto.current_stage),
    target_date: dto.target_date?.slice(0, 10) ?? "",
    total_cost: dto.total_cost,
    created_at: dto.created_at,
    updated_at: dto.updated_at,
  };
}

export function useManagerOrdersStore() {
  const hasOrders = computed(() => orders.value.length > 0);

  async function ensureLoaded(force = false) {
    if (initialized.value && !force) {
      return;
    }
    const response = await fetchOrders();
    orders.value = response.data.map(toOrderModel);
    initialized.value = true;
  }

  async function createOrderInStore(payload: OrderFormPayload) {
    await createOrder(payload);
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
