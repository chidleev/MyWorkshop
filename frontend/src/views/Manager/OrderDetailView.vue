<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { deleteOrderMedia, fetchOrderMedia, type MediaFileDto, uploadMedia } from "../../api/media";
import {
  commitOrderSpecification,
  fetchOrderSpecification,
  previewOrderSpecification,
  uploadSpecification,
  patchOrderPricingMarkup,
  type SpecificationMutationResponse,
  type SpecificationResponseItem,
  type PricingMarkupMode,
} from "../../api/orders";
import { createInventoryMaterial } from "../../api/inventory";
import AppDataTable, { type DataTableColumn } from "../../components/Common/AppDataTable.vue";
import SpecificationUploader from "../../components/Orders/SpecificationUploader.vue";
import type { OrderStatus } from "../../types/order";
import { useManagerOrdersStore } from "../../stores/managerOrders";
import { showError, showSuccess } from "../../utils/notification";
import { isServerAvailable, SERVER_UNAVAILABLE_MESSAGE } from "../../utils/serverHealth";
import { resolveBackendAssetUrl } from "../../api/baseUrl";
import { formatDateTime, formatTime } from "../../utils/datetime";

const route = useRoute();
const orderId = computed(() => Number(route.params.id));
const ordersStore = useManagerOrdersStore();
const order = computed(() => ordersStore.findById(orderId.value));
const statusLabelMap: Record<OrderStatus, string> = {
  new: "Новый",
  in_production: "В производстве",
  ready_to_ship: "Готов к отгрузке",
  completed: "Завершен",
};

const specificationItems = ref<SpecificationResponseItem[]>([]);
const totalCost = ref<string>("0.00");
const materialsSubtotal = ref<string>("0.00");
const markupAmount = ref<string>("0.00");
const pricingMarkupMode = ref<PricingMarkupMode>("none");
const pricingMarkupValue = ref<string>("0");
const markupSaving = ref(false);
const uploadedFile = ref("");
const specificationLoading = ref(false);
const specificationFileInput = ref<HTMLInputElement | null>(null);
const specificationUploading = ref(false);
const specDraftActive = ref(false);
const specPreviewing = ref(false);
const specCommitting = ref(false);
const bulkMaterialDefaultCost = ref("");
const bulkCreating = ref(false);
const addMaterialTarget = ref<SpecificationResponseItem | null>(null);
const addMaterialName = ref("");
const addMaterialCost = ref("");
const renders = ref<MediaFileDto[]>([]);
const selectedRender = ref<string | null>(null);
const isUploadingRender = ref(false);
const deletingRenderId = ref<number | null>(null);
const rendersLoading = ref(false);
const rendersLoadError = ref("");
const rendersCollapsed = ref(true);
const specificationSectionTitle = computed(() =>
  specificationItems.value.length > 0 ? "Состав спецификации" : "Загрузка CSV-спецификации"
);
const canEditSpecification = computed(() => order.value?.status === "new");
const canEditMarkup = computed(() => canEditSpecification.value && !specDraftActive.value);

const markupModeOptions: { value: PricingMarkupMode; label: string; description: string }[] = [
  { value: "none", label: "Без наценки", description: "Цена клиенту равна сумме материалов по прайсу." },
  { value: "percent", label: "Процент к материалам", description: "Наценка: % от суммы материалов." },
  { value: "fixed", label: "Фиксированная сумма", description: "К сумме материалов добавляется фиксированная сумма (работа, доставка и т.д.)." },
  { value: "coefficient", label: "Коэффициент к сумме", description: "Итог = сумма материалов × коэффициент (например, 1,15 — +15%)." },
  {
    value: "margin_on_price",
    label: "Маржа в цене, %",
    description: "Целевая доля прибыли в итоговой цене продажи (маржа от выручки).",
  },
];

const markupValueLabel = computed(() => {
  switch (pricingMarkupMode.value) {
    case "percent":
      return "Процент, %";
    case "fixed":
      return "Сумма, ₽";
    case "coefficient":
      return "Коэффициент";
    case "margin_on_price":
      return "Маржа в цене, %";
    default:
      return "Значение";
  }
});

const markupValuePlaceholder = computed(() => {
  switch (pricingMarkupMode.value) {
    case "percent":
      return "Например, 25";
    case "fixed":
      return "Например, 15000";
    case "coefficient":
      return "Например, 1,2";
    case "margin_on_price":
      return "Например, 20";
    default:
      return "";
  }
});

function parseMarkupValueInput(): number {
  return Number(String(pricingMarkupValue.value).replace(",", "."));
}
const hasMissingSpecificationLines = computed(() =>
  specificationItems.value.some((item) => item.missing_material)
);
const showSpecificationActions = computed(
  () => canEditSpecification.value && specDraftActive.value && specificationItems.value.length > 0
);
const specificationTableColumns = computed<DataTableColumn[]>(() => {
  const base: DataTableColumn[] = [
    { key: "article", label: "Артикул", sortable: true },
    { key: "name", label: "Наименование", sortable: true },
    { key: "required_quantity", label: "Требуемое кол-во", sortable: true, align: "right" },
    { key: "unit_price", label: "Цена за ед.", sortable: true, align: "right" },
    { key: "amount", label: "Сумма", sortable: true, align: "right" },
  ];
  if (showSpecificationActions.value) {
    base.push({ key: "actions", label: "Действия", sortable: false, align: "right" });
  }
  return base;
});
const specificationTableRows = computed(
  () => specificationItems.value as unknown as Record<string, unknown>[]
);

onMounted(() => {
  void ordersStore.ensureLoaded();
  void loadRenders();
  void loadSpecification();
});

function applyMutationResponse(data: SpecificationMutationResponse) {
  specificationItems.value = data.items;
  totalCost.value = String(data.total_cost ?? "0.00");
  materialsSubtotal.value = String(data.materials_subtotal ?? "0.00");
  markupAmount.value = String(data.markup_amount ?? "0.00");
  pricingMarkupMode.value = data.pricing_markup_mode ?? "none";
  pricingMarkupValue.value = String(data.pricing_markup_value ?? "0");
  specDraftActive.value = !data.committed;
}

function handleUploadSuccess(payload: { data: SpecificationMutationResponse; filename: string }) {
  applyMutationResponse(payload.data);
  uploadedFile.value = payload.filename;
  void ordersStore.ensureLoaded(true);
}

function rowsPayloadFromItems(): Array<{ article: string; quantity: number }> {
  return specificationItems.value.map((line) => {
    const quantity = Number(String(line.required_quantity).replace(",", "."));
    return {
      article: line.article.trim(),
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 0,
    };
  });
}

async function refreshSpecificationPreview() {
  specPreviewing.value = true;
  try {
    const response = await previewOrderSpecification(orderId.value, rowsPayloadFromItems());
    applyMutationResponse(response.data);
  } catch {
    showError("Не удалось пересчитать спецификацию.");
  } finally {
    specPreviewing.value = false;
  }
}

async function loadSpecification() {
  specificationLoading.value = true;
  try {
    const response = await fetchOrderSpecification(orderId.value);
    specificationItems.value = response.data.items;
    totalCost.value = String(response.data.total_cost ?? "0.00");
    materialsSubtotal.value = String(response.data.materials_subtotal ?? "0.00");
    markupAmount.value = String(response.data.markup_amount ?? "0.00");
    pricingMarkupMode.value = response.data.pricing_markup_mode ?? "none";
    pricingMarkupValue.value = String(response.data.pricing_markup_value ?? "0");
    specDraftActive.value = false;
    await ordersStore.ensureLoaded(true);
  } catch {
    specificationItems.value = [];
    specDraftActive.value = false;
  } finally {
    specificationLoading.value = false;
  }
}

function openSpecificationPicker() {
  specificationFileInput.value?.click();
}

async function handleSpecificationReupload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!canEditSpecification.value) {
    input.value = "";
    showError("Спецификацию можно изменять только для заказа в статусе 'Новый'.");
    return;
  }
  specificationUploading.value = true;
  try {
    const response = await uploadSpecification(orderId.value, file);
    applyMutationResponse(response.data);
    uploadedFile.value = file.name;
    if (response.data.has_missing_materials) {
      showSuccess("Файл обработан. Устраните позиции без номенклатуры или сохраните после правок.");
    } else {
      showSuccess("Спецификация обновлена.");
    }
    await ordersStore.ensureLoaded(true);
  } catch {
    showError("Не удалось обновить спецификацию.");
  } finally {
    input.value = "";
    specificationUploading.value = false;
  }
}

function openAddMaterial(row: SpecificationResponseItem) {
  addMaterialTarget.value = row;
  addMaterialName.value = row.article;
  addMaterialCost.value = "";
}

function closeAddMaterial() {
  addMaterialTarget.value = null;
}

async function submitAddMaterial() {
  if (!addMaterialTarget.value) {
    return;
  }
  const cost = Number(String(addMaterialCost.value).replace(",", "."));
  if (!Number.isFinite(cost) || cost <= 0) {
    showError("Укажите цену больше нуля.");
    return;
  }
  try {
    await createInventoryMaterial({
      article: addMaterialTarget.value.article.trim(),
      name: addMaterialName.value.trim() || addMaterialTarget.value.article.trim(),
      base_cost: cost,
    });
    showSuccess("Позиция добавлена в номенклатуру.");
    closeAddMaterial();
    await refreshSpecificationPreview();
  } catch {
    showError("Не удалось создать позицию (возможно, дубликат артикула).");
  }
}

async function removeSpecificationLine(rowId: string) {
  specificationItems.value = specificationItems.value.filter((line) => line.row_id !== rowId);
  await refreshSpecificationPreview();
}

async function removeAllMissingLines() {
  const ok = window.confirm("Удалить все строки без номенклатуры из черновика?");
  if (!ok) {
    return;
  }
  specificationItems.value = specificationItems.value.filter((line) => !line.missing_material);
  await refreshSpecificationPreview();
}

async function bulkCreateMissingMaterials() {
  const cost = Number(String(bulkMaterialDefaultCost.value).replace(",", "."));
  if (!Number.isFinite(cost) || cost <= 0) {
    showError("Укажите корректную положительную цену для новых позиций.");
    return;
  }
  const missing = specificationItems.value.filter((line) => line.missing_material);
  if (missing.length === 0) {
    return;
  }
  bulkCreating.value = true;
  try {
    for (const line of missing) {
      await createInventoryMaterial({
        article: line.article.trim(),
        name: line.article.trim(),
        base_cost: cost,
      });
    }
    showSuccess("Номенклатура создана для всех проблемных строк.");
    await refreshSpecificationPreview();
    await ordersStore.ensureLoaded(true);
  } catch {
    showError("Не удалось создать все позиции (проверьте дубликаты артикулов).");
  } finally {
    bulkCreating.value = false;
  }
}

async function commitSpecificationDraft() {
  if (hasMissingSpecificationLines.value) {
    showError("Сохранение недоступно, пока есть строки без номенклатуры.");
    return;
  }
  specCommitting.value = true;
  try {
    const response = await commitOrderSpecification(orderId.value, rowsPayloadFromItems());
    applyMutationResponse(response.data);
    showSuccess("Спецификация сохранена в заказе.");
    await ordersStore.ensureLoaded(true);
  } catch {
    showError("Не удалось сохранить спецификацию.");
  } finally {
    specCommitting.value = false;
  }
}

async function submitPricingMarkup() {
  if (!canEditMarkup.value) {
    return;
  }
  const n = parseMarkupValueInput();
  if (pricingMarkupMode.value !== "none" && !Number.isFinite(n)) {
    showError("Введите корректное число.");
    return;
  }
  if (pricingMarkupMode.value === "coefficient" && n <= 0) {
    showError("Коэффициент должен быть больше нуля.");
    return;
  }
  if (pricingMarkupMode.value === "margin_on_price" && (n < 0 || n >= 100)) {
    showError("Маржа в цене должна быть от 0 до 100 (не включая 100).");
    return;
  }
  if (
    (pricingMarkupMode.value === "percent" || pricingMarkupMode.value === "fixed") &&
    n < 0
  ) {
    showError("Значение не может быть отрицательным.");
    return;
  }
  markupSaving.value = true;
  try {
    const response = await patchOrderPricingMarkup(orderId.value, {
      pricing_markup_mode: pricingMarkupMode.value,
      pricing_markup_value: pricingMarkupMode.value === "none" ? 0 : n,
    });
    materialsSubtotal.value = response.data.materials_subtotal;
    markupAmount.value = response.data.markup_amount;
    totalCost.value = response.data.total_cost;
    pricingMarkupMode.value = response.data.pricing_markup_mode;
    pricingMarkupValue.value = response.data.pricing_markup_value;
    showSuccess("Наценка сохранена.");
    await ordersStore.ensureLoaded(true);
  } catch {
    showError("Не удалось сохранить наценку.");
  } finally {
    markupSaving.value = false;
  }
}

function specificationRowClass(row: Record<string, unknown>) {
  return row.missing_material ? "bg-amber-50/80" : "";
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
    renders.value = [];
    rendersLoadError.value = SERVER_UNAVAILABLE_MESSAGE;
    rendersLoading.value = false;
    return;
  }
  try {
    const response = await fetchOrderMedia(orderId.value, "Рендер");
    renders.value = response.data;
  } catch {
    renders.value = [];
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

async function handleRenderDelete(media: MediaFileDto) {
  const shouldDelete = window.confirm("Удалить этот рендер?");
  if (!shouldDelete) {
    return;
  }

  deletingRenderId.value = media.id;
  try {
    await deleteOrderMedia(orderId.value, media.id);
    if (selectedRender.value === resolveBackendAssetUrl(media.secure_link)) {
      selectedRender.value = null;
    }
    await loadRenders();
    showSuccess("Рендер удален.");
  } catch {
    showError("Не удалось удалить рендер.");
  } finally {
    deletingRenderId.value = null;
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
            <div class="min-w-[240px] flex-[1.5] break-words">
              <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Адрес объекта</p>
              <p class="mt-0.5 text-sm font-medium text-slate-900">{{ order.address || "Не указан" }}</p>
            </div>
            <div class="shrink-0">
              <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
                Дата и время сдачи
              </p>
              <p class="mt-0.5 text-sm font-medium text-slate-900">
                {{ formatDateTime(order.target_date) }}
              </p>
            </div>
            <div class="shrink-0">
              <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Время монтажа</p>
              <p class="mt-0.5 text-sm font-medium text-slate-900">
                {{ formatTime(order.target_date) }}
              </p>
            </div>
            <div class="shrink-0">
              <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Статус</p>
              <p class="mt-0.5 text-sm font-medium text-slate-900">
                {{ statusLabelMap[order.status] }}
              </p>
            </div>
            <div class="shrink-0">
              <p class="text-xs font-medium uppercase tracking-wide text-slate-500">ID заказа</p>
              <p class="mt-0.5 text-sm font-medium text-slate-900">{{ orderId }}</p>
            </div>
          </div>
        </header>

        <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-lg font-semibold text-slate-900">Рендеры проекта</h2>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                @click="rendersCollapsed = !rendersCollapsed"
              >
                {{ rendersCollapsed ? "Развернуть" : "Свернуть" }}
              </button>
              <label
                class="cursor-pointer rounded-md border border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-blue-50"
                :class="{ 'pointer-events-none opacity-60': isUploadingRender }"
              >
                {{ isUploadingRender ? "Загрузка..." : "Загрузить рендеры" }}
                <input
                  class="hidden"
                  type="file"
                  accept="image/*"
                  multiple
                  @change="handleRenderUpload"
                />
              </label>
            </div>
          </div>

          <div
            v-if="!rendersCollapsed && rendersLoading"
            class="mt-4 rounded-md bg-slate-50 p-6 text-sm text-slate-500"
          >
            Загрузка рендеров...
          </div>
          <div
            v-else-if="!rendersCollapsed && rendersLoadError"
            class="mt-4 rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-700"
          >
            {{ rendersLoadError }}
          </div>
          <div
            v-else-if="!rendersCollapsed && renders.length === 0"
            class="mt-4 rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500"
          >
            Рендеры еще не загружены.
          </div>
          <div v-else-if="!rendersCollapsed" class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <button
              v-for="image in renders"
              :key="image.id"
              type="button"
              class="relative overflow-hidden rounded-lg border border-slate-200"
              @click="selectedRender = resolveBackendAssetUrl(image.secure_link)"
            >
              <img
                :src="resolveBackendAssetUrl(image.secure_link)"
                alt="Рендер проекта"
                class="h-28 w-full object-cover sm:h-32"
              />
              <button
                type="button"
                class="absolute right-2 top-2 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-danger hover:bg-white"
                :class="{ 'pointer-events-none opacity-60': deletingRenderId === image.id }"
                @click.stop="handleRenderDelete(image)"
              >
                {{ deletingRenderId === image.id ? "..." : "Удалить" }}
              </button>
            </button>
          </div>
        </section>

        <section class="rounded-xl border border-primary/30 bg-primary/10 p-4 shadow-sm">
          <h2 class="text-base font-semibold text-slate-900">Стоимость и наценка</h2>
          <dl class="mt-3 space-y-2 text-sm text-slate-700">
            <div class="flex justify-between gap-4">
              <dt>Сумма материалов по прайсу</dt>
              <dd class="shrink-0 font-medium text-slate-900">{{ formatCurrency(materialsSubtotal) }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt>Наценка</dt>
              <dd class="shrink-0 font-medium text-slate-900">{{ formatCurrency(markupAmount) }}</dd>
            </div>
          </dl>
          <p class="mt-3 border-t border-primary/20 pt-3 text-xs leading-relaxed text-slate-600">
            В отчётах прибыль считается как цена клиенту минус закуп материалов по складу; наценка повышает
            цену клиенту при той же себестоимости материалов.
          </p>
          <p class="mt-3 text-xs font-medium uppercase tracking-wide text-primary">К оплате клиенту</p>
          <p class="mt-0.5 text-2xl font-bold text-primary">{{ formatCurrency(totalCost) }}</p>

          <div v-if="canEditSpecification" class="mt-4 rounded-lg border border-primary/20 bg-white/70 p-3">
            <p
              v-if="!canEditMarkup"
              class="mb-3 rounded-md border border-amber-200 bg-amber-50/90 p-2 text-xs text-amber-900"
            >
              Сохраните спецификацию в заказе, чтобы зафиксировать наценку в базе. Пока открыт черновик,
              суммы выше — предпросмотр по таблице и последним сохранённым настройкам.
            </p>
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="block text-xs font-medium text-slate-700">
                Способ наценки к сумме материалов
                <select
                  v-model="pricingMarkupMode"
                  class="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
                  :disabled="!canEditMarkup"
                >
                  <option v-for="opt in markupModeOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </label>
              <label class="block text-xs font-medium text-slate-700">
                {{ markupValueLabel }}
                <input
                  v-model="pricingMarkupValue"
                  type="text"
                  inputmode="decimal"
                  class="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
                  :disabled="!canEditMarkup || pricingMarkupMode === 'none'"
                  :placeholder="markupValuePlaceholder"
                />
              </label>
            </div>
            <p class="mt-2 text-xs text-slate-500">
              {{ markupModeOptions.find((o) => o.value === pricingMarkupMode)?.description }}
            </p>
            <button
              type="button"
              class="mt-3 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              :disabled="!canEditMarkup || markupSaving"
              @click="submitPricingMarkup"
            >
              {{ markupSaving ? "Сохранение..." : "Применить наценку" }}
            </button>
          </div>
        </section>

        <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-lg font-semibold text-slate-900">{{ specificationSectionTitle }}</h2>
            <p v-if="uploadedFile" class="text-xs text-slate-500">Источник: {{ uploadedFile }}</p>
            <div v-if="specificationItems.length > 0 && canEditSpecification" class="flex items-center gap-2">
              <button
                type="button"
                class="rounded-md border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-blue-50"
                :class="{ 'pointer-events-none opacity-60': specificationUploading }"
                @click="openSpecificationPicker"
              >
                {{ specificationUploading ? "Обновление..." : "Перезагрузить CSV" }}
              </button>
              <input
                ref="specificationFileInput"
                type="file"
                accept=".csv,text/csv"
                class="hidden"
                @change="handleSpecificationReupload"
              />
            </div>
          </div>

          <div
            v-if="specificationLoading"
            class="mt-4 rounded-md bg-slate-50 p-6 text-sm text-slate-500"
          >
            Загрузка спецификации...
          </div>

          <p v-else-if="specificationItems.length === 0" class="mt-1 text-sm text-slate-500">
            Поддерживаются CSV-файлы до 2000 строк.
          </p>
          <p
            v-if="!canEditSpecification"
            class="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700"
          >
            Изменение спецификации недоступно после запуска производства.
          </p>
          <p
            v-else-if="specDraftActive"
            class="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
          >
            Черновик спецификации ещё не сохранён в заказе. Устраните позиции без номенклатуры или удалите их,
            затем нажмите «Сохранить спецификацию в заказ».
          </p>

          <SpecificationUploader
            v-if="!specificationLoading && specificationItems.length === 0 && canEditSpecification"
            :order-id="orderId"
            :show-header="false"
            @upload-success="handleUploadSuccess"
          />

          <div
            v-if="
              !specificationLoading &&
              specificationItems.length > 0 &&
              canEditSpecification &&
              specDraftActive &&
              hasMissingSpecificationLines
            "
            class="mt-4 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-sm text-slate-800 sm:flex-row sm:flex-wrap sm:items-end"
          >
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                :disabled="specPreviewing || bulkCreating"
                @click="removeAllMissingLines"
              >
                Удалить все проблемные строки
              </button>
            </div>
            <div class="flex flex-1 flex-wrap items-end gap-2 sm:justify-end">
              <label class="flex min-w-[200px] flex-col text-xs font-medium text-slate-600">
                Цена для массового добавления (₽)
                <input
                  v-model="bulkMaterialDefaultCost"
                  type="text"
                  inputmode="decimal"
                  class="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                  placeholder="Например, 1500"
                />
              </label>
              <button
                type="button"
                class="rounded-md bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                :disabled="specPreviewing || bulkCreating"
                @click="bulkCreateMissingMaterials"
              >
                {{ bulkCreating ? "Создание..." : "Добавить все в номенклатуру" }}
              </button>
            </div>
          </div>

          <p v-if="specPreviewing" class="mt-2 text-xs text-slate-500">Пересчёт спецификации...</p>

          <AppDataTable
            v-if="!specificationLoading && specificationItems.length > 0"
            :rows="specificationTableRows"
            :columns="specificationTableColumns"
            :row-key="(row) => String(row.row_id ?? row.article)"
            :row-class="specificationRowClass"
            initial-sort-key="amount"
            initial-sort-order="desc"
          >
            <template #cell-article="{ row }">
              <input
                v-if="
                  row.missing_material && canEditSpecification && specDraftActive
                "
                v-model="row.article"
                type="text"
                class="w-full min-w-[120px] rounded-md border border-slate-300 px-2 py-1 text-sm"
                @blur="refreshSpecificationPreview"
              />
              <span v-else>{{ row.article }}</span>
            </template>
            <template #cell-required_quantity="{ row }">
              {{ row.required_quantity }}
            </template>
            <template #cell-unit_price="{ row }">
              {{ row.unit_price === "" ? "—" : row.unit_price }}
            </template>
            <template #cell-amount="{ row }">
              <span class="font-medium">{{ row.amount === "" ? "—" : row.amount }}</span>
            </template>
            <template #cell-actions="{ row }">
              <div class="flex flex-wrap justify-end gap-1">
                <button
                  v-if="row.missing_material"
                  type="button"
                  class="rounded-md border border-primary px-2 py-1 text-xs font-medium text-primary hover:bg-blue-50"
                  @click="openAddMaterial(row as unknown as SpecificationResponseItem)"
                >
                  В БД
                </button>
                <button
                  type="button"
                  class="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  @click="removeSpecificationLine(String(row.row_id))"
                >
                  Удалить
                </button>
              </div>
            </template>
          </AppDataTable>

          <div
            v-if="
              !specificationLoading &&
              specificationItems.length > 0 &&
              canEditSpecification &&
              specDraftActive
            "
            class="mt-4 flex flex-wrap items-center gap-3"
          >
            <button
              type="button"
              class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              :disabled="specCommitting || hasMissingSpecificationLines || specPreviewing"
              @click="commitSpecificationDraft"
            >
              {{ specCommitting ? "Сохранение..." : "Сохранить спецификацию в заказ" }}
            </button>
            <span v-if="hasMissingSpecificationLines" class="text-xs text-amber-700">
              Сохранение недоступно, пока есть строки без номенклатуры.
            </span>
          </div>
        </section>

        <div
          v-if="addMaterialTarget"
          class="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/70 p-4"
          @click.self="closeAddMaterial"
        >
          <div class="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
            <h3 class="text-lg font-semibold text-slate-900">Добавить в номенклатуру</h3>
            <p class="mt-1 text-xs text-slate-500">Артикул: {{ addMaterialTarget.article }}</p>
            <label class="mt-4 block text-sm font-medium text-slate-700">
              Наименование
              <input
                v-model="addMaterialName"
                type="text"
                class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label class="mt-3 block text-sm font-medium text-slate-700">
              Базовая цена (₽)
              <input
                v-model="addMaterialCost"
                type="text"
                inputmode="decimal"
                class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <div class="mt-5 flex justify-end gap-2">
              <button
                type="button"
                class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                @click="closeAddMaterial"
              >
                Отмена
              </button>
              <button
                type="button"
                class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                @click="submitAddMaterial"
              >
                Создать
              </button>
            </div>
          </div>
        </div>

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
            <img
              :src="selectedRender"
              alt="Увеличенный рендер проекта"
              class="max-h-[85vh] rounded-lg object-contain"
            />
          </div>
        </div>
      </div>
    </section>

    <section
      v-else
      class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm"
    >
      Заказ не найден или был удален.
    </section>
  </div>
</template>
