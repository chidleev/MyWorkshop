<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import type { Order, OrderFormPayload } from "../../types/order";
import { isValidRuPhone, normalizePhoneInput } from "../../utils/phone";

const props = defineProps<{
  isOpen: boolean;
  mode: "create" | "edit";
  initialData?: Order | null;
  /** Заголовок модального окна (по умолчанию — «Новый заказ» / «Редактирование заказа»). */
  modalTitle?: string;
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "submit", payload: OrderFormPayload): void;
}>();

function toDateTimeLocalValue(value: string): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value;
  const normalized = value.trim().replace(" ", "T");
  const localDateMatch = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::\d{2})?)?$/
  );

  if (localDateMatch) {
    const [, year, month, day, hours = "00", minutes = "00"] = localDateMatch;
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(
    parsed.getHours()
  )}:${pad(parsed.getMinutes())}`;
}

function getNowDateTimeLocal(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
    now.getHours()
  )}:${pad(now.getMinutes())}`;
}

const minDateTime = computed(() => getNowDateTimeLocal());

/** Новый заказ или оформление веб-заявки без номера — номер присваивает сервер. */
const usesAutoAgreementNumber = computed(
  () =>
    props.mode === "create" ||
    (props.mode === "edit" && !String(props.initialData?.agreement_number ?? "").trim())
);

const form = reactive<OrderFormPayload>({
  full_name: "",
  phone: "",
  email: "",
  address: "",
  agreement_number: "",
  target_date: "",
});

function resetForm() {
  form.full_name = "";
  form.phone = "";
  form.email = "";
  form.address = "";
  form.agreement_number = "";
  form.target_date = "";
}

function fillForm(order: Order) {
  form.full_name = order.full_name;
  form.phone = order.phone;
  form.email = order.email;
  form.address = order.address;
  form.agreement_number = order.agreement_number;
  form.target_date = toDateTimeLocalValue(order.target_date);
}

watch(
  () => [props.isOpen, props.initialData, props.mode] as const,
  ([isOpen, initialData, mode]) => {
    if (!isOpen) {
      return;
    }

    if (mode === "edit" && initialData) {
      fillForm(initialData);
      return;
    }

    resetForm();
  },
  { immediate: true }
);

function isValidEmail(value: string) {
  const t = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

const errors = computed(() => {
  const phoneTrim = form.phone.trim();
  return {
    full_name: form.full_name.trim() ? "" : "Укажите ФИО клиента",
    phone: phoneTrim && !isValidRuPhone(phoneTrim) ? "Введите корректный телефон в формате +7 (999) 999-99-99" : "",
    email: isValidEmail(form.email) ? "" : "Укажите корректный email",
    agreement_number: usesAutoAgreementNumber.value
      ? ""
      : form.agreement_number.trim()
        ? ""
        : "Укажите номер договора",
    target_date:
      form.target_date && form.target_date >= minDateTime.value ? "" : "Дата и время монтажа не могут быть в прошлом",
  };
});

const isValid = computed(() => Object.values(errors.value).every((value) => !value));

function handlePhoneInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const normalized = normalizePhoneInput(input.value, form.phone, (event as Event & { inputType?: string }).inputType);
  form.phone = normalized;
  input.value = normalized;
}

function handleClose() {
  resetForm();
  emit("close");
}

function handleSubmit() {
  if (!isValid.value) {
    return;
  }

  emit("submit", {
    full_name: form.full_name.trim(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    address: form.address.trim(),
    agreement_number: usesAutoAgreementNumber.value ? "" : form.agreement_number.trim(),
    target_date: form.target_date ? `${form.target_date}:00` : "",
  });
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4">
      <section class="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl sm:p-6">
      <header class="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 class="text-lg font-semibold text-slate-900">
            {{
              props.modalTitle ??
              (mode === "create" ? "Новый заказ" : "Редактирование заказа")
            }}
          </h2>
          <p class="mt-1 text-sm text-slate-500">
            Заполните данные клиента и срок выполнения заказа.
          </p>
        </div>
        <button type="button" class="rounded-md p-1 text-slate-500 hover:bg-slate-100" @click="handleClose">
          ✕
        </button>
      </header>

      <form class="grid grid-cols-1 gap-4 sm:grid-cols-2" @submit.prevent="handleSubmit">
        <label class="sm:col-span-2">
          <span class="mb-1 block text-sm font-medium text-slate-700">ФИО клиента *</span>
          <input v-model="form.full_name" type="text" class="w-full rounded-md border-slate-300 text-sm" />
          <span v-if="errors.full_name" class="mt-1 block text-xs text-danger">{{ errors.full_name }}</span>
        </label>

        <label>
          <span class="mb-1 block text-sm font-medium text-slate-700">Телефон</span>
          <input
            :value="form.phone"
            type="tel"
            class="w-full rounded-md border-slate-300 text-sm"
            placeholder="+7 (999) 999-99-99 (необязательно)"
            @input="handlePhoneInput"
          />
          <span v-if="errors.phone" class="mt-1 block text-xs text-danger">{{ errors.phone }}</span>
        </label>

        <label>
          <span class="mb-1 block text-sm font-medium text-slate-700">E-mail *</span>
          <input v-model="form.email" type="email" class="w-full rounded-md border-slate-300 text-sm" />
          <span v-if="errors.email" class="mt-1 block text-xs text-danger">{{ errors.email }}</span>
        </label>

        <label class="sm:col-span-2">
          <span class="mb-1 block text-sm font-medium text-slate-700">Адрес объекта</span>
          <textarea v-model="form.address" rows="2" class="w-full rounded-md border-slate-300 text-sm" />
        </label>

        <label v-if="!usesAutoAgreementNumber">
          <span class="mb-1 block text-sm font-medium text-slate-700">Номер договора *</span>
          <input v-model="form.agreement_number" type="text" class="w-full rounded-md border-slate-300 text-sm" />
          <span v-if="errors.agreement_number" class="mt-1 block text-xs text-danger">
            {{ errors.agreement_number }}
          </span>
        </label>

        <label :class="usesAutoAgreementNumber ? 'sm:col-span-2' : ''">
          <span class="mb-1 block text-sm font-medium text-slate-700">Плановая дата сдачи *</span>
          <input v-model="form.target_date" :min="minDateTime" type="datetime-local" class="w-full rounded-md border-slate-300 text-sm" />
          <span v-if="errors.target_date" class="mt-1 block text-xs text-danger">{{ errors.target_date }}</span>
        </label>

        <div class="sm:col-span-2 mt-2 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            @click="handleClose"
          >
            Отмена
          </button>
          <button
            type="submit"
            :disabled="!isValid"
            class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {{ mode === "create" ? "Создать" : "Сохранить" }}
          </button>
        </div>
      </form>
      </section>
    </div>
  </Teleport>
</template>
