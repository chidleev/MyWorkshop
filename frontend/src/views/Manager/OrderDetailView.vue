<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { fetchOrderMedia, uploadMedia } from "../../api/media";
import SpecificationUploader, {
  type SpecificationItem,
} from "../../components/Orders/SpecificationUploader.vue";
import type { OrderStatus } from "../../types/order";
import { useManagerOrdersStore } from "../../stores/managerOrders";
import { showError, showSuccess } from "../../utils/notification";
import { isServerAvailable, SERVER_UNAVAILABLE_MESSAGE } from "../../utils/serverHealth";

const route = useRoute();
const orderId = computed(() => Number(route.params.id));
const ordersStore = useManagerOrdersStore();

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
const renderUrls = ref<string[]>([]);
const selectedRender = ref<string | null>(null);
const isUploadingRender = ref(false);
const rendersLoading = ref(false);
const rendersLoadError = ref("");

function resolveMediaUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return path;
}

onMounted(() => {
  void ordersStore.ensureLoaded();
  void loadRenders();
});

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

async function loadRenders() {
  rendersLoading.value = true;
  rendersLoadError.value = "";
  if (!(await isServerAvailable())) {
    renderUrls.value = [];
    rendersLoadError.value = SERVER_UNAVAILABLE_MESSAGE;
    rendersLoading.value = false;
    return;
  }
  try {
    const response = await fetchOrderMedia(orderId.value, "Рендер");
    renderUrls.value = response.data.map((item) => resolveMediaUrl(item.secure_link));
  } catch {
    renderUrls.value = [];
    rendersLoadError.value = "Не удалось загрузить рендеры заказа.";
  } finally {
    rendersLoading.value = false;
  }
}

async function handleRenderUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = input.files;
  if (!files || files.length === 0) {
    return;
  }

  isUploadingRender.value = true;
  try {
    for (const file of Array.from(files)) {
      await uploadMedia(orderId.value, file, "Рендер");
    }
    await loadRenders();
    showSuccess("Рендеры успешно загружены.");
  } catch {
    showError("Не удалось загрузить один или несколько рендеров.");
  } finally {
    input.value = "";
    isUploadingRender.value = false;
  }
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

      <SpecificationUploader :order-id="orderId" @upload-success="handleUploadSuccess" />

      <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold text-slate-900">Рендеры проекта</h2>
          <label
            class="cursor-pointer rounded-md border border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-blue-50"
            :class="{ 'pointer-events-none opacity-60': isUploadingRender }"
          >
            {{ isUploadingRender ? "Загрузка..." : "Загрузить рендеры" }}
            <input class="hidden" type="file" accept="image/*" multiple @change="handleRenderUpload" />
          </label>
        </div>

        <div v-if="rendersLoading" class="mt-4 rounded-md bg-slate-50 p-6 text-sm text-slate-500">
          Загрузка рендеров...
        </div>
        <div
          v-else-if="rendersLoadError"
          class="mt-4 rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-700"
        >
          {{ rendersLoadError }}
        </div>
        <div v-else-if="renderUrls.length === 0" class="mt-4 rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          Рендеры еще не загружены.
        </div>
        <div v-else class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <button
            v-for="image in renderUrls"
            :key="image"
            type="button"
            class="overflow-hidden rounded-lg border border-slate-200"
            @click="selectedRender = image"
          >
            <img :src="image" alt="Рендер проекта" class="h-28 w-full object-cover sm:h-32" />
          </button>
        </div>
      </section>

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

      <div
        v-if="selectedRender"
        class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/80 p-4"
        @click.self="selectedRender = null"
      >
        <div class="relative max-w-4xl">
          <button
            type="button"
            class="absolute right-2 top-2 rounded-md bg-white/90 px-2 py-1 text-sm"
            @click="selectedRender = null"
          >
            ✕
          </button>
          <img :src="selectedRender" alt="Увеличенный рендер проекта" class="max-h-[85vh] rounded-lg object-contain" />
        </div>
      </div>
      </div>
    </section>

    <section v-else class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
      Заказ не найден или был удален.
    </section>
  </div>
</template>
