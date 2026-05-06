<script setup lang="ts">
import { computed } from "vue";
import { useWorkshopDataStore } from "../../stores/workshopData";
import { showSuccess, showWarning } from "../../utils/notification";

const workshopStore = useWorkshopDataStore();

const rows = computed(() =>
  workshopStore.deficitMaterials.map((item) => {
    const required = Math.abs(item.current_stock);
    return {
      ...item,
      required,
      budget: required * item.base_cost,
    };
  })
);

const totalBudget = computed(() => rows.value.reduce((sum, row) => sum + row.budget, 0));

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function exportRequest() {
  if (rows.value.length === 0) {
    showWarning("Нет дефицитных позиций для формирования заявки.");
    return;
  }

  const csvRows = [
    ["Артикул", "Наименование", "К закупке", "Цена закупки", "Сумма"],
    ...rows.value.map((row) => [
      row.article,
      row.name,
      row.required.toFixed(3),
      row.base_cost.toFixed(2),
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
</script>

<template>
  <section class="space-y-4">
    <header class="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
      <h1 class="text-xl font-semibold text-slate-900">Отчет о дефиците материалов</h1>
      <p class="text-sm text-slate-500">
        Позиции с отрицательным остатком для формирования закупки.
      </p>
    </header>

    <section class="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
      <div class="mb-4 flex items-center justify-between">
        <p class="text-sm text-slate-600">Общий бюджет покрытия дефицита</p>
        <p class="text-lg font-bold text-slate-900">{{ formatCurrency(totalBudget) }}</p>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-100 text-slate-700">
            <tr>
              <th class="px-3 py-2 text-left">Артикул</th>
              <th class="px-3 py-2 text-left">Наименование</th>
              <th class="px-3 py-2 text-right">К закупке</th>
              <th class="px-3 py-2 text-right">Цена закупки</th>
              <th class="px-3 py-2 text-right">Сумма</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="row.article"
              class="border-b border-slate-200 last:border-0"
            >
              <td class="px-3 py-2 font-medium">{{ row.article }}</td>
              <td class="px-3 py-2">{{ row.name }}</td>
              <td class="px-3 py-2 text-right text-danger">{{ row.required.toFixed(3) }}</td>
              <td class="px-3 py-2 text-right">{{ formatCurrency(row.base_cost) }}</td>
              <td class="px-3 py-2 text-right font-semibold">{{ formatCurrency(row.budget) }}</td>
            </tr>
          </tbody>
        </table>
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
