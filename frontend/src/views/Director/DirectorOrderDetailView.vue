<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  fetchDirectorOrderDetails,
  regenerateDirectorOrderDocuments,
  type DirectorOrderDetailsResponse,
} from "../../api/director";
import AppDataTable, { type DataTableColumn } from "../../components/Common/AppDataTable.vue";
import { resolveBackendAssetUrl } from "../../api/baseUrl";
import { formatDateTime } from "../../utils/datetime";
import { isServerAvailable, SERVER_UNAVAILABLE_MESSAGE } from "../../utils/serverHealth";
import { showError, showSuccess } from "../../utils/notification";

const route = useRoute();
const router = useRouter();

const orderId = computed(() => Number(route.params.id));

const payload = ref<DirectorOrderDetailsResponse | null>(null);
const loading = ref(true);
const loadError = ref("");
const regeneratingDocs = ref(false);
/** История этапов по умолчанию свёрнута, чтобы не занимать экран. */
const historyCollapsed = ref(true);

const specColumns: DataTableColumn[] = [
  { key: "article", label: "Артикул", sortable: true },
  { key: "name", label: "Материал", sortable: true },
  { key: "required_quantity", label: "Кол-во", sortable: true, align: "right" },
  { key: "sale_price", label: "Сумма", sortable: true, align: "right" },
];

const order = computed(() => payload.value?.order ?? null);
const historyEntries = computed(() => payload.value?.status_histories ?? []);
const specRows = computed(() => (payload.value?.specification ?? []) as unknown as Record<string, unknown>[]);

function formatManagerName(employeeId: string) {
  if (employeeId === "system_web_lead") return "Заявка с сайта";
  return employeeId;
}

function formatMoney(value?: string | null) {
  if (!value) return "Не рассчитана";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

/** Превью-картинка только для изображений; PDF и прочее — плитка со ссылкой «Открыть». */
function mediaPreviewIsImage(secureLink: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(secureLink.trim());
}

function mediaPreviewIsPdf(secureLink: string): boolean {
  return /\.pdf$/i.test(secureLink.trim());
}

async function load() {
  if (!Number.isFinite(orderId.value) || orderId.value <= 0) {
    loadError.value = "Некорректный номер заказа.";
    payload.value = null;
    loading.value = false;
    return;
  }

  loading.value = true;
  loadError.value = "";
  payload.value = null;

  if (!(await isServerAvailable())) {
    loadError.value = SERVER_UNAVAILABLE_MESSAGE;
    loading.value = false;
    return;
  }

  try {
    const response = await fetchDirectorOrderDetails(orderId.value);
    payload.value = response.data;
  } catch {
    loadError.value = "Не удалось загрузить заказ.";
  } finally {
    loading.value = false;
  }
}

function extractApiErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const data = (err as { response?: { data?: { message?: string } } }).response?.data;
    if (data?.message && String(data.message).trim()) {
      return String(data.message).trim();
    }
  }
  return fallback;
}

async function regenerateClosingDocuments() {
  if (!Number.isFinite(orderId.value) || orderId.value <= 0) {
    return;
  }
  regeneratingDocs.value = true;
  try {
    await regenerateDirectorOrderDocuments(orderId.value);
    showSuccess("Чек и акт пересозданы и обновлены в списке файлов.");
    await load();
  } catch (err) {
    showError(extractApiErrorMessage(err, "Не удалось пересоздать документы."));
  } finally {
    regeneratingDocs.value = false;
  }
}

function goBack() {
  void router.push({ name: "director-monitoring" });
}

watch(orderId, () => {
  void load();
});

onMounted(() => {
  void load();
});
</script>

<template>
  <section class="space-y-4">
    <header class="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="min-w-0">
        <button
          type="button"
          class="mb-2 text-sm font-medium text-primary hover:text-blue-800"
          @click="goBack"
        >
          ← Назад к мониторингу
        </button>
        <template v-if="order">
          <h1 class="break-words text-xl font-semibold text-slate-900">
            Заказ <span class="break-all">{{ order.agreement_number }}</span>
          </h1>
          <p class="mt-1 text-sm text-slate-500">Внутренний ID: {{ order.id }}</p>
        </template>
        <template v-else-if="!loading && loadError">
          <h1 class="text-xl font-semibold text-slate-900">Заказ</h1>
        </template>
      </div>
    </header>

    <div v-if="loading" class="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
      Загрузка данных заказа...
    </div>

    <div
      v-else-if="loadError"
      class="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm"
    >
      {{ loadError }}
    </div>

    <template v-else-if="order && payload">
      <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Основные данные</h2>
        <dl class="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt class="text-slate-500">Клиент</dt>
            <dd class="mt-0.5 font-medium text-slate-900">{{ order.full_name }}</dd>
          </div>
          <div>
            <dt class="text-slate-500">Телефон</dt>
            <dd class="mt-0.5 font-medium text-slate-900">{{ order.phone || "—" }}</dd>
          </div>
          <div>
            <dt class="text-slate-500">E-mail</dt>
            <dd class="mt-0.5 break-all font-medium text-slate-900">{{ order.email || "—" }}</dd>
          </div>
          <div>
            <dt class="text-slate-500">Ответственный</dt>
            <dd class="mt-0.5 font-medium text-slate-900">{{ formatManagerName(order.manager_ext_id) }}</dd>
          </div>
          <div>
            <dt class="text-slate-500">Текущий статус</dt>
            <dd class="mt-0.5">
              <span class="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                {{ order.current_stage }}
              </span>
            </dd>
          </div>
          <div>
            <dt class="text-slate-500">Плановая дата</dt>
            <dd class="mt-0.5 font-medium text-slate-900">{{ formatDateTime(order.target_date) }}</dd>
          </div>
          <div class="sm:col-span-2 lg:col-span-3">
            <dt class="text-slate-500">Адрес объекта</dt>
            <dd class="mt-0.5 font-medium text-slate-900">{{ order.address || "—" }}</dd>
          </div>
          <div>
            <dt class="text-slate-500">Сумма заказа</dt>
            <dd class="mt-0.5 font-medium text-slate-900">{{ formatMoney(order.total_cost) }}</dd>
          </div>
          <div>
            <dt class="text-slate-500">Обновлён</dt>
            <dd class="mt-0.5 font-medium text-slate-900">
              {{ order.updated_at ? formatDateTime(order.updated_at) : "—" }}
            </dd>
          </div>
        </dl>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">История этапов</h2>
            <p class="mt-1 text-xs text-slate-500">Хронология этапов заказа по дате фиксации в журнале.</p>
            <p
              v-if="historyCollapsed && historyEntries.length > 0"
              class="mt-2 text-sm text-slate-600"
            >
              Записей в журнале: {{ historyEntries.length }}.
            </p>
          </div>
          <button
            v-if="historyEntries.length > 0"
            type="button"
            class="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            @click="historyCollapsed = !historyCollapsed"
          >
            {{ historyCollapsed ? "Развернуть" : "Свернуть" }}
          </button>
        </div>

        <p v-if="historyEntries.length === 0" class="mt-4 text-sm text-slate-500">Записей журнала пока нет.</p>

        <ol
          v-else-if="!historyCollapsed"
          class="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-100 bg-slate-50/50"
        >
          <li
            v-for="(entry, index) in historyEntries"
            :key="entry.id"
            class="flex flex-wrap items-start gap-4 px-4 py-3"
          >
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              {{ index + 1 }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-slate-900">{{ entry.stage_name }}</p>
              <p class="mt-0.5 text-xs text-slate-500">{{ formatDateTime(entry.transition_date) }}</p>
              <p class="mt-1 text-xs text-slate-600">
                Кто зафиксировал: <span class="font-medium">{{ formatManagerName(entry.employee_ext_id) }}</span>
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div class="min-w-0">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Изображения и файлы</h2>
            <p class="mt-1 max-w-xl text-xs text-slate-500">
              PDF чека и акта можно пересобрать по текущим данным заказа (письмо клиенту не отправляется).
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-lg border border-primary bg-white px-4 py-2 text-sm font-medium text-primary shadow-sm transition hover:bg-primary/5 disabled:pointer-events-none disabled:opacity-60"
            :disabled="regeneratingDocs"
            @click="regenerateClosingDocuments"
          >
            {{ regeneratingDocs ? "Генерация…" : "Пересоздать чек и акт" }}
          </button>
        </div>
        <div v-if="payload.media.length === 0" class="mt-3 text-sm text-slate-500">Файлы не загружены.</div>
        <div v-else class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <a
            v-for="file in payload.media"
            :key="file.id"
            :href="resolveBackendAssetUrl(file.secure_link)"
            target="_blank"
            rel="noopener noreferrer"
            class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-primary"
          >
            <img
              v-if="mediaPreviewIsImage(file.secure_link)"
              :src="resolveBackendAssetUrl(file.secure_link)"
              :alt="file.file_type"
              class="h-28 w-full object-cover sm:h-32"
            />
            <div
              v-else
              class="flex h-28 flex-col items-center justify-center gap-1 bg-slate-50 px-2 text-center sm:h-32"
            >
              <span class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {{ mediaPreviewIsPdf(file.secure_link) ? "PDF" : "Файл" }}
              </span>
              <span class="text-[10px] text-primary">Открыть / скачать</span>
            </div>
            <p class="px-2 py-1.5 text-[11px] leading-snug text-slate-600">
              {{ file.file_type }}
              <span class="block text-slate-400">{{ formatDateTime(file.uploaded_at) }}</span>
            </p>
          </a>
        </div>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Спецификация</h2>
        <div v-if="payload.specification.length === 0" class="mt-3 text-sm text-slate-500">
          Спецификация не загружена.
        </div>
        <AppDataTable
          v-else
          class="mt-3"
          :rows="specRows"
          :columns="specColumns"
          :row-key="(row, idx) => `${row.material_id}-${row.article}-${idx}`"
          initial-sort-key="sale_price"
          initial-sort-order="desc"
        >
          <template #cell-sale_price="{ row }">{{ formatMoney(String(row.sale_price)) }}</template>
        </AppDataTable>
      </section>
    </template>
  </section>
</template>
