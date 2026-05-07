import { computed, ref } from "vue";
import type { Order, OrderFormPayload, OrderStatus } from "../types/order";

const orders = ref<Order[]>([]);
const initialized = ref(false);

function nowIso() {
  return new Date().toISOString();
}

function futureDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function createMockOrders(): Order[] {
  return [
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
      updated_at: nowIso()
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
      updated_at: nowIso()
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
      updated_at: nowIso()
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
      updated_at: nowIso()
    }
  ];
}

export function useManagerOrdersStore() {
  const hasOrders = computed(() => orders.value.length > 0);

  function ensureLoaded() {
    if (initialized.value) {
      return;
    }
    orders.value = createMockOrders();
    initialized.value = true;
  }

  function createOrder(payload: OrderFormPayload) {
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
      ...payload
    };
    orders.value = [newOrder, ...orders.value];
  }

  function updateOrder(orderId: number, payload: OrderFormPayload) {
    orders.value = orders.value.map((order) =>
      order.id === orderId
        ? {
            ...order,
            ...payload,
            updated_at: nowIso()
          }
        : order
    );
  }

  function updateOrderStatus(orderId: number, status: OrderStatus) {
    orders.value = orders.value.map((order) =>
      order.id === orderId
        ? {
            ...order,
            status,
            updated_at: nowIso()
          }
        : order
    );
  }

  function deleteOrder(orderId: number) {
    orders.value = orders.value.filter((order) => order.id !== orderId);
  }

  function findById(orderId: number) {
    return orders.value.find((order) => order.id === orderId) ?? null;
  }

  return {
    orders,
    hasOrders,
    ensureLoaded,
    createOrder,
    updateOrder,
    updateOrderStatus,
    deleteOrder,
    findById
  };
}
