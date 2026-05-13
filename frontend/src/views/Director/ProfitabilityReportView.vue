<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { fetchProfitability, type ProfitabilityRow } from "../../api/director";
import AppDataTable, { type DataTableColumn } from "../../components/Common/AppDataTable.vue";
import { isServerAvailable, SERVER_UNAVAILABLE_MESSAGE } from "../../utils/serverHealth";

const router = useRouter();

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
const profitabilityTableColumns: DataTableColumn[] = [
  { key: "agreement_number", label: "Заказ / Клиент", sortable: true },
  { key: "revenue", label: "Сумма договора", sortable: true, align: "right" },
  { key: "cogs", label: "Себестоимость", sortable: true, align: "right" },
  { key: "profit", label: "Валовая прибыль", sortable: true, align: "right" },
  { key: "margin_percent", label: "Рентабельность", sortable: true, align: "right" },
  { key: "actions", label: "Действия", align: "right", widthClass: "w-[120px]" },
];
const profitabilityTableRows = computed(() => rows.value as unknown as Record<string, unknown>[]);

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function openOrderDetail(orderId: number) {
  void router.push({ name: "director-order-detail", params: { id: String(orderId) } });
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
      <AppDataTable
        v-else
        :rows="profitabilityTableRows"
        :columns="profitabilityTableColumns"
        row-key="order_id"
        initial-sort-key="profit"
        initial-sort-order="desc"
      >
        <template #cell-agreement_number="{ row }">
          <div class="font-medium">{{ row.agreement_number }}</div>
          <div class="text-xs text-slate-500">{{ row.client_name }}</div>
        </template>
        <template #cell-revenue="{ row }">{{ formatCurrency(Number(row.revenue)) }}</template>
        <template #cell-cogs="{ row }">{{ formatCurrency(Number(row.cogs)) }}</template>
        <template #cell-profit="{ row }">
          <span class="font-semibold">{{ formatCurrency(Number(row.profit)) }}</span>
        </template>
        <template #cell-margin_percent="{ row }">{{ Number(row.margin_percent).toFixed(2) }}%</template>
        <template #cell-actions="{ row }">
          <button
            type="button"
            class="rounded-md border border-primary px-3 py-1.5 text-xs text-primary hover:bg-blue-50"
            @click="openOrderDetail(Number(row.order_id))"
          >
            Карточка
          </button>
        </template>
      </AppDataTable>
    </section>
  </section>
</template>
