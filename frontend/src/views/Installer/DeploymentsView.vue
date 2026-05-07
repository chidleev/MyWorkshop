<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useInstallerStore } from "../../stores/installer";

const router = useRouter();
const installerStore = useInstallerStore();
const deployments = computed(() => installerStore.deployments);
const isLoading = computed(() => installerStore.isLoading);
const loadError = computed(() => installerStore.loadError);

onMounted(() => {
  void installerStore.ensureLoaded();
});

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

    <p v-if="isLoading" class="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
      Загружаем выезды...
    </p>
    <p v-else-if="loadError" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
      {{ loadError }}
    </p>
    <p
      v-else-if="deployments.length === 0"
      class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500 shadow-sm"
    >
      Сейчас нет активных выездов.
    </p>

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
