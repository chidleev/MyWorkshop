<script setup lang="ts">
import { computed, ref } from "vue";
import { createExternalLead } from "../../api/external";
import { isValidRuPhone, normalizePhoneInput } from "../../utils/phone";

const name = ref("");
const email = ref("");
const phone = ref("");
const comment = ref("");
const isLoading = ref(false);
const isSuccess = ref(false);
const errorMessage = ref("");
const createdAgreementNumber = ref("");

function isValidEmail(value: string) {
  const t = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

const isFormValid = computed(() => {
  return name.value.trim().length > 0 && isValidEmail(email.value) && (!phone.value.trim() || isValidRuPhone(phone.value));
});

function handlePhoneInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const nativeInput = event as Event & { inputType?: string };
  const formatted = normalizePhoneInput(target.value, phone.value, nativeInput.inputType);
  phone.value = formatted;
  target.value = formatted;
}

async function submitLead() {
  if (!isFormValid.value) {
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";
  try {
    const response = await createExternalLead({
      client_name: name.value.trim(),
      client_email: email.value.trim(),
      client_phone: phone.value.trim() || undefined,
      comment: comment.value.trim() || undefined,
    });
    createdAgreementNumber.value = response.data.agreement_number;
    isSuccess.value = true;
  } catch {
    errorMessage.value = "Не удалось отправить заявку. Проверьте подключение и попробуйте еще раз.";
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <section class="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div v-if="!isSuccess">
      <h2 class="text-lg font-semibold text-slate-900">Оставить заявку</h2>
      <p class="mt-1 text-sm text-slate-600">Менеджер свяжется с вами для уточнения проекта.</p>

      <label class="mt-4 block text-sm font-medium text-slate-700">Имя *</label>
      <input
        v-model="name"
        type="text"
        class="mt-1 w-full rounded-md border-slate-300 text-sm focus:border-primary focus:ring-primary"
      />

      <label class="mt-4 block text-sm font-medium text-slate-700">E-mail *</label>
      <input
        v-model="email"
        type="email"
        autocomplete="email"
        class="mt-1 w-full rounded-md border-slate-300 text-sm focus:border-primary focus:ring-primary"
      />
      <p v-if="email && !isValidEmail(email)" class="mt-1 text-xs text-danger">Укажите корректный email</p>

      <label class="mt-4 block text-sm font-medium text-slate-700">Телефон</label>
      <input
        :value="phone"
        type="tel"
        placeholder="+7 (___) ___-__-__ (необязательно)"
        inputmode="tel"
        maxlength="18"
        class="mt-1 w-full rounded-md border-slate-300 text-sm focus:border-primary focus:ring-primary"
        @input="handlePhoneInput"
      />
      <p v-if="phone && !isValidRuPhone(phone)" class="mt-1 text-xs text-danger">
        Введите корректный номер: +7 (999) 123-45-67
      </p>

      <label class="mt-4 block text-sm font-medium text-slate-700">Комментарий</label>
      <textarea
        v-model="comment"
        rows="3"
        class="mt-1 w-full rounded-md border-slate-300 text-sm focus:border-primary focus:ring-primary"
      />

      <p v-if="errorMessage" class="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {{ errorMessage }}
      </p>

      <button
        type="button"
        class="mt-5 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        :disabled="!isFormValid || isLoading"
        @click="submitLead"
      >
        <span v-if="isLoading">Отправка...</span>
        <span v-else>Оставить заявку</span>
      </button>
    </div>

    <div v-else class="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
      <p class="font-medium">Спасибо! Ваша заявка принята.</p>
      <p class="mt-1 text-sm">Номер заявки: {{ createdAgreementNumber }}. Мы свяжемся с вами по email.</p>
    </div>
  </section>
</template>
