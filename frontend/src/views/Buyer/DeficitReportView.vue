<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { fetchDeficitReport, type DeficitItem } from "../../api/inventory";
import AppDataTable, { type DataTableColumn } from "../../components/Common/AppDataTable.vue";
import { showSuccess, showWarning } from "../../utils/notification";
import { isServerAvailable, SERVER_UNAVAILABLE_MESSAGE } from "../../utils/serverHealth";

const rows = ref<DeficitItem[]>([]);
const isLoading = ref(false);
const isRefreshing = ref(false);
const loadError = ref("");
const includeReserves = ref(false);
const purchaseQtyById = ref<Record<number, number>>({});

watch(
  rows,
  (list) => {
    const next: Record<number, number> = {};
    for (const item of list) {
      const id = Number(item.id);
      next[id] = Number(item.suggested_qty ?? Math.abs(Number(item.physical_stock)));
    }
    purchaseQtyById.value = next;
  },
  { deep: true },
);

watch(includeReserves, () => {
  void loadDeficitReport({ soft: true });
});

const displayRows = computed(() =>
  rows.value.map((item) => {
    const id = Number(item.id);
    const suggested = Number(item.suggested_qty ?? Math.abs(Number(item.physical_stock)));
    const qty = purchaseQtyById.value[id] ?? suggested;
    const base = Number(item.base_cost);
    return {
      ...item,
      purchase_qty: qty,
      budget: qty * base,
    };
  }),
);

const totalBudget = computed(() => displayRows.value.reduce((sum, row) => sum + row.budget, 0));

const deficitTableColumns: DataTableColumn[] = [
  { key: "article", label: "Артикул", sortable: true },
  { key: "name", label: "Наименование", sortable: true },
  { key: "purchase_qty", label: "К закупке", sortable: true, align: "right", widthClass: "w-32" },
  { key: "base_cost", label: "Цена закупки", sortable: true, align: "right" },
  { key: "budget", label: "Сумма", sortable: true, align: "right" },
];

const deficitTableRows = computed(() => displayRows.value as unknown as Record<string, unknown>[]);

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function onPurchaseQtyInput(materialId: number, event: Event) {
  const raw = (event.target as HTMLInputElement).value;
  const normalized = raw.trim().replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) {
    return;
  }
  purchaseQtyById.value = { ...purchaseQtyById.value, [materialId]: n };
}

async function loadDeficitReport(options?: { soft?: boolean }) {
  const soft = Boolean(options?.soft);
  if (soft) {
    isRefreshing.value = true;
  } else {
    isLoading.value = true;
  }
  loadError.value = "";
  if (!(await isServerAvailable())) {
    rows.value = [];
    loadError.value = SERVER_UNAVAILABLE_MESSAGE;
    if (soft) {
      isRefreshing.value = false;
    } else {
      isLoading.value = false;
    }
    return;
  }
  try {
    const response = await fetchDeficitReport({ include_reserves: includeReserves.value });
    rows.value = response.data;
  } catch {
    rows.value = [];
    loadError.value = "Не удалось загрузить отчет о дефиците.";
  } finally {
    if (soft) {
      isRefreshing.value = false;
    } else {
      isLoading.value = false;
    }
  }
}

function exportRequest() {
  if (displayRows.value.length === 0) {
    showWarning("Нет дефицитных позиций для формирования заявки.");
    return;
  }

  const csvRows = [
    ["Артикул", "Наименование", "К закупке", "Цена закупки", "Сумма"],
    ...displayRows.value.map((row) => [
      row.article,
      row.name,
      Number(row.purchase_qty).toFixed(3),
      Number(row.base_cost).toFixed(2),
      row.budget.toFixed(2),
    ]),
  ];
  const csvContent = csvRows.map((line) => line.join(";")).join("\n");
  const blob = new window.Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "deficit-report.csv";
  document.body.append(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
  showSuccess("Заявка сформирована. Файл отчета загружен.");
}

onMounted(() => {
  void loadDeficitReport({ soft: false });
});
</script>

<template>
  <section class="space-y-4">
    <header class="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
      <h1 class="text-xl font-semibold text-slate-900">Отчет о дефиците материалов</h1>
      <p class="text-sm text-slate-500">Позиции с нехваткой для формирования закупки.</p>
    </header>

    <section class="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
      <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            v-model="includeReserves"
            type="checkbox"
            class="h-4 w-4 shrink-0 rounded border-slate-300 text-slate-800 focus:ring-slate-500"
          />
          <span>Учитывать резервы</span>
        </label>
        <button
          type="button"
          class="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          :disabled="isLoading || isRefreshing"
          @click="loadDeficitReport({ soft: rows.length > 0 })"
        >
          Обновить
        </button>
      </div>

      <div class="mb-4 flex items-center justify-between">
        <p class="text-sm text-slate-600">Общий бюджет</p>
        <p class="text-lg font-bold text-slate-900">{{ formatCurrency(totalBudget) }}</p>
      </div>

      <div v-if="isLoading" class="rounded-md bg-slate-50 p-6 text-sm text-slate-500">Загрузка отчета...</div>
      <div v-else-if="loadError" class="rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {{ loadError }}
      </div>
      <div v-else>
        <div v-if="isRefreshing" class="mb-3 text-xs text-slate-500">Обновление отчёта…</div>
        <div
          v-if="displayRows.length === 0"
          class="rounded-md border border-green-200 bg-green-50 p-6 text-sm text-green-700"
        >
          Все материалы в наличии. Дефицита нет!
        </div>
        <AppDataTable
          v-else
          :rows="deficitTableRows"
          :columns="deficitTableColumns"
          row-key="id"
          initial-sort-key="purchase_qty"
          initial-sort-order="desc"
        >
          <template #cell-purchase_qty="{ row }">
            <input
              type="number"
              min="0"
              step="0.001"
              class="w-full max-w-[7rem] rounded border border-slate-300 px-2 py-1 text-right text-sm tabular-nums focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400"
              :value="Number(row.purchase_qty)"
              @input="onPurchaseQtyInput(Number(row.id), $event)"
            />
          </template>
          <template #cell-base_cost="{ row }">
            {{ formatCurrency(Number(row.base_cost)) }}
          </template>
          <template #cell-budget="{ row }">
            <span class="font-semibold">{{ formatCurrency(Number(row.budget)) }}</span>
          </template>
        </AppDataTable>
      </div>

      <button
        type="button"
        class="mt-4 rounded-md border border-slate-400 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
        @click="exportRequest"
      >
        Сформировать заявку / Экспорт в CSV
      </button>
    </section>
  </section>
</template>
