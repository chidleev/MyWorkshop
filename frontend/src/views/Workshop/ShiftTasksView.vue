<script setup lang="ts">
import { computed, ref } from "vue";
import ShiftTaskCard from "../../components/Workshop/ShiftTaskCard.vue";
import type { ProgressStatus, ShiftTask } from "../../types/workshop";

const activeFilter = ref<ProgressStatus>("new");

const tasks = ref<ShiftTask[]>([
  {
    id: 1,
    order_id: 1,
    order_number: "MM-2026-001",
    operation_name: "Распил ДСП",
    progress_status: "new",
    due_time: "10:30",
  },
  {
    id: 2,
    order_id: 7,
    order_number: "MM-2026-007",
    operation_name: "Кромление",
    progress_status: "in_progress",
    due_time: "12:00",
  },
  {
    id: 3,
    order_id: 4,
    order_number: "MM-2026-004",
    operation_name: "Сборка",
    progress_status: "done",
    due_time: "15:00",
  },
]);

const tabs: Array<{ key: ProgressStatus; label: string }> = [
  { key: "new", label: "Новые" },
  { key: "in_progress", label: "В работе" },
  { key: "done", label: "Завершенные" },
];

const filteredTasks = computed(() =>
  tasks.value.filter((task) => task.progress_status === activeFilter.value)
);

function updateTaskStatus(payload: { taskId: number; status: ProgressStatus }) {
  tasks.value = tasks.value.map((task) =>
    task.id === payload.taskId ? { ...task, progress_status: payload.status } : task
  );
}
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

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <ShiftTaskCard
        v-for="task in filteredTasks"
        :key="task.id"
        :task="task"
        @update-status="updateTaskStatus"
      />
    </div>
  </section>
</template>
