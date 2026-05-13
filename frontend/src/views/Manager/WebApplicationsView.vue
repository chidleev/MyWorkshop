<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import AppDataTable, { type DataTableColumn } from "../../components/Common/AppDataTable.vue";
import OrderFormModal from "../../components/Orders/OrderFormModal.vue";
import {
  claimWebApplication,
  fetchWebApplications,
  rejectWebApplication,
  type OrderDto,
} from "../../api/orders";
import type { Order, OrderFormPayload, OrderStatus } from "../../types/order";
import { useManagerOrdersStore } from "../../stores/managerOrders";
import { formatDateTime } from "../../utils/datetime";
import { showError, showSuccess } from "../../utils/notification";
import { isServerAvailable, SERVER_UNAVAILABLE_MESSAGE } from "../../utils/serverHealth";

const router = useRouter();
const ordersStore = useManagerOrdersStore();

const isLoading = ref(true);
const loadError = ref("");
const rows = ref<OrderDto[]>([]);

const claimModalOpen = ref(false);
const claimOrderId = ref<number | null>(null);
const claimInitialOrder = ref<Order | null>(null);

const rejectTarget = ref<OrderDto | null>(null);

const tableColumns: DataTableColumn[] = [
  { key: "agreement_number", label: "№ заявки", sortable: true, widthClass: "whitespace-nowrap" },
  { key: "full_name", label: "Клиент", sortable: true },
  { key: "email", label: "Email", sortable: true, widthClass: "min-w-[10rem] max-w-[14rem]" },
  { key: "created_at", label: "Создана", sortable: true, widthClass: "whitespace-nowrap" },
  {
    key: "actions",
    label: "Действия",
    align: "right",
    widthClass: "min-w-[17rem] align-top whitespace-nowrap",
  },
];

function mapStageToStatus(stage: string): OrderStatus {
  if (stage === "Новый") return "new";
  if (
    stage === "В производстве" ||
    stage === "Распил" ||
    stage === "Кромление" ||
    stage === "Присадка" ||
    stage === "Сборка"
  ) {
    return "in_production";
  }
  if (stage === "Готов к отгрузке") return "ready_to_ship";
  if (stage === "Завершен" || stage === "done") return "completed";
  return "new";
}

function dtoToClaimOrder(dto: OrderDto): Order {
  return {
    id: dto.id,
    agreement_number: "",
    client_id: String(dto.client_id),
    manager_ext_id: dto.manager_ext_id,
    full_name: dto.full_name,
    phone: dto.phone ?? "",
    email: dto.email ?? "",
    address: dto.address ?? "",
    status: mapStageToStatus(dto.current_stage),
    production_stage: dto.production_stage,
    has_specification: Boolean(dto.has_specification),
    tasks_total_count: Number(dto.tasks_total_count ?? 0),
    tasks_started_count: Number(dto.tasks_started_count ?? 0),
    tasks_completed_count: Number(dto.tasks_completed_count ?? 0),
    target_date: dto.target_date ?? "",
    total_cost: dto.total_cost,
    created_at: dto.created_at,
    updated_at: dto.updated_at,
  };
}

const tableRows = computed(() => rows.value as unknown as Record<string, unknown>[]);

async function load() {
  isLoading.value = true;
  loadError.value = "";
  if (!(await isServerAvailable())) {
    loadError.value = SERVER_UNAVAILABLE_MESSAGE;
    isLoading.value = false;
    return;
  }
  try {
    const res = await fetchWebApplications();
    rows.value = res.data;
  } catch {
    loadError.value = "Не удалось загрузить заявки. Проверьте подключение к серверу.";
  } finally {
    isLoading.value = false;
  }
}

function toOrderDto(row: Record<string, unknown>): OrderDto {
  return row as unknown as OrderDto;
}

function openClaim(dto: OrderDto) {
  claimOrderId.value = dto.id;
  claimInitialOrder.value = dtoToClaimOrder(dto);
  claimModalOpen.value = true;
}

function closeClaimModal() {
  claimModalOpen.value = false;
  claimOrderId.value = null;
  claimInitialOrder.value = null;
}

async function submitClaim(payload: OrderFormPayload) {
  if (claimOrderId.value === null) {
    return;
  }
  try {
    await claimWebApplication(claimOrderId.value, {
      agreement_number: payload.agreement_number,
      target_date: payload.target_date,
      full_name: payload.full_name,
      phone: payload.phone.trim() || undefined,
      email: payload.email.trim(),
      address: payload.address.trim() || undefined,
    });
    showSuccess("Заявка оформлена как заказ и закреплена за вами.");
    const savedId = claimOrderId.value;
    closeClaimModal();
    await load();
    await ordersStore.ensureLoaded(true);
    if (savedId !== null) {
      await router.push({ name: "order-detail", params: { id: String(savedId) } });
    }
  } catch (err: unknown) {
    const msg =
      err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
    showError(msg ?? "Не удалось создать заказ из заявки.");
  }
}

function openReject(dto: OrderDto) {
  rejectTarget.value = dto;
}

function closeReject() {
  rejectTarget.value = null;
}

async function confirmReject() {
  if (!rejectTarget.value) {
    return;
  }
  const id = rejectTarget.value.id;
  try {
    await rejectWebApplication(id);
    showSuccess(
      rejectTarget.value.email
        ? "Заявка отклонена. На email клиента отправлено уведомление."
        : "Заявка отклонена. Email не был указан — письмо не отправлялось."
    );
    closeReject();
    await load();
  } catch (err: unknown) {
    const msg =
      err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
    showError(msg ?? "Не удалось отклонить заявку.");
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <section class="space-y-4">
    <header class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h1 class="text-xl font-semibold text-slate-900 sm:text-2xl">Входящие заявки с сайта</h1>
      <p class="mt-1 text-sm text-slate-600">
        Заявки без назначенного менеджера. Создайте заказ или отклоните заявку — клиент получит
        письмо на email.
      </p>
    </header>

    <div
      v-if="loadError"
      class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm"
    >
      {{ loadError }}
    </div>

    <div
      v-else-if="isLoading"
      class="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500"
    >
      Загрузка…
    </div>

    <div
      v-else-if="rows.length === 0"
      class="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-500"
    >
      Нет активных заявок.
    </div>

    <div v-else class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <AppDataTable
        :rows="tableRows"
        :columns="tableColumns"
        row-key="id"
        initial-sort-key="created_at"
        initial-sort-order="desc"
        class="!mt-0 p-4 sm:p-5"
      >
        <template #cell-agreement_number="{ row }">
          <span
            class="block truncate font-mono text-[0.8125rem] font-medium tabular-nums tracking-tight text-slate-900"
            :title="String(row.agreement_number)"
          >
            {{ row.agreement_number }}
          </span>
        </template>
        <template #cell-full_name="{ row }">
          <span class="block break-words leading-snug">{{ row.full_name }}</span>
        </template>
        <template #cell-email="{ row }">
          <span
            class="block text-left text-sm leading-snug text-slate-700 [overflow-wrap:anywhere] break-words"
            :title="row.email ? String(row.email) : undefined"
          >
            {{ row.email || "—" }}
          </span>
        </template>
        <template #cell-created_at="{ row }">
          <span
            class="block max-w-full truncate text-left text-sm"
            :title="formatDateTime(String(row.created_at))"
          >
            {{ formatDateTime(String(row.created_at)) }}
          </span>
        </template>
        <template #cell-actions="{ row }">
          <div class="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              class="inline-flex min-h-[2.25rem] shrink-0 items-center justify-center rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-1"
              @click="openClaim(toOrderDto(row))"
            >
              Создать заказ
            </button>
            <button
              type="button"
              class="inline-flex min-h-[2.25rem] shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-600 transition hover:border-danger/30 hover:bg-red-50/80 hover:text-danger focus-visible:outline focus-visible:ring-2 focus-visible:ring-danger/25 focus-visible:ring-offset-1"
              @click="openReject(toOrderDto(row))"
            >
              Отклонить
            </button>
          </div>
        </template>
      </AppDataTable>
    </div>

    <OrderFormModal
      v-if="claimInitialOrder"
      :is-open="claimModalOpen"
      mode="edit"
      modal-title="Создание заказа из заявки"
      :initial-data="claimInitialOrder"
      @close="closeClaimModal"
      @submit="submitClaim"
    />

    <Teleport to="body">
      <div
        v-if="rejectTarget"
        class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 p-4"
        @click.self="closeReject"
      >
        <section class="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
          <h3 class="text-lg font-semibold text-slate-900">Отклонить заявку</h3>
          <p class="mt-2 text-sm text-slate-600">
            <template v-if="rejectTarget.email">
              Заявка {{ rejectTarget.agreement_number }} будет удалена. На адрес
              <span class="font-medium">{{ rejectTarget.email }}</span>
              будет отправлено письмо с уведомлением об отказе.
            </template>
            <template v-else>
              Заявка {{ rejectTarget.agreement_number }} будет удалена. Email не указан —
              уведомление отправлено не будет.
            </template>
          </p>
          <div class="mt-4 flex justify-end gap-2">
            <button
              type="button"
              class="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              @click="closeReject"
            >
              Назад
            </button>
            <button
              type="button"
              class="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              @click="confirmReject"
            >
              Отклонить
            </button>
          </div>
        </section>
      </div>
    </Teleport>
  </section>
</template>
