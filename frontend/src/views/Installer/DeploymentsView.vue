<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { mockDeployments } from "../../mocks/deployments";

const router = useRouter();
const deployments = computed(() => mockDeployments);

async function openDeployment(id: number) {
  await router.push({ name: "installer-deployment-detail", params: { id } });
}
</script>

<template>
  <section class="space-y-3">
    <header class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h1 class="text-2xl font-bold text-slate-900">Мои выезды</h1>
      <p class="mt-1 text-sm text-slate-600">План монтажей на сегодня.</p>
    </header>

    <button
      v-for="item in deployments"
      :key="item.id"
      type="button"
      class="w-full rounded-xl border border-slate-300 bg-white p-4 text-left shadow-sm"
      @click="openDeployment(item.id)"
    >
      <p class="text-sm text-slate-500">{{ item.order_number }}</p>
      <p class="mt-1 text-lg font-semibold text-slate-900">{{ item.full_name }}</p>
      <p class="mt-1 text-sm text-slate-700">{{ item.address }}</p>
      <div class="mt-3 flex items-center justify-between">
        <span class="text-sm font-medium text-slate-700">{{ item.install_date }} {{ item.install_time }}</span>
        <span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
          {{ item.status }}
        </span>
      </div>
    </button>
  </section>
</template>
