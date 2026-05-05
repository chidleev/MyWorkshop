<script setup lang="ts">
import { ref } from "vue";

export interface SpecificationItem {
  article: string;
  name: string;
  required_quantity: string;
  unit_price: string;
  amount: string;
}

const emit = defineEmits<{
  (
    event: "upload-success",
    payload: { items: SpecificationItem[]; totalCost: string; filename: string }
  ): void;
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const selectedFileName = ref("");
const isDragging = ref(false);
const isUploading = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

function resetMessages() {
  errorMessage.value = "";
  successMessage.value = "";
}

function isCsv(file: File) {
  return file.name.toLowerCase().endsWith(".csv");
}

function processFile(file: File) {
  resetMessages();

  if (!isCsv(file)) {
    errorMessage.value = "HTTP 400 Bad Request: Некорректный формат файла.";
    return;
  }

  selectedFileName.value = file.name;
  isUploading.value = true;

  const formData = new FormData();
  formData.append("specification", file);
  console.log("Specification formData:", formData.get("specification"));

  setTimeout(() => {
    const mockItems: SpecificationItem[] = [
      {
        article: "DSP-16-WHITE",
        name: "ЛДСП белый 16 мм",
        required_quantity: "6.50",
        unit_price: "1850.00",
        amount: "12025.00",
      },
      {
        article: "EDGE-PVC-2",
        name: "Кромка ПВХ 2 мм",
        required_quantity: "42.00",
        unit_price: "38.50",
        amount: "1617.00",
      },
      {
        article: "HINGE-BLUM",
        name: "Петля Blum Clip-Top",
        required_quantity: "12.00",
        unit_price: "250.00",
        amount: "3000.00",
      },
    ];

    const total = mockItems
      .reduce((sum, item) => sum + Number.parseFloat(item.amount), 0)
      .toFixed(2);

    isUploading.value = false;
    successMessage.value = "Спецификация успешно загружена и обработана.";
    emit("upload-success", { items: mockItems, totalCost: total, filename: file.name });
  }, 1200);
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) {
    return;
  }

  processFile(file);
}

function openPicker() {
  fileInput.value?.click();
}

function onDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (!file) {
    return;
  }
  processFile(file);
}
</script>

<template>
  <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <h3 class="text-lg font-semibold text-slate-900">Загрузка CSV-спецификации</h3>
    <p class="mt-1 text-sm text-slate-500">Поддерживаются CSV-файлы до 2000 строк.</p>

    <div
      class="mt-4 rounded-lg border-2 border-dashed p-6 text-center transition"
      :class="isDragging ? 'border-primary bg-blue-50' : 'border-slate-300 bg-slate-50'"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop="onDrop"
    >
      <p class="text-sm text-slate-600">Перетащите CSV-файл сюда или выберите вручную</p>
      <button
        type="button"
        class="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        @click="openPicker"
      >
        Выбрать файл
      </button>
      <input
        ref="fileInput"
        type="file"
        accept=".csv,text/csv"
        class="hidden"
        @change="handleFileChange"
      />
      <p v-if="selectedFileName" class="mt-3 text-xs text-slate-500">Выбран файл: {{ selectedFileName }}</p>
    </div>

    <div v-if="isUploading" class="mt-4 flex items-center gap-2 text-sm text-primary">
      <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <span>Идет загрузка и парсинг...</span>
    </div>
    <p v-if="errorMessage" class="mt-3 text-sm text-danger">{{ errorMessage }}</p>
    <p v-if="successMessage" class="mt-3 text-sm text-success">{{ successMessage }}</p>
  </section>
</template>
