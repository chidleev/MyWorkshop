<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchProfitability, type ProfitabilityRow } from "../../api/director";
import { isServerAvailable, SERVER_UNAVAILABLE_MESSAGE } from "../../utils/serverHealth";

const isLoading = ref(false);
const rows = ref<ProfitabilityRow[]>([]);
const loadError = ref("");

const totals = computed(() => {
  const revenue = rows.value.reduce((sum, row) => sum + Number(row.revenue), 0);
  const cogs = rows.value.reduce((sum, row) => sum + Number(row.cogs), 0);
  const averageMargin =
    rows.value.length > 0
      ? rows.value.reduce((sum, row) => sum + Number(row.margin_percent), 0) / rows.value.length
      : 0;
  return { revenue, cogs, averageMargin };
});

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

async function loadProfitability() {
  isLoading.value = true;
  loadError.value = "";
  if (!(await isServerAvailable())) {
    loadError.value = SERVER_UNAVAILABLE_MESSAGE;
    isLoading.value = false;
    return;
  }
  try {
    const response = await fetchProfitability();
    rows.value = response.data;
  } catch {
    rows.value = [];
    loadError.value = "Не удалось загрузить отчет по рентабельности.";
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  void loadProfitability();
});
</script>

<template>
  <section class="space-y-4">
    <header class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h1 class="text-xl font-semibold text-slate-900">Отчет по рентабельности</h1>
      <p class="text-sm text-slate-500">Финансовые показатели по закрытым сделкам.</p>
    </header>

    <section class="grid gap-3 md:grid-cols-3">
      <article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p class="text-sm text-slate-500">Общая выручка</p>
        <p class="mt-1 text-lg font-bold text-slate-900">{{ formatCurrency(totals.revenue) }}</p>
      </article>
      <article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p class="text-sm text-slate-500">Общая себестоимость</p>
        <p class="mt-1 text-lg font-bold text-slate-900">{{ formatCurrency(totals.cogs) }}</p>
      </article>
      <article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p class="text-sm text-slate-500">Средняя маржинальность</p>
        <p class="mt-1 text-lg font-bold text-slate-900">{{ totals.averageMargin.toFixed(2) }}%</p>
      </article>
    </section>

    <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div v-if="isLoading" class="text-sm text-slate-500">Загрузка отчета...</div>
      <div v-else-if="loadError" class="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {{ loadError }}
      </div>
      <div v-else class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-100 text-slate-700">
            <tr>
              <th class="px-3 py-2 text-left">Заказ / Клиент</th>
              <th class="px-3 py-2 text-right">Сумма договора</th>
              <th class="px-3 py-2 text-right">Себестоимость</th>
              <th class="px-3 py-2 text-right">Валовая прибыль</th>
              <th class="px-3 py-2 text-right">Рентабельность</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.order_id" class="border-b border-slate-200 last:border-0">
              <td class="px-3 py-2">
                <div class="font-medium">{{ row.agreement_number }}</div>
                <div class="text-xs text-slate-500">{{ row.client_name }}</div>
              </td>
              <td class="px-3 py-2 text-right">{{ formatCurrency(Number(row.revenue)) }}</td>
              <td class="px-3 py-2 text-right">{{ formatCurrency(Number(row.cogs)) }}</td>
              <td class="px-3 py-2 text-right font-semibold">{{ formatCurrency(Number(row.profit)) }}</td>
              <td class="px-3 py-2 text-right">{{ Number(row.margin_percent).toFixed(2) }}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
