<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchInventory, registerIncomingStock, type InventoryItem } from "../../api/inventory";
import IncomingStockModal from "../../components/Storekeeper/IncomingStockModal.vue";
import { showError, showSuccess } from "../../utils/notification";
import {
  isServerAvailable,
  isServerUnavailableError,
  SERVER_UNAVAILABLE_MESSAGE,
  withRequestTimeout,
} from "../../utils/serverHealth";

const search = ref("");
const isIncomingModalOpen = ref(false);
const materials = ref<InventoryItem[]>([]);
const isLoading = ref(false);
const loadError = ref("");

const filteredMaterials = computed(() => {
  const query = search.value.trim().toLowerCase();
  if (!query) {
    return materials.value;
  }
  return materials.value.filter(
    (item) => item.article.toLowerCase().includes(query) || item.name.toLowerCase().includes(query)
  );
});

function formatStock(value: string | number) {
  return Number(value).toFixed(3);
}

async function loadInventory() {
  isLoading.value = true;
  loadError.value = "";
  if (!(await isServerAvailable())) {
    materials.value = [];
    loadError.value = SERVER_UNAVAILABLE_MESSAGE;
    isLoading.value = false;
    return;
  }
  try {
    const response = await withRequestTimeout(fetchInventory());
    materials.value = response?.data || [];
  } catch (error) {
    materials.value = [];
    loadError.value = isServerUnavailableError(error)
      ? SERVER_UNAVAILABLE_MESSAGE
      : "Не удалось загрузить остатки со склада.";
  } finally {
    isLoading.value = false;
  }
}

async function onIncomingSubmit(payload: { materialId: number; quantity: number }) {
  try {
    await registerIncomingStock(payload.materialId, payload.quantity);
    await loadInventory();
    isIncomingModalOpen.value = false;
    showSuccess("Остатки успешно пополнены");
  } catch {
    showError("Не удалось зарегистрировать приход. Проверьте доступность сервера.");
  }
}

onMounted(() => {
  void loadInventory();
});
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

      <div v-if="isLoading" class="mt-4 text-sm text-slate-500">Загрузка остатков...</div>
      <div v-else-if="loadError" class="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {{ loadError }}
      </div>
      <div
        v-else-if="filteredMaterials.length === 0"
        class="mt-4 rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500"
      >
        Нет данных по остаткам для отображения.
      </div>
      <div v-else class="mt-4 overflow-x-auto">
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
              :class="{ 'bg-red-50': Number(item.current_stock) <= 0 }"
            >
              <td class="px-3 py-2 font-medium">{{ item.article }}</td>
              <td class="px-3 py-2">{{ item.name }}</td>
              <td class="px-3 py-2 text-right" :class="{ 'text-danger font-semibold': Number(item.current_stock) <= 0 }">
                {{ formatStock(item.current_stock) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <IncomingStockModal
      :is-open="isIncomingModalOpen"
      :materials="materials"
      @close="isIncomingModalOpen = false"
      @submit="onIncomingSubmit"
    />
  </section>
</template>
