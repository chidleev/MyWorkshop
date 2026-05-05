<script setup lang="ts">
import { computed, ref } from "vue";

type ProgressStatus = "new" | "in_progress" | "done";

interface ShiftTask {
  id: number;
  order_number: string;
  operation_name: string;
  progress_status: ProgressStatus;
  due_time: string;
}

const activeFilter = ref<ProgressStatus>("new");

const tasks = ref<ShiftTask[]>([
  {
    id: 1,
    order_number: "MM-2026-001",
    operation_name: "Распил ДСП",
    progress_status: "new",
    due_time: "10:30",
  },
  {
    id: 2,
    order_number: "MM-2026-007",
    operation_name: "Кромление",
    progress_status: "in_progress",
    due_time: "12:00",
  },
  {
    id: 3,
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
      <article
        v-for="task in filteredTasks"
        :key="task.id"
        class="rounded-xl border border-slate-300 bg-white p-5 shadow-sm"
      >
        <p class="text-sm text-slate-500">Заказ</p>
        <p class="text-xl font-bold text-slate-900">{{ task.order_number }}</p>
        <p class="mt-3 text-sm text-slate-500">Операция</p>
        <p class="text-lg font-semibold text-slate-900">{{ task.operation_name }}</p>
        <div class="mt-4 flex items-center justify-between">
          <span
            class="rounded-full px-3 py-1 text-sm font-medium"
            :class="{
              'bg-blue-100 text-blue-700': task.progress_status === 'new',
              'bg-amber-100 text-amber-700': task.progress_status === 'in_progress',
              'bg-green-100 text-green-700': task.progress_status === 'done',
            }"
          >
            {{ task.progress_status === "new" ? "Новая" : task.progress_status === "in_progress" ? "В работе" : "Завершена" }}
          </span>
          <span class="text-sm font-medium text-slate-600">до {{ task.due_time }}</span>
        </div>
      </article>
    </div>
  </section>
</template>
