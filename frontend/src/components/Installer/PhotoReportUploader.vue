<script setup lang="ts">
import { computed, ref } from "vue";

const emit = defineEmits<{
  (event: "submit-photo", payload: File): void;
}>();
const props = defineProps<{
  isSubmitting?: boolean;
}>();

const selectedFile = ref<File | null>(null);
const previewUrl = ref("");
const canSubmit = computed(() => Boolean(selectedFile.value) && !props.isSubmitting);

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) {
    return;
  }

  selectedFile.value = file;
  previewUrl.value = window.URL.createObjectURL(file);
}

function clearSelected() {
  selectedFile.value = null;
  if (previewUrl.value) {
    window.URL.revokeObjectURL(previewUrl.value);
  }
  previewUrl.value = "";
}

async function submit() {
  if (!selectedFile.value) {
    return;
  }

  emit("submit-photo", selectedFile.value);
}
</script>

<template>
  <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <h2 class="text-lg font-semibold text-slate-900">Фотоотчет по монтажу</h2>
    <p class="mt-1 text-sm text-slate-500">Сделайте фото готового объекта и отправьте результат.</p>

    <label class="mt-4 block rounded-lg border-2 border-dashed border-slate-300 p-4 text-center text-sm text-slate-600">
      <input type="file" accept="image/*" capture="environment" class="hidden" @change="handleFileChange" />
      Выбрать или снять фото
    </label>

    <div v-if="previewUrl" class="mt-4 rounded-lg border border-slate-200 p-3">
      <img :src="previewUrl" alt="Предпросмотр фотоотчета" class="h-52 w-full rounded object-cover" />
      <button
        type="button"
        class="mt-3 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
        @click="clearSelected"
      >
        Удалить фото и переснять
      </button>
    </div>

    <button
      type="button"
      class="mt-4 w-full rounded-md px-4 py-3 text-sm font-semibold text-white"
      :class="canSubmit ? 'bg-green-600 hover:bg-green-700' : 'cursor-not-allowed bg-slate-400'"
      :disabled="!canSubmit"
      @click="submit"
    >
      <span v-if="isSubmitting" class="inline-flex items-center gap-2">
        <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        Отправка фото...
      </span>
      <span v-else>Завершить монтаж</span>
    </button>
  </section>
</template>
