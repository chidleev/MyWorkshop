<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchTasks, type WorkshopTaskDto, updateWorkshopTaskStatus } from "../../api/workshop";
import ShiftTaskCard from "../../components/Workshop/ShiftTaskCard.vue";
import type { ProgressStatus, ShiftTask } from "../../types/workshop";
import { isServerAvailable, SERVER_UNAVAILABLE_MESSAGE } from "../../utils/serverHealth";

const tasks = ref<ShiftTask[]>([]);
const updatingTaskId = ref<number | null>(null);
const isLoading = ref(false);
const loadError = ref("");

const activeTasks = computed(() =>
  tasks.value
    .filter((task) => task.progress_status === "in_progress")
    .sort((a, b) => a.due_time.localeCompare(b.due_time))
);

const queueTasks = computed(() =>
  tasks.value
    .filter((task) => task.progress_status === "new")
    .sort((a, b) => a.due_time.localeCompare(b.due_time))
);

function mapProgressStatus(status: string): ProgressStatus {
  if (status === "В работе" || status === "in_progress") return "in_progress";
  if (status === "Завершен" || status === "done") return "done";
  return "new";
}

function toTaskModel(dto: WorkshopTaskDto): ShiftTask {
  return {
    id: dto.id,
    order_id: dto.order_id,
    order_number: dto.agreement_number,
    operation_name: dto.operation_name,
    progress_status: mapProgressStatus(dto.progress_status),
    due_time: dto.target_date?.slice(0, 10) ?? "",
  };
}

async function loadTasks() {
  isLoading.value = true;
  loadError.value = "";
  if (!(await isServerAvailable())) {
    tasks.value = [];
    loadError.value = SERVER_UNAVAILABLE_MESSAGE;
    isLoading.value = false;
    return;
  }
  try {
    const response = await fetchTasks();
    tasks.value = response.data.map(toTaskModel).filter((t) => t.progress_status !== "done");
  } catch {
    tasks.value = [];
    loadError.value = "Не удалось загрузить сменные задания.";
  } finally {
    isLoading.value = false;
  }
}

async function updateTaskStatus(payload: { taskId: number; status: ProgressStatus }) {
  const task = tasks.value.find((item) => item.id === payload.taskId);
  if (!task) return;

  updatingTaskId.value = payload.taskId;
  try {
    await updateWorkshopTaskStatus(payload.taskId, payload.status);
    await loadTasks();
  } catch {
    /* сообщение показывает axios-интерцептор (в т.ч. 409 с текстом с бэка) */
  } finally {
    updatingTaskId.value = null;
  }
}

onMounted(() => {
  void loadTasks();
});
</script>

<template>
  <section class="space-y-6">
    <header class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h1 class="text-2xl font-bold text-slate-900 sm:text-3xl">Табло сменных заданий</h1>
    </header>

    <div
      v-if="isLoading"
      class="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm"
    >
      Загрузка заданий...
    </div>
    <div
      v-else-if="loadError"
      class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm"
    >
      {{ loadError }}
    </div>
    <div v-else class="space-y-8">
      <section class="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm sm:p-5">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="text-lg font-semibold text-slate-900">Сейчас в работе</h2>
          <span class="text-sm text-slate-600">всего: {{ activeTasks.length }}</span>
        </div>
        <p v-if="activeTasks.length === 0" class="mt-3 text-sm text-slate-600">
          Ничего не запущено — возьмите задание из очереди ниже.
        </p>
        <div v-else class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ShiftTaskCard
            v-for="task in activeTasks"
            :key="task.id"
            :task="task"
            :is-updating="updatingTaskId === task.id"
            @update-status="updateTaskStatus"
          />
        </div>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="text-lg font-semibold text-slate-900">Очередь</h2>
          <span class="text-sm text-slate-600">всего: {{ queueTasks.length }}</span>
        </div>
        <p v-if="queueTasks.length === 0" class="mt-3 text-sm text-slate-500">
          Новых заданий нет — отличная работа или проверьте фильтр на сервере.
        </p>
        <div v-else class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ShiftTaskCard
            v-for="task in queueTasks"
            :key="task.id"
            :task="task"
            :is-updating="updatingTaskId === task.id"
            @update-status="updateTaskStatus"
          />
        </div>
      </section>
    </div>
  </section>
</template>
