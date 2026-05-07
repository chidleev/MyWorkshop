<script setup lang="ts">
import type { ProgressStatus, ShiftTask } from "../../types/workshop";

defineProps<{
  task: ShiftTask;
  isUpdating?: boolean;
}>();

const emit = defineEmits<{
  (event: "update-status", payload: { taskId: number; status: ProgressStatus }): void;
}>();

function nextStatus(status: ProgressStatus): ProgressStatus | null {
  if (status === "new") {
    return "in_progress";
  }
  if (status === "in_progress") {
    return "done";
  }
  return null;
}

function handleAction(task: ShiftTask) {
  const status = nextStatus(task.progress_status);
  if (!status) {
    return;
  }
  emit("update-status", { taskId: task.id, status });
}
</script>

<template>
  <article class="rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
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

    <button
      v-if="task.progress_status === 'new'"
      type="button"
      class="mt-4 min-h-12 w-full rounded-md bg-primary px-4 py-3 text-base font-semibold text-white hover:bg-blue-700"
      :disabled="isUpdating"
      @click="handleAction(task)"
    >
      {{ isUpdating ? "Обновление..." : "Взять в работу" }}
    </button>
    <button
      v-else-if="task.progress_status === 'in_progress'"
      type="button"
      class="mt-4 min-h-12 w-full rounded-md bg-success px-4 py-3 text-base font-semibold text-white hover:bg-green-700"
      :disabled="isUpdating"
      @click="handleAction(task)"
    >
      {{ isUpdating ? "Обновление..." : "Завершить операцию" }}
    </button>
    <div
      v-else
      class="mt-4 flex min-h-12 items-center justify-center rounded-md border border-success bg-green-50 px-4 py-3 text-base font-semibold text-success"
    >
      ✓ Выполнено
    </div>
  </article>
</template>
