<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { fetchTransactions, type TransactionItem } from "../../api/inventory";
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

async function loadTransactions() {
  isLoading.value = true;
  loadError.value = "";
  if (!(await isServerAvailable())) {
    transactions.value = [];
    loadError.value = SERVER_UNAVAILABLE_MESSAGE;
    isLoading.value = false;
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
    isLoading.value = false;
  }
}

watch([txType, orderSearch], () => {
  void loadTransactions();
});

onMounted(() => {
  void loadTransactions();
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
      <div
        v-else-if="rows.length === 0"
        class="mt-4 rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500"
      >
        По выбранным фильтрам нет транзакций.
      </div>
      <div v-else class="mt-4 overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-100 text-slate-700">
            <tr>
              <th class="px-3 py-2 text-left">Дата и время</th>
              <th class="px-3 py-2 text-left">Номенклатура</th>
              <th class="px-3 py-2 text-left">Тип действия</th>
              <th class="px-3 py-2 text-right">Изменение</th>
              <th class="px-3 py-2 text-left">Заказ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id" class="border-b border-slate-200 last:border-0">
              <td class="px-3 py-2">{{ row.tx_date }}</td>
              <td class="px-3 py-2">
                <div class="font-medium">{{ row.article }}</div>
                <div class="text-xs text-slate-500">{{ row.name }}</div>
              </td>
              <td class="px-3 py-2">{{ row.tx_type }}</td>
              <td
                class="px-3 py-2 text-right font-semibold"
                :class="Number(row.quantity_change) > 0 ? 'text-green-600' : 'text-red-600'"
              >
                {{ Number(row.quantity_change) > 0 ? "+" : "" }}{{ Number(row.quantity_change).toFixed(3) }}
              </td>
              <td class="px-3 py-2">{{ row.order_id ?? "—" }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
