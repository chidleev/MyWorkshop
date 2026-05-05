<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import SpecificationUploader, {
  type SpecificationItem,
} from "../../components/Orders/SpecificationUploader.vue";

const route = useRoute();
const orderId = computed(() => Number(route.params.id));

const orderMeta = computed(() => ({
  agreement_number: `MM-2026-${String(orderId.value).padStart(3, "0")}`,
  client_name: "Клиент по договору",
  status: "В обработке",
}));

const specificationItems = ref<SpecificationItem[]>([]);
const totalCost = ref<string>("0.00");
const uploadedFile = ref("");

function handleUploadSuccess(payload: {
  items: SpecificationItem[];
  totalCost: string;
  filename: string;
}) {
  specificationItems.value = payload.items;
  totalCost.value = payload.totalCost;
  uploadedFile.value = payload.filename;
}

function formatCurrency(amount: string) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}
</script>

<template>
  <section class="space-y-4">
    <header class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h1 class="text-xl font-semibold text-slate-900">
        Детализация заказа {{ orderMeta.agreement_number }}
      </h1>
      <div class="mt-2 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
        <p><span class="font-medium">Клиент:</span> {{ orderMeta.client_name }}</p>
        <p><span class="font-medium">Статус:</span> {{ orderMeta.status }}</p>
        <p><span class="font-medium">ID заказа:</span> {{ orderId }}</p>
      </div>
    </header>

    <SpecificationUploader @upload-success="handleUploadSuccess" />

    <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-lg font-semibold text-slate-900">Состав спецификации</h2>
        <p v-if="uploadedFile" class="text-xs text-slate-500">Источник: {{ uploadedFile }}</p>
      </div>

      <div v-if="specificationItems.length === 0" class="mt-4 rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500">
        Спецификация пока не загружена.
      </div>

      <div v-else class="mt-4 overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-100 text-slate-700">
            <tr>
              <th class="px-3 py-2 text-left">Артикул</th>
              <th class="px-3 py-2 text-left">Наименование</th>
              <th class="px-3 py-2 text-right">Требуемое кол-во</th>
              <th class="px-3 py-2 text-right">Цена за ед.</th>
              <th class="px-3 py-2 text-right">Сумма</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in specificationItems"
              :key="`${item.article}-${item.name}`"
              class="border-b border-slate-200 last:border-0"
            >
              <td class="px-3 py-2">{{ item.article }}</td>
              <td class="px-3 py-2">{{ item.name }}</td>
              <td class="px-3 py-2 text-right">{{ item.required_quantity }}</td>
              <td class="px-3 py-2 text-right">{{ item.unit_price }}</td>
              <td class="px-3 py-2 text-right font-medium">{{ item.amount }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="rounded-xl border border-primary/30 bg-primary/10 p-4 shadow-sm">
      <p class="text-sm text-slate-700">Итоговая стоимость заказа</p>
      <p class="mt-1 text-2xl font-bold text-primary">{{ formatCurrency(totalCost) }}</p>
    </section>
  </section>
</template>
