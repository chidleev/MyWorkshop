<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { fetchGlobalOrders, type DirectorOrder } from "../../api/director";
import { isServerAvailable, SERVER_UNAVAILABLE_MESSAGE } from "../../utils/serverHealth";

const statusFilter = ref("Все");
const managerFilter = ref("Все");
const overdueOnly = ref(false);
const rows = ref<DirectorOrder[]>([]);
const isLoading = ref(false);
const loadError = ref("");

const managerOptions = computed(() => ["Все", ...new Set(rows.value.map((item) => item.manager_ext_id))]);
const statusOptions = computed(() => ["Все", ...new Set(rows.value.map((item) => item.current_stage))]);

function isOverdue(targetDate: string, status: string) {
  const today = new Date().toISOString().slice(0, 10);
  return status !== "Завершен" && targetDate < today;
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
      <p class="text-sm text-slate-500">Контроль заказов всех менеджеров в едином реестре.</p>
    </header>

    <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="grid gap-3 md:grid-cols-2">
        <select
          v-model="managerFilter"
          class="rounded-md border-slate-300 text-sm focus:border-primary focus:ring-primary"
        >
          <option v-for="manager in managerOptions" :key="manager" :value="manager">
            {{ manager === "Все" ? "Все менеджеры" : manager }}
          </option>
        </select>
        <select v-model="statusFilter" class="rounded-md border-slate-300 text-sm focus:border-primary focus:ring-primary">
          <option v-for="status in statusOptions" :key="status" :value="status">
            {{ status === "Все" ? "Все статусы" : status }}
          </option>
        </select>
        <label class="flex items-center gap-2 text-sm text-slate-700">
          <input v-model="overdueOnly" type="checkbox" class="rounded border-slate-300 text-primary focus:ring-primary" />
          Только просроченные
        </label>
      </div>

      <div v-if="isLoading" class="mt-4 text-sm text-slate-500">Загрузка данных...</div>
      <div v-else-if="loadError" class="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {{ loadError }}
      </div>
      <div v-else class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="order in rows"
          :key="order.id"
          class="rounded-lg border p-3"
          :class="isOverdue(order.target_date, order.current_stage) ? 'border-danger bg-red-50' : 'border-slate-200 bg-white'"
        >
          <div class="flex items-center justify-between">
            <h3 class="font-semibold text-slate-900">{{ order.agreement_number }}</h3>
            <span class="rounded-full bg-slate-100 px-2 py-1 text-xs">{{ order.current_stage }}</span>
          </div>
          <p class="mt-2 text-sm text-slate-700">{{ order.full_name }}</p>
          <p class="mt-1 text-xs text-slate-600">Ответственный: {{ order.manager_ext_id }}</p>
          <p class="mt-1 text-xs text-slate-600">Плановая дата: {{ order.target_date }}</p>
          <p v-if="isOverdue(order.target_date, order.current_stage)" class="mt-2 text-xs font-semibold text-danger">
            Просрочено
          </p>
        </article>
      </div>
    </section>
  </section>
</template>
