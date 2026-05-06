import { computed, ref } from "vue";
import { defineStore } from "pinia";

export interface MaterialItem {
  article: string;
  name: string;
  current_stock: number;
  base_cost: number;
  unit: "шт" | "м2" | "м.п.";
}

export interface InventoryTransaction {
  id: number;
  tx_date: string;
  article: string;
  tx_type: "Приход" | "Резерв" | "Списание";
  quantity_change: number;
  order_id: string | null;
}

export interface ProjectOrder {
  id: number;
  agreement_number: string;
  client_name: string;
  manager_ext_id: string;
  manager_name: string;
  status: "В обработке" | "В производстве" | "Монтаж" | "Завершен";
  target_date: string;
  total_cost: number;
}

export interface OrderSpecLine {
  order_id: number;
  article: string;
  required_quantity: number;
}

export interface ShiftTask {
  id: number;
  operation_name: "Распил" | "Кромление" | "Присадка" | "Сборка";
  status: "Ожидают" | "В работе" | "Завершены";
}

const initialMaterials: MaterialItem[] = [
  { article: "DSP-16-WHITE", name: "ЛДСП белый 16 мм", current_stock: 12.35, base_cost: 1850, unit: "м2" },
  { article: "EDGE-PVC-2", name: "Кромка ПВХ 2 мм", current_stock: -4.5, base_cost: 38.5, unit: "м.п." },
  { article: "HINGE-BLUM", name: "Петля Blum Clip-Top", current_stock: 0, base_cost: 250, unit: "шт" },
  { article: "SCREW-3X16", name: "Саморез 3x16", current_stock: -120, base_cost: 1.8, unit: "шт" },
  { article: "RAIL-500", name: "Направляющая 500 мм", current_stock: 26, base_cost: 390, unit: "шт" },
];

const initialTransactions: InventoryTransaction[] = [
  {
    id: 1,
    tx_date: "2026-05-05 09:10",
    article: "EDGE-PVC-2",
    tx_type: "Резерв",
    quantity_change: -8,
    order_id: "MM-2026-012",
  },
  {
    id: 2,
    tx_date: "2026-05-05 13:20",
    article: "HINGE-BLUM",
    tx_type: "Списание",
    quantity_change: -12,
    order_id: "MM-2026-010",
  },
  {
    id: 3,
    tx_date: "2026-05-06 11:45",
    article: "RAIL-500",
    tx_type: "Приход",
    quantity_change: 30,
    order_id: null,
  },
];

const initialProjectOrders: ProjectOrder[] = [
  {
    id: 10,
    agreement_number: "MM-2026-010",
    client_name: "Крылов Денис",
    manager_ext_id: "crm-manager-001",
    manager_name: "Иванова Мария",
    status: "Завершен",
    target_date: "2026-05-01",
    total_cost: 219900,
  },
  {
    id: 12,
    agreement_number: "MM-2026-012",
    client_name: "Савельева Анна",
    manager_ext_id: "crm-manager-002",
    manager_name: "Павлов Артем",
    status: "В производстве",
    target_date: "2026-05-04",
    total_cost: 128500,
  },
  {
    id: 15,
    agreement_number: "MM-2026-015",
    client_name: "Кузнецов Алексей",
    manager_ext_id: "crm-manager-001",
    manager_name: "Иванова Мария",
    status: "Монтаж",
    target_date: "2026-05-08",
    total_cost: 156000,
  },
  {
    id: 16,
    agreement_number: "MM-2026-016",
    client_name: "Семенова Ирина",
    manager_ext_id: "crm-manager-003",
    manager_name: "Петров Илья",
    status: "Завершен",
    target_date: "2026-05-02",
    total_cost: 188000,
  },
];

const initialSpecifications: OrderSpecLine[] = [
  { order_id: 10, article: "DSP-16-WHITE", required_quantity: 6.5 },
  { order_id: 10, article: "HINGE-BLUM", required_quantity: 12 },
  { order_id: 16, article: "DSP-16-WHITE", required_quantity: 5.2 },
  { order_id: 16, article: "EDGE-PVC-2", required_quantity: 38 },
];

const initialTasks: ShiftTask[] = [
  { id: 1, operation_name: "Распил", status: "Ожидают" },
  { id: 2, operation_name: "Распил", status: "В работе" },
  { id: 3, operation_name: "Распил", status: "Ожидают" },
  { id: 4, operation_name: "Кромление", status: "Ожидают" },
  { id: 5, operation_name: "Кромление", status: "Завершены" },
  { id: 6, operation_name: "Присадка", status: "В работе" },
  { id: 7, operation_name: "Присадка", status: "Ожидают" },
  { id: 8, operation_name: "Сборка", status: "Ожидают" },
  { id: 9, operation_name: "Сборка", status: "Ожидают" },
  { id: 10, operation_name: "Сборка", status: "Завершены" },
];

export const useWorkshopDataStore = defineStore("workshop-data", () => {
  const materials = ref<MaterialItem[]>(structuredClone(initialMaterials));
  const transactions = ref<InventoryTransaction[]>(structuredClone(initialTransactions));
  const projectOrders = ref<ProjectOrder[]>(structuredClone(initialProjectOrders));
  const specifications = ref<OrderSpecLine[]>(structuredClone(initialSpecifications));
  const tasks = ref<ShiftTask[]>(structuredClone(initialTasks));

  const deficitMaterials = computed(() => materials.value.filter((item) => item.current_stock < 0));

  const operationLoad = computed(() => {
    const operations = ["Распил", "Кромление", "Присадка", "Сборка"] as const;
    return operations.map((operation) => {
      const operationTasks = tasks.value.filter((task) => task.operation_name === operation);
      const total = operationTasks.length || 1;
      const pending = operationTasks.filter((task) => task.status === "Ожидают").length;
      const inProgress = operationTasks.filter((task) => task.status === "В работе").length;
      const completed = operationTasks.filter((task) => task.status === "Завершены").length;
      return {
        operation,
        pending,
        inProgress,
        completed,
        pendingPercent: Math.round((pending / total) * 100),
        inProgressPercent: Math.round((inProgress / total) * 100),
        completedPercent: Math.round((completed / total) * 100),
      };
    });
  });

  const profitabilityRows = computed(() => {
    return projectOrders.value
      .filter((order) => order.status === "Завершен")
      .map((order) => {
        const cogs = specifications.value
          .filter((line) => line.order_id === order.id)
          .reduce((sum, line) => {
            const material = materials.value.find((item) => item.article === line.article);
            if (!material) {
              return sum;
            }
            return sum + material.base_cost * line.required_quantity;
          }, 0);

        const grossProfit = order.total_cost - cogs;
        const margin = order.total_cost > 0 ? (grossProfit / order.total_cost) * 100 : 0;
        return {
          ...order,
          cogs,
          grossProfit,
          margin,
        };
      });
  });

  const profitabilityTotals = computed(() => {
    const revenue = profitabilityRows.value.reduce((sum, row) => sum + row.total_cost, 0);
    const cogs = profitabilityRows.value.reduce((sum, row) => sum + row.cogs, 0);
    const averageMargin =
      profitabilityRows.value.length > 0
        ? profitabilityRows.value.reduce((sum, row) => sum + row.margin, 0) / profitabilityRows.value.length
        : 0;
    return { revenue, cogs, averageMargin };
  });

  function addIncomingStock(article: string, quantity: number) {
    const material = materials.value.find((item) => item.article === article);
    if (!material) {
      return;
    }

    material.current_stock += quantity;
    transactions.value = [
      {
        id: Date.now(),
        tx_date: new Date().toISOString().slice(0, 16).replace("T", " "),
        article,
        tx_type: "Приход",
        quantity_change: quantity,
        order_id: null,
      },
      ...transactions.value,
    ];
  }

  return {
    materials,
    transactions,
    projectOrders,
    specifications,
    tasks,
    deficitMaterials,
    operationLoad,
    profitabilityRows,
    profitabilityTotals,
    addIncomingStock,
  };
});
