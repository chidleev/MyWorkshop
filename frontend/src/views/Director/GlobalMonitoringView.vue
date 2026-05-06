<script setup lang="ts">
import { computed, ref } from "vue";
import { useWorkshopDataStore } from "../../stores/workshopData";

const workshopStore = useWorkshopDataStore();
const statusFilter = ref("Все");
const managerFilter = ref("Все");

const managerOptions = computed(() => ["Все", ...new Set(workshopStore.projectOrders.map((item) => item.manager_ext_id))]);
const statusOptions = computed(() => ["Все", ...new Set(workshopStore.projectOrders.map((item) => item.status))]);

const rows = computed(() => {
  return workshopStore.projectOrders.filter((order) => {
    const matchesStatus = statusFilter.value === "Все" || order.status === statusFilter.value;
    const matchesManager = managerFilter.value === "Все" || order.manager_ext_id === managerFilter.value;
    return matchesStatus && matchesManager;
  });
});

function isOverdue(targetDate: string, status: string) {
  const today = new Date().toISOString().slice(0, 10);
  return status !== "Завершен" && targetDate < today;
}
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
      </div>

      <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="order in rows"
          :key="order.id"
          class="rounded-lg border p-3"
          :class="isOverdue(order.target_date, order.status) ? 'border-danger bg-red-50' : 'border-slate-200 bg-white'"
        >
          <div class="flex items-center justify-between">
            <h3 class="font-semibold text-slate-900">{{ order.agreement_number }}</h3>
            <span class="rounded-full bg-slate-100 px-2 py-1 text-xs">{{ order.status }}</span>
          </div>
          <p class="mt-2 text-sm text-slate-700">{{ order.client_name }}</p>
          <p class="mt-1 text-xs text-slate-600">Ответственный: {{ order.manager_name }} ({{ order.manager_ext_id }})</p>
          <p class="mt-1 text-xs text-slate-600">Плановая дата: {{ order.target_date }}</p>
          <p v-if="isOverdue(order.target_date, order.status)" class="mt-2 text-xs font-semibold text-danger">
            Просрочено
          </p>
        </article>
      </div>
    </section>
  </section>
</template>
