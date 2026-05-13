<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { fetchGlobalOrders, type DirectorOrder } from "../../api/director";
import AppDataTable, { type DataTableColumn } from "../../components/Common/AppDataTable.vue";
import { formatDateTime } from "../../utils/datetime";
import { isServerAvailable, SERVER_UNAVAILABLE_MESSAGE } from "../../utils/serverHealth";

const router = useRouter();

const statusFilter = ref("Все");
const managerFilter = ref("Все");
const overdueOnly = ref(false);
const searchQuery = ref("");

const rows = ref<DirectorOrder[]>([]);
const isLoading = ref(false);
const loadError = ref("");

const monitoringColumns: DataTableColumn[] = [
  { key: "agreement_number", label: "Договор", sortable: true },
  { key: "full_name", label: "Клиент", sortable: true },
  { key: "manager_ext_id", label: "Менеджер", sortable: true },
  { key: "current_stage", label: "Статус", sortable: true },
  { key: "target_date", label: "Плановая дата", sortable: true },
  { key: "actions", label: "Действия", align: "right" },
];

const managerOptions = computed(() => ["Все", ...new Set(rows.value.map((item) => item.manager_ext_id))]);
const statusOptions = computed(() => ["Все", ...new Set(rows.value.map((item) => item.current_stage))]);

function formatManagerName(managerId: string) {
  if (managerId === "system_web_lead") return "Заявка с сайта";
  return managerId;
}

function isOverdue(targetDate: string, status: string) {
  const today = new Date().toISOString().slice(0, 10);
  return status !== "Завершен" && targetDate < today;
}

function formatTargetDate(value: string) {
  return formatDateTime(value);
}

function resetClientControls() {
  searchQuery.value = "";
}

const processedRows = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const searched = query
    ? rows.value.filter((item) => {
        const haystack = [item.agreement_number, item.full_name, item.manager_ext_id, item.current_stage, item.phone ?? ""]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
    : rows.value;

  return searched;
});
const monitoringRows = computed(() => processedRows.value as unknown as Record<string, unknown>[]);

function openOrderDetail(order: DirectorOrder) {
  void router.push({ name: "director-order-detail", params: { id: String(order.id) } });
}

function toDirectorOrder(row: Record<string, unknown>): DirectorOrder {
  return row as unknown as DirectorOrder;
}

async function loadOrders() {
  isLoading.value = true;
  loadError.value = "";
  if (!(await isServerAvailable())) {
    loadError.value = SERVER_UNAVAILABLE_MESSAGE;
    isLoading.value = false;
    return;
  }
  try {
    const response = await fetchGlobalOrders({
      manager_id: managerFilter.value === "Все" ? undefined : managerFilter.value,
      status: statusFilter.value === "Все" ? undefined : statusFilter.value,
      is_overdue: overdueOnly.value || undefined,
    });
    rows.value = response.data;
  } catch {
    rows.value = [];
    loadError.value = "Не удалось загрузить мониторинг сделок.";
  } finally {
    isLoading.value = false;
  }
}

watch([managerFilter, statusFilter, overdueOnly], () => {
  void loadOrders();
});

onMounted(() => {
  void loadOrders();
});
</script>

<template>
  <section class="space-y-4">
    <header class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h1 class="text-xl font-semibold text-slate-900">Глобальный мониторинг сделок</h1>
      <p class="text-sm text-slate-500">Единая таблица заказов с фильтрами, сортировкой и переходом к карточке заказа.</p>
    </header>

    <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <select v-model="managerFilter" class="rounded-md border-slate-300 text-sm focus:border-primary focus:ring-primary">
          <option v-for="manager in managerOptions" :key="manager" :value="manager">
            {{ manager === "Все" ? "Все менеджеры" : formatManagerName(manager) }}
          </option>
        </select>
        <select v-model="statusFilter" class="rounded-md border-slate-300 text-sm focus:border-primary focus:ring-primary">
          <option v-for="status in statusOptions" :key="status" :value="status">
            {{ status === "Все" ? "Все статусы" : status }}
          </option>
        </select>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Поиск: договор, клиент, менеджер"
          class="rounded-md border-slate-300 text-sm focus:border-primary focus:ring-primary xl:col-span-2"
        />
        <label class="flex items-center gap-2 text-sm text-slate-700">
          <input v-model="overdueOnly" type="checkbox" class="rounded border-slate-300 text-primary focus:ring-primary" />
          Только просроченные
        </label>
      </div>

      <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm text-slate-600">Найдено: {{ processedRows.length }}</p>
        <div class="flex items-center gap-2">
          <button type="button" class="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50" @click="resetClientControls">
            Сбросить сортировку/поиск
          </button>
        </div>
      </div>

      <div v-if="isLoading" class="mt-4 text-sm text-slate-500">Загрузка данных...</div>
      <div v-else-if="loadError" class="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {{ loadError }}
      </div>
      <div v-else class="mt-4 space-y-3">
        <AppDataTable
          :rows="monitoringRows"
          :columns="monitoringColumns"
          row-key="id"
          initial-sort-key="target_date"
          initial-sort-order="asc"
          :row-class="(row) => isOverdue(String(row.target_date), String(row.current_stage)) ? 'bg-red-50' : ''"
        >
          <template #cell-manager_ext_id="{ row }">
            {{ formatManagerName(String(row.manager_ext_id)) }}
          </template>
          <template #cell-current_stage="{ row }">
            <span class="rounded-full bg-slate-100 px-2 py-1 text-xs">{{ row.current_stage }}</span>
          </template>
          <template #cell-target_date="{ row }">
            {{ formatTargetDate(String(row.target_date)) }}
            <span
              v-if="isOverdue(String(row.target_date), String(row.current_stage))"
              class="ml-2 text-xs font-semibold text-danger"
            >
              Просрочено
            </span>
          </template>
          <template #cell-actions="{ row }">
            <button
              type="button"
              class="rounded-md border border-primary px-3 py-1.5 text-xs text-primary hover:bg-blue-50"
              @click="openOrderDetail(toDirectorOrder(row))"
            >
              Открыть
            </button>
          </template>
        </AppDataTable>
      </div>
    </section>
  </section>
</template>
