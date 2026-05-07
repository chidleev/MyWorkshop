<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { updateOrderStatus } from "../../api/orders";
import { fetchTasks, type WorkshopTaskDto } from "../../api/workshop";
import ShiftTaskCard from "../../components/Workshop/ShiftTaskCard.vue";
import type { ProgressStatus, ShiftTask } from "../../types/workshop";
import { showError } from "../../utils/notification";
import { isServerAvailable, SERVER_UNAVAILABLE_MESSAGE } from "../../utils/serverHealth";

const activeFilter = ref<ProgressStatus>("new");
const tasks = ref<ShiftTask[]>([]);
const updatingTaskId = ref<number | null>(null);
const isLoading = ref(false);
const loadError = ref("");

const tabs: Array<{ key: ProgressStatus; label: string }> = [
  { key: "new", label: "Новые" },
  { key: "in_progress", label: "В работе" },
  { key: "done", label: "Завершенные" },
];

const filteredTasks = computed(() =>
  tasks.value.filter((task) => task.progress_status === activeFilter.value)
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
    tasks.value = response.data.map(toTaskModel);
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
    const nextOrderStatus = payload.status === "in_progress" ? "В производстве" : "Готов к отгрузке";
    await updateOrderStatus(task.order_id, nextOrderStatus);
    await loadTasks();
  } catch {
    showError("Не удалось обновить статус задания.");
  } finally {
    updatingTaskId.value = null;
  }
}

onMounted(() => {
  void loadTasks();
});
</script>

<template>
  <section class="space-y-4">
    <header class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h1 class="text-2xl font-bold text-slate-900 sm:text-3xl">Табло сменных заданий</h1>
      <p class="mt-2 text-base text-slate-600">Задачи на текущую смену для мастера цеха.</p>
    </header>

    <div class="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        class="min-h-11 rounded-md px-4 text-sm font-semibold sm:text-base"
        :class="
          activeFilter === tab.key
            ? 'bg-primary text-white'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        "
        @click="activeFilter = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <div v-if="isLoading" class="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
      Загрузка заданий...
    </div>
    <div v-else-if="loadError" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
      {{ loadError }}
    </div>
    <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <ShiftTaskCard
        v-for="task in filteredTasks"
        :key="task.id"
        :task="task"
        :is-updating="updatingTaskId === task.id"
        @update-status="updateTaskStatus"
      />
    </div>
  </section>
</template>
