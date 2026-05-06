<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { MaterialItem } from "../../stores/workshopData";

const props = defineProps<{
  isOpen: boolean;
  materials: MaterialItem[];
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "submit", payload: { article: string; quantity: number }): void;
}>();

const selectedArticle = ref("");
const quantity = ref("");

const normalizedQuantity = computed(() => quantity.value.replace(",", ".").trim());
const quantityNumber = computed(() => Number.parseFloat(normalizedQuantity.value));
const isValid = computed(() => {
  return (
    Boolean(selectedArticle.value) &&
    normalizedQuantity.value.length > 0 &&
    Number.isFinite(quantityNumber.value) &&
    quantityNumber.value > 0
  );
});

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      selectedArticle.value = props.materials[0]?.article ?? "";
      quantity.value = "";
    }
  }
);

function submit() {
  if (!isValid.value) {
    return;
  }
  emit("submit", { article: selectedArticle.value, quantity: quantityNumber.value });
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
    <section class="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
      <h3 class="text-lg font-semibold text-slate-900">Оформить приход</h3>

      <label class="mt-4 block text-sm font-medium text-slate-700">Номенклатура</label>
      <select
        v-model="selectedArticle"
        class="mt-1 w-full rounded-md border-slate-300 text-sm focus:border-primary focus:ring-primary"
      >
        <option value="" disabled>Выберите материал</option>
        <option v-for="item in materials" :key="item.article" :value="item.article">
          {{ item.article }} — {{ item.name }}
        </option>
      </select>

      <label class="mt-4 block text-sm font-medium text-slate-700">Количество</label>
      <input
        v-model="quantity"
        type="text"
        inputmode="decimal"
        placeholder="Например: 12.500"
        class="mt-1 w-full rounded-md border-slate-300 text-sm focus:border-primary focus:ring-primary"
      />
      <p
        v-if="normalizedQuantity.length > 0 && (!Number.isFinite(quantityNumber) || quantityNumber <= 0)"
        class="mt-1 text-xs text-danger"
      >
        Введите положительное количество.
      </p>

      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
          @click="emit('close')"
        >
          Отмена
        </button>
        <button
          type="button"
          class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          :disabled="!isValid"
          @click="submit"
        >
          Сохранить
        </button>
      </div>
    </section>
  </div>
</template>
