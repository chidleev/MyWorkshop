<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchInventory, registerIncomingStock, type InventoryItem } from "../../api/inventory";
import AppDataTable, { type DataTableColumn } from "../../components/Common/AppDataTable.vue";
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
/** Фоновое обновление без скрытия таблицы (избегает «мигания» как при перезагрузке страницы). */
const isRefreshing = ref(false);
const loadError = ref("");
/** Если включено, в колонке остатка показывается фактический остаток с учётом резервов (доступно под обеспечение). */
const accountReserves = ref(false);

const filteredMaterials = computed(() => {
  const query = search.value.trim().toLowerCase();
  if (!query) {
    return materials.value;
  }
  return materials.value.filter(
    (item) => item.article.toLowerCase().includes(query) || item.name.toLowerCase().includes(query)
  );
});

const tableRows = computed(() =>
  filteredMaterials.value.map((item) => {
    const physical = Number(item.physical_stock);
    const reserved = Number(item.reserved_change);
    const display_stock = accountReserves.value ? physical + reserved : physical;
    return { ...item, display_stock } as InventoryItem & { display_stock: number };
  })
);

const inventoryTableColumns = computed<DataTableColumn[]>(() => [
  { key: "article", label: "Артикул", sortable: true },
  { key: "name", label: "Наименование", sortable: true },
  {
    key: "display_stock",
    label: accountReserves.value ? "Остаток (с учётом резервов)" : "Фактический остаток",
    sortable: true,
    align: "right",
  },
]);

const inventoryTableRows = computed(() => tableRows.value as unknown as Record<string, unknown>[]);

function formatStock(value: string | number) {
  return Number(value).toFixed(3);
}

async function loadInventory(options?: { soft?: boolean }) {
  const soft = Boolean(options?.soft);
  if (soft) {
    isRefreshing.value = true;
  } else {
    isLoading.value = true;
  }
  loadError.value = "";
  if (!(await isServerAvailable())) {
    materials.value = [];
    loadError.value = SERVER_UNAVAILABLE_MESSAGE;
    if (soft) {
      isRefreshing.value = false;
    } else {
      isLoading.value = false;
    }
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
    if (soft) {
      isRefreshing.value = false;
    } else {
      isLoading.value = false;
    }
  }
}

async function onIncomingSubmit(payload: { materialId: number; quantity: number }) {
  try {
    await registerIncomingStock(payload.materialId, payload.quantity);
    await loadInventory({ soft: true });
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
      <div class="flex flex-wrap items-center gap-4">
        <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input v-model="accountReserves" type="checkbox" class="rounded border-slate-300 text-primary focus:ring-primary" />
          Учитывать резервы
        </label>
        <button
          type="button"
          class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          @click="isIncomingModalOpen = true"
        >
          Оформить приход
        </button>
      </div>
    </header>

    <p v-if="accountReserves" class="text-xs text-slate-500">
      Показан остаток с учётом неизрасходованных резервов: фактический остаток плюс сумма по строкам «Резерв» (обычно отрицательная),
      то есть ориентировочно доступно под новое резервирование.
    </p>

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
      <div v-else>
        <div v-if="isRefreshing" class="mt-4 text-xs text-slate-500">Обновление остатков…</div>
        <div
          v-if="tableRows.length === 0"
          class="mt-4 rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500"
        >
          Нет данных по остаткам для отображения.
        </div>
        <AppDataTable
          v-else
          class="mt-4"
          :rows="inventoryTableRows"
          :columns="inventoryTableColumns"
          row-key="article"
          initial-sort-key="article"
          initial-sort-order="asc"
        >
          <template #cell-display_stock="{ row }">
            <span :class="{ 'text-danger font-semibold': Number(row.display_stock) <= 0 }">
              {{ formatStock(Number(row.display_stock)) }}
            </span>
          </template>
        </AppDataTable>
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
