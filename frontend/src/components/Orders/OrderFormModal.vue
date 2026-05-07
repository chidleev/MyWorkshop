<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import type { Order, OrderFormPayload } from "../../types/order";

const props = defineProps<{
  isOpen: boolean;
  mode: "create" | "edit";
  initialData?: Order | null;
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "submit", payload: OrderFormPayload): void;
}>();

const today = new Date().toISOString().slice(0, 10);

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
  form.target_date = order.target_date;
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

const PHONE_PATTERN = /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/;

const errors = computed(() => {
  return {
    full_name: form.full_name.trim() ? "" : "Укажите ФИО клиента",
    phone: PHONE_PATTERN.test(form.phone.trim()) ? "" : "Введите телефон в формате +7 (999) 999-99-99",
    agreement_number: form.agreement_number.trim() ? "" : "Укажите номер договора",
    target_date:
      form.target_date && form.target_date >= today ? "" : "Дата сдачи не может быть в прошлом",
  };
});

const isValid = computed(() => Object.values(errors.value).every((value) => !value));

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) {
    return "";
  }

  const local = digits.startsWith("8")
    ? `7${digits.slice(1)}`
    : digits.startsWith("7")
      ? digits
      : `7${digits}`;
  const normalized = local.slice(0, 11);

  let result = "+7";
  if (normalized.length > 1) {
    result += ` (${normalized.slice(1, 4)}`;
  }
  if (normalized.length >= 4) {
    result += `) ${normalized.slice(4, 7)}`;
  }
  if (normalized.length >= 7) {
    result += `-${normalized.slice(7, 9)}`;
  }
  if (normalized.length >= 9) {
    result += `-${normalized.slice(9, 11)}`;
  }

  return result.trim();
}

function handlePhoneInput(event: Event) {
  const input = event.target as HTMLInputElement;
  form.phone = normalizePhone(input.value);
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
    agreement_number: form.agreement_number.trim(),
    target_date: form.target_date,
  });

  resetForm();
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4">
      <section class="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl sm:p-6">
      <header class="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 class="text-lg font-semibold text-slate-900">
            {{ mode === "create" ? "Новый заказ" : "Редактирование заказа" }}
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
          <span class="mb-1 block text-sm font-medium text-slate-700">Телефон *</span>
          <input
            :value="form.phone"
            type="tel"
            class="w-full rounded-md border-slate-300 text-sm"
            placeholder="+7 (999) 999-99-99"
            @input="handlePhoneInput"
          />
          <span v-if="errors.phone" class="mt-1 block text-xs text-danger">{{ errors.phone }}</span>
        </label>

        <label>
          <span class="mb-1 block text-sm font-medium text-slate-700">E-mail</span>
          <input v-model="form.email" type="email" class="w-full rounded-md border-slate-300 text-sm" />
        </label>

        <label class="sm:col-span-2">
          <span class="mb-1 block text-sm font-medium text-slate-700">Адрес объекта</span>
          <textarea v-model="form.address" rows="2" class="w-full rounded-md border-slate-300 text-sm" />
        </label>

        <label>
          <span class="mb-1 block text-sm font-medium text-slate-700">Номер договора *</span>
          <input v-model="form.agreement_number" type="text" class="w-full rounded-md border-slate-300 text-sm" />
          <span v-if="errors.agreement_number" class="mt-1 block text-xs text-danger">
            {{ errors.agreement_number }}
          </span>
        </label>

        <label>
          <span class="mb-1 block text-sm font-medium text-slate-700">Плановая дата сдачи *</span>
          <input v-model="form.target_date" :min="today" type="date" class="w-full rounded-md border-slate-300 text-sm" />
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
