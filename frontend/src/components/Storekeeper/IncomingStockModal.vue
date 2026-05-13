<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { InventoryItem } from "../../api/inventory";

const props = defineProps<{
  isOpen: boolean;
  materials: InventoryItem[];
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "submit", payload: { materialId: number; quantity: number }): void;
}>();

const selectedMaterialId = ref<number | null>(null);
const quantity = ref("");

const normalizedQuantity = computed(() => quantity.value.replace(",", ".").trim());
const quantityNumber = computed(() => Number.parseFloat(normalizedQuantity.value));
const isValid = computed(() => {
  return (
    selectedMaterialId.value !== null &&
    normalizedQuantity.value.length > 0 &&
    Number.isFinite(quantityNumber.value) &&
    quantityNumber.value > 0
  );
});

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      selectedMaterialId.value = props.materials[0]?.id ?? null;
      quantity.value = "";
    }
  }
);

function submit() {
  if (!isValid.value) {
    return;
  }
  emit("submit", { materialId: selectedMaterialId.value as number, quantity: quantityNumber.value });
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4">
      <section class="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
      <h3 class="text-lg font-semibold text-slate-900">Оформить приход</h3>

      <form class="mt-4 space-y-4" @submit.prevent="submit">
        <div>
          <label class="block text-sm font-medium text-slate-700">Номенклатура</label>
          <select
            v-model.number="selectedMaterialId"
            class="mt-1 w-full rounded-md border-slate-300 text-sm focus:border-primary focus:ring-primary"
          >
            <option value="" disabled>Выберите материал</option>
            <option v-for="item in materials" :key="item.id" :value="item.id">
              {{ item.article }} — {{ item.name }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700">Количество</label>
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
        </div>

        <div class="flex justify-end gap-2 pt-1">
          <button
            type="button"
            class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            @click="emit('close')"
          >
            Отмена
          </button>
          <button
            type="submit"
            class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            :disabled="!isValid"
          >
            Сохранить
          </button>
        </div>
      </form>
      </section>
    </div>
  </Teleport>
</template>
