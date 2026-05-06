<script setup lang="ts">
import { useWorkshopDataStore } from "../../stores/workshopData";

const workshopStore = useWorkshopDataStore();

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
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
        <p class="mt-1 text-lg font-bold text-slate-900">{{ formatCurrency(workshopStore.profitabilityTotals.revenue) }}</p>
      </article>
      <article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p class="text-sm text-slate-500">Общая себестоимость</p>
        <p class="mt-1 text-lg font-bold text-slate-900">{{ formatCurrency(workshopStore.profitabilityTotals.cogs) }}</p>
      </article>
      <article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p class="text-sm text-slate-500">Средняя маржинальность</p>
        <p class="mt-1 text-lg font-bold text-slate-900">{{ workshopStore.profitabilityTotals.averageMargin.toFixed(2) }}%</p>
      </article>
    </section>

    <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="overflow-x-auto">
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
            <tr v-for="row in workshopStore.profitabilityRows" :key="row.id" class="border-b border-slate-200 last:border-0">
              <td class="px-3 py-2">
                <div class="font-medium">{{ row.agreement_number }}</div>
                <div class="text-xs text-slate-500">{{ row.client_name }}</div>
              </td>
              <td class="px-3 py-2 text-right">{{ formatCurrency(row.total_cost) }}</td>
              <td class="px-3 py-2 text-right">{{ formatCurrency(row.cogs) }}</td>
              <td class="px-3 py-2 text-right font-semibold">{{ formatCurrency(row.grossProfit) }}</td>
              <td class="px-3 py-2 text-right">{{ row.margin.toFixed(2) }}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
