<script setup lang="ts">
import { computed, ref } from "vue";
import { useWorkshopDataStore } from "../../stores/workshopData";

const workshopStore = useWorkshopDataStore();
const txType = ref<"Все" | "Приход" | "Резерв" | "Списание">("Все");
const orderSearch = ref("");

const rows = computed(() => {
  return workshopStore.transactions
    .map((transaction) => {
      const material = workshopStore.materials.find((item) => item.article === transaction.article);
      return {
        ...transaction,
        materialName: material?.name ?? "Неизвестный материал",
      };
    })
    .filter((row) => (txType.value === "Все" ? true : row.tx_type === txType.value))
    .filter((row) =>
      orderSearch.value.trim().length > 0
        ? (row.order_id ?? "").toLowerCase().includes(orderSearch.value.trim().toLowerCase())
        : true
    );
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

      <div class="mt-4 overflow-x-auto">
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
                <div class="text-xs text-slate-500">{{ row.materialName }}</div>
              </td>
              <td class="px-3 py-2">{{ row.tx_type }}</td>
              <td
                class="px-3 py-2 text-right font-semibold"
                :class="row.quantity_change > 0 ? 'text-green-600' : 'text-red-600'"
              >
                {{ row.quantity_change > 0 ? "+" : "" }}{{ row.quantity_change.toFixed(3) }}
              </td>
              <td class="px-3 py-2">{{ row.order_id ?? "—" }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
