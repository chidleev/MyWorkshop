<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import SpecificationUploader, {
  type SpecificationItem,
} from "../../components/Orders/SpecificationUploader.vue";
import type { OrderStatus } from "../../types/order";
import { useManagerOrdersStore } from "../../stores/managerOrders";

const route = useRoute();
const orderId = computed(() => Number(route.params.id));
const ordersStore = useManagerOrdersStore();
ordersStore.ensureLoaded();

const order = computed(() => ordersStore.findById(orderId.value));
const statusLabelMap: Record<OrderStatus, string> = {
  new: "В обработке",
  cutting: "Распил",
  edging: "Кромление",
  assembly: "Сборка",
  ready_to_ship: "Готов к отгрузке"
};

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
  <div>
    <section v-if="order" class="space-y-4">
      <div class="min-w-0 space-y-4">
        <header class="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
          <h1 class="break-words text-xl font-semibold text-slate-900 sm:text-2xl">
            Детализация заказа <span class="break-all">{{ order.agreement_number }}</span>
          </h1>
          <div class="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:gap-6">
            <div class="min-w-[200px] flex-1 break-words">
              <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Клиент</p>
              <p class="mt-0.5 text-sm font-medium text-slate-900">{{ order.full_name }}</p>
            </div>
            <div class="shrink-0">
              <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Статус</p>
              <p class="mt-0.5 text-sm font-medium text-slate-900">{{ statusLabelMap[order.status] }}</p>
            </div>
            <div class="shrink-0">
              <p class="text-xs font-medium uppercase tracking-wide text-slate-500">ID заказа</p>
              <p class="mt-0.5 text-sm font-medium text-slate-900">{{ orderId }}</p>
            </div>
          </div>
        </header>

      <section class="rounded-xl border border-primary/30 bg-primary/10 p-4 shadow-sm">
        <p class="text-sm text-slate-700">Итоговая стоимость заказа</p>
        <p class="mt-1 text-2xl font-bold text-primary">{{ formatCurrency(totalCost) }}</p>
      </section>

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
      </div>
    </section>

    <section v-else class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
      Заказ не найден или был удален.
    </section>
  </div>
</template>
