<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { fetchOrderMedia, uploadMedia } from "../../api/media";
import { updateOrderStatus } from "../../api/orders";
import PhotoReportUploader from "../../components/Installer/PhotoReportUploader.vue";
import { resolveBackendAssetUrl } from "../../api/baseUrl";
import { useInstallerStore } from "../../stores/installer";
import { formatDateTime } from "../../utils/datetime";
import { showError, showSuccess } from "../../utils/notification";

const route = useRoute();
const router = useRouter();
const selectedImage = ref<string | null>(null);
const isSubmitting = ref(false);
const mediaFiles = ref<string[]>([]);
const installerStore = useInstallerStore();
const loadError = computed(() => installerStore.loadError);

const deploymentId = computed(() => Number(route.params.id));
const deployment = computed(() =>
  installerStore.deployments.find((item) => item.id === deploymentId.value)
);

onMounted(() => {
  void installerStore.ensureLoaded(true);
  void loadMedia();
});

async function loadMedia() {
  try {
    const response = await fetchOrderMedia(deploymentId.value);
    mediaFiles.value = response.data.map((item) => resolveBackendAssetUrl(item.secure_link));
  } catch {
    mediaFiles.value = [];
  }
}

async function goBack() {
  await router.push({ name: "installer-deployments" });
}

async function completeWithPhoto(file: File) {
  if (!deployment.value) {
    return;
  }

  isSubmitting.value = true;
  try {
    await uploadMedia(deploymentId.value, file);
    await loadMedia();
    await updateOrderStatus(deploymentId.value, "Завершен");
    installerStore.completeDeployment(deploymentId.value);
    showSuccess("Объект успешно сдан!");
    await goBack();
  } catch {
    showError("Не удалось загрузить фотоотчет. Статус заказа не изменен.");
  } finally {
    isSubmitting.value = false;
  }
}

function formatInstallDateTime(installDate: string, installTime: string) {
  if (!installDate || installDate === "—") return "—";
  if (!installTime || installTime === "—") return formatDateTime(installDate);
  return formatDateTime(`${installDate}T${installTime}`);
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
        Монтаж: {{ formatInstallDateTime(deployment.install_date, deployment.install_time) }}
      </p>
    </article>

    <article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 class="text-lg font-semibold text-slate-900">Рендеры проекта</h2>
      <div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <button
          v-for="image in mediaFiles.length > 0 ? mediaFiles : deployment.media_files"
          :key="image"
          type="button"
          class="overflow-hidden rounded-lg border border-slate-200"
          @click="selectedImage = image"
        >
          <img :src="image" alt="Рендер мебели" class="h-28 w-full object-cover sm:h-32" />
        </button>
      </div>
    </article>

    <PhotoReportUploader :is-submitting="isSubmitting" @submit-photo="completeWithPhoto" />

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
    {{ loadError || "Выезд не найден." }}
  </section>
</template>
