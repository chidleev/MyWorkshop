<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { mockDeployments } from "../../mocks/deployments";

const route = useRoute();
const router = useRouter();
const selectedImage = ref<string | null>(null);

const deploymentId = computed(() => Number(route.params.id));
const deployment = computed(() =>
  mockDeployments.find((item) => item.id === deploymentId.value)
);

async function goBack() {
  await router.push({ name: "installer-deployments" });
}
</script>

<template>
  <section v-if="deployment" class="space-y-4">
    <button
      type="button"
      class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
      @click="goBack"
    >
      ← Назад
    </button>

    <article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h1 class="text-xl font-bold text-slate-900">{{ deployment.full_name }}</h1>
      <p class="mt-2 text-sm text-slate-700">{{ deployment.address }}</p>
      <a :href="`tel:${deployment.phone}`" class="mt-2 inline-block text-sm font-semibold text-primary">
        {{ deployment.phone }}
      </a>
      <p class="mt-2 text-sm text-slate-600">
        Монтаж: {{ deployment.install_date }} в {{ deployment.install_time }}
      </p>
    </article>

    <article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 class="text-lg font-semibold text-slate-900">Рендеры проекта</h2>
      <div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <button
          v-for="image in deployment.media_files"
          :key="image"
          type="button"
          class="overflow-hidden rounded-lg border border-slate-200"
          @click="selectedImage = image"
        >
          <img :src="image" alt="Рендер мебели" class="h-28 w-full object-cover sm:h-32" />
        </button>
      </div>
    </article>

    <div
      v-if="selectedImage"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4"
      @click.self="selectedImage = null"
    >
      <div class="relative max-w-4xl">
        <button
          type="button"
          class="absolute right-2 top-2 rounded-md bg-white/90 px-2 py-1 text-sm"
          @click="selectedImage = null"
        >
          ✕
        </button>
        <img :src="selectedImage" alt="Увеличенный рендер" class="max-h-[85vh] rounded-lg object-contain" />
      </div>
    </div>
  </section>

  <section v-else class="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
    Выезд не найден.
  </section>
</template>
