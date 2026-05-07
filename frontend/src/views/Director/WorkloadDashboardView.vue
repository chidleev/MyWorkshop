<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchWorkload, type WorkloadResponse } from "../../api/director";
import { isServerAvailable, SERVER_UNAVAILABLE_MESSAGE } from "../../utils/serverHealth";

const pendingLimit = 2;
const isLoading = ref(false);
const workload = ref<WorkloadResponse>({});
const loadError = ref("");

const rows = computed(() =>
  Object.entries(workload.value).map(([operation, statuses]) => {
    const pending = Number(statuses["Ожидает"] ?? statuses["new"] ?? 0);
    const inProgress = Number(statuses["В работе"] ?? statuses["in_progress"] ?? 0);
    const completed = Number(statuses["Завершен"] ?? statuses["done"] ?? 0);
    const total = pending + inProgress + completed || 1;
    return {
      operation,
      pending,
      inProgress,
      completed,
      pendingPercent: Math.round((pending / total) * 100),
      inProgressPercent: Math.round((inProgress / total) * 100),
      completedPercent: Math.round((completed / total) * 100),
    };
  })
);

async function loadWorkload() {
  isLoading.value = true;
  loadError.value = "";
  if (!(await isServerAvailable())) {
    loadError.value = SERVER_UNAVAILABLE_MESSAGE;
    isLoading.value = false;
    return;
  }
  try {
    const response = await fetchWorkload();
    workload.value = response.data;
  } catch {
    workload.value = {};
    loadError.value = "Не удалось загрузить дашборд загрузки.";
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  void loadWorkload();
});
</script>

<template>
  <section class="space-y-4">
    <header class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h1 class="text-xl font-semibold text-slate-900">Загрузка производственных линий</h1>
      <p class="text-sm text-slate-500">Дашборд по операциям: ожидают, в работе, завершены.</p>
    </header>

    <section v-if="isLoading" class="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
      Загрузка дашборда...
    </section>
    <section v-else-if="loadError" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
      {{ loadError }}
    </section>
    <section v-else class="grid gap-4 md:grid-cols-2">
      <article
        v-for="row in rows"
        :key="row.operation"
        class="rounded-xl border bg-white p-4 shadow-sm"
        :class="row.pending > pendingLimit ? 'border-danger' : 'border-slate-200'"
      >
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-slate-900">{{ row.operation }}</h2>
          <span v-if="row.pending > pendingLimit" class="rounded-full bg-red-100 px-2 py-1 text-xs text-danger">
            Перегруз
          </span>
        </div>

        <div class="space-y-2 text-sm">
          <div>
            <div class="mb-1 flex justify-between">
              <span>Ожидают</span>
              <span>{{ row.pending }}</span>
            </div>
            <div class="h-2 rounded bg-slate-100">
              <div class="h-2 rounded bg-red-500" :style="{ width: `${row.pendingPercent}%` }" />
            </div>
          </div>

          <div>
            <div class="mb-1 flex justify-between">
              <span>В работе</span>
              <span>{{ row.inProgress }}</span>
            </div>
            <div class="h-2 rounded bg-slate-100">
              <div class="h-2 rounded bg-amber-500" :style="{ width: `${row.inProgressPercent}%` }" />
            </div>
          </div>

          <div>
            <div class="mb-1 flex justify-between">
              <span>Завершены</span>
              <span>{{ row.completed }}</span>
            </div>
            <div class="h-2 rounded bg-slate-100">
              <div class="h-2 rounded bg-green-500" :style="{ width: `${row.completedPercent}%` }" />
            </div>
          </div>
        </div>
      </article>
    </section>
  </section>
</template>
