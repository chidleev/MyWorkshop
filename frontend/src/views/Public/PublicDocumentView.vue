<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { API_BASE_URL, resolveBackendAssetUrl } from "../../api/baseUrl";

const route = useRoute();
const error = ref("");
const objectUrl = ref<string | null>(null);
const isLoading = ref(true);

const filename = computed(() => {
  const raw = route.params.filename;
  const s = Array.isArray(raw) ? raw[0] : raw;
  return (s ?? "").trim();
});

const isAllowedName = computed(() => /^(receipt|act)_\d+\.pdf$/i.test(filename.value));

function revokeObjectUrl() {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value);
    objectUrl.value = null;
  }
}

async function loadPdf() {
  error.value = "";
  revokeObjectUrl();

  if (!isAllowedName.value) {
    isLoading.value = false;
    error.value = "Некорректная ссылка на документ.";
    return;
  }

  if (!API_BASE_URL) {
    isLoading.value = false;
    error.value = "Не настроен адрес API (VITE_API_URL). Обратитесь к администратору.";
    return;
  }

  isLoading.value = true;
  try {
    const url = resolveBackendAssetUrl(`/documents/${filename.value}`);
    const res = await fetch(url, { method: "GET", credentials: "omit", mode: "cors" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const blob = await res.blob();
    if (blob.size === 0) {
      throw new Error("empty");
    }
    objectUrl.value = URL.createObjectURL(blob);
  } catch {
    error.value =
      "Не удалось загрузить документ с сервера. Ссылка могла устареть, или сервер временно недоступен.";
  } finally {
    isLoading.value = false;
  }
}

watch(filename, () => {
  void loadPdf();
});

onMounted(() => {
  void loadPdf();
});

onUnmounted(() => {
  revokeObjectUrl();
});
</script>

<template>
  <div class="flex min-h-screen flex-col bg-slate-100 text-slate-900">
    <header
      class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm"
    >
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Моя Мастерская</p>
        <h1 class="text-sm font-semibold text-slate-800">
          {{ filename || "Документ" }}
        </h1>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <a
          v-if="objectUrl"
          :href="objectUrl"
          :download="filename"
          class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Скачать PDF
        </a>
        <RouterLink
          to="/login"
          class="text-sm text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
        >
          Вход для сотрудников
        </RouterLink>
      </div>
    </header>

    <div v-if="isLoading" class="flex flex-1 items-center justify-center p-8 text-sm text-slate-500">
      Загрузка документа…
    </div>
    <div
      v-else-if="error"
      class="mx-auto max-w-lg flex-1 p-8 text-center text-sm leading-relaxed text-red-800"
    >
      {{ error }}
    </div>
    <iframe
      v-else-if="objectUrl"
      :src="objectUrl"
      class="min-h-0 w-full flex-1 border-0 bg-slate-200"
      title="Документ PDF"
    />
  </div>
</template>
