<script setup lang="ts">
import { useWorkshopDataStore } from "../../stores/workshopData";

const workshopStore = useWorkshopDataStore();
const pendingLimit = 2;
</script>

<template>
  <section class="space-y-4">
    <header class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h1 class="text-xl font-semibold text-slate-900">Загрузка производственных линий</h1>
      <p class="text-sm text-slate-500">Дашборд по операциям: ожидают, в работе, завершены.</p>
    </header>

    <section class="grid gap-4 md:grid-cols-2">
      <article
        v-for="row in workshopStore.operationLoad"
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
