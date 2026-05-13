<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { fetchTransactions, type TransactionItem } from "../../api/inventory";
import AppDataTable, { type DataTableColumn } from "../../components/Common/AppDataTable.vue";
import {
  isServerAvailable,
  isServerUnavailableError,
  SERVER_UNAVAILABLE_MESSAGE,
  withRequestTimeout,
} from "../../utils/serverHealth";

const txType = ref<"Все" | "Приход" | "Резерв" | "Списание">("Все");
const orderSearch = ref("");
const transactions = ref<TransactionItem[]>([]);
const isLoading = ref(false);
const isRefreshing = ref(false);
const loadError = ref("");

const rows = computed(() => {
  return transactions.value
    .filter((row) => (txType.value === "Все" ? true : row.tx_type === txType.value))
    .filter((row) =>
      orderSearch.value.trim().length > 0
        ? (row.order_id ?? "").toLowerCase().includes(orderSearch.value.trim().toLowerCase())
        : true
    );
});
const transactionTableColumns: DataTableColumn[] = [
  { key: "tx_date", label: "Дата и время", sortable: true },
  { key: "article", label: "Номенклатура", sortable: true },
  { key: "tx_type", label: "Тип действия", sortable: true },
  { key: "quantity_change", label: "Изменение", sortable: true, align: "right" },
  { key: "order_id", label: "Заказ", sortable: true },
];
const transactionTableRows = computed(() => rows.value as unknown as Record<string, unknown>[]);

async function loadTransactions(options?: { soft?: boolean }) {
  const soft = Boolean(options?.soft);
  if (soft) {
    isRefreshing.value = true;
  } else {
    isLoading.value = true;
  }
  loadError.value = "";
  if (!(await isServerAvailable())) {
    transactions.value = [];
    loadError.value = SERVER_UNAVAILABLE_MESSAGE;
    if (soft) {
      isRefreshing.value = false;
    } else {
      isLoading.value = false;
    }
    return;
  }
  try {
    const response = await withRequestTimeout(
      fetchTransactions({
        tx_type: txType.value === "Все" ? undefined : txType.value,
        order_id: orderSearch.value.trim() || undefined,
      })
    );
    transactions.value = response?.data || [];
  } catch (error) {
    transactions.value = [];
    loadError.value = isServerUnavailableError(error)
      ? SERVER_UNAVAILABLE_MESSAGE
      : "Не удалось загрузить журнал транзакций.";
  } finally {
    if (soft) {
      isRefreshing.value = false;
    } else {
      isLoading.value = false;
    }
  }
}

watch([txType, orderSearch], () => {
  void loadTransactions({ soft: true });
});

onMounted(() => {
  void loadTransactions({ soft: false });
});
</script>

<template>
  <section class="space-y-4">
    <header class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h1 class="text-xl font-semibold text-slate-900">История транзакций</h1>
      <p class="text-sm text-slate-500">Журнал резервов, списаний и приходов материалов.</p>
    </header>

    <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="grid gap-3 md:grid-cols-2">
        <select v-model="txType" class="rounded-md border-slate-300 text-sm focus:border-primary focus:ring-primary">
          <option value="Все">Все типы операций</option>
          <option value="Приход">Только приходы</option>
          <option value="Резерв">Только резервы</option>
          <option value="Списание">Только списания</option>
        </select>
        <input
          v-model="orderSearch"
          type="search"
          placeholder="Поиск по номеру заказа"
          class="rounded-md border-slate-300 text-sm focus:border-primary focus:ring-primary"
        />
      </div>

      <div v-if="isLoading" class="mt-4 text-sm text-slate-500">Загрузка журнала...</div>
      <div v-else-if="loadError" class="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {{ loadError }}
      </div>
      <div v-else>
        <div v-if="isRefreshing" class="mt-4 text-xs text-slate-500">Обновление журнала…</div>
        <div
          v-if="rows.length === 0"
          class="mt-4 rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500"
        >
          По выбранным фильтрам нет транзакций.
        </div>
        <AppDataTable
          v-else
          class="mt-4"
          :rows="transactionTableRows"
          :columns="transactionTableColumns"
          row-key="id"
          initial-sort-key="tx_date"
          initial-sort-order="desc"
        >
          <template #cell-article="{ row }">
            <div class="font-medium">{{ row.article }}</div>
            <div class="text-xs text-slate-500">{{ row.name }}</div>
          </template>
          <template #cell-quantity_change="{ row }">
            <span
              class="font-semibold"
              :class="Number(row.quantity_change) > 0 ? 'text-green-600' : 'text-red-600'"
            >
              {{ Number(row.quantity_change) > 0 ? "+" : "" }}{{ Number(row.quantity_change).toFixed(3) }}
            </span>
          </template>
          <template #cell-order_id="{ row }">
            {{ row.order_id ?? "—" }}
          </template>
        </AppDataTable>
      </div>
    </section>
  </section>
</template>
