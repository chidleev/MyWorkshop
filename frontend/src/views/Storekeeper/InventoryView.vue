<script setup lang="ts">
import { computed, ref } from "vue";
import IncomingStockModal from "../../components/Storekeeper/IncomingStockModal.vue";
import { useWorkshopDataStore } from "../../stores/workshopData";
import { showSuccess } from "../../utils/notification";

const workshopStore = useWorkshopDataStore();
const search = ref("");
const isIncomingModalOpen = ref(false);

const filteredMaterials = computed(() => {
  const query = search.value.trim().toLowerCase();
  if (!query) {
    return workshopStore.materials;
  }
  return workshopStore.materials.filter(
    (item) => item.article.toLowerCase().includes(query) || item.name.toLowerCase().includes(query)
  );
});

function formatStock(value: number, unit: string) {
  if (unit === "шт") {
    return `${Math.round(value)} ${unit}`;
  }
  return `${value.toFixed(3)} ${unit}`;
}

function onIncomingSubmit(payload: { article: string; quantity: number }) {
  workshopStore.addIncomingStock(payload.article, payload.quantity);
  isIncomingModalOpen.value = false;
  showSuccess("Остатки успешно пополнены");
}
</script>

<template>
  <section class="space-y-4">
    <header class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Физические остатки материалов</h1>
        <p class="text-sm text-slate-500">Онлайн-таблица складской номенклатуры.</p>
      </div>
      <button
        type="button"
        class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        @click="isIncomingModalOpen = true"
      >
        Оформить приход
      </button>
    </header>

    <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <input
        v-model="search"
        type="search"
        placeholder="Поиск по артикулу или названию"
        class="w-full rounded-md border-slate-300 text-sm focus:border-primary focus:ring-primary"
      />

      <div class="mt-4 overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-100 text-slate-700">
            <tr>
              <th class="px-3 py-2 text-left">Артикул</th>
              <th class="px-3 py-2 text-left">Наименование</th>
              <th class="px-3 py-2 text-right">Фактический остаток</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in filteredMaterials"
              :key="item.article"
              class="border-b border-slate-200 last:border-0"
              :class="{ 'bg-red-50': item.current_stock <= 0 }"
            >
              <td class="px-3 py-2 font-medium">{{ item.article }}</td>
              <td class="px-3 py-2">{{ item.name }}</td>
              <td class="px-3 py-2 text-right" :class="{ 'text-danger font-semibold': item.current_stock <= 0 }">
                {{ formatStock(item.current_stock, item.unit) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <IncomingStockModal
      :is-open="isIncomingModalOpen"
      :materials="workshopStore.materials"
      @close="isIncomingModalOpen = false"
      @submit="onIncomingSubmit"
    />
  </section>
</template>
