<script setup lang="ts">
import { computed, ref } from "vue";

const name = ref("");
const phone = ref("");
const comment = ref("");
const isLoading = ref(false);
const isSuccess = ref(false);

const phonePattern = /^\+7\s\(\d{3}\)\s\d{3}-\d{2}-\d{2}$/;
const isFormValid = computed(() => name.value.trim().length > 0 && phonePattern.test(phone.value));

function extractPhoneDigits(raw: string) {
  return raw.replace(/\D/g, "").replace(/^8/, "7").slice(0, 11);
}

function formatPhoneInput(raw: string) {
  const digits = extractPhoneDigits(raw);
  if (!digits.length) {
    return "";
  }

  const normalized = digits.startsWith("7") ? digits : `7${digits}`.slice(0, 11);
  const country = normalized.slice(0, 1);
  const code = normalized.slice(1, 4);
  const first = normalized.slice(4, 7);
  const second = normalized.slice(7, 9);
  const third = normalized.slice(9, 11);

  let result = `+${country}`;
  if (code) {
    result += ` (${code}`;
    if (code.length === 3) {
      result += ")";
    }
  }
  if (first) {
    result += ` ${first}`;
  }
  if (second) {
    result += `-${second}`;
  }
  if (third) {
    result += `-${third}`;
  }
  return result;
}

function handlePhoneInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const nativeInput = event as InputEvent;
  const previousDigits = extractPhoneDigits(phone.value);
  let nextDigits = extractPhoneDigits(target.value);

  // When deleting near formatting chars (")", "-", space), browsers may remove
  // only a separator. In that case we remove one digit manually.
  if (
    nativeInput.inputType?.startsWith("delete") &&
    nextDigits === previousDigits &&
    previousDigits.length > 1
  ) {
    nextDigits = previousDigits.slice(0, -1);
  }

  const formatted = formatPhoneInput(nextDigits);
  phone.value = formatted;
  target.value = formatted;
}

async function submitLead() {
  if (!isFormValid.value) {
    return;
  }
  isLoading.value = true;
  await new Promise((resolve) => setTimeout(resolve, 1200));
  isLoading.value = false;
  isSuccess.value = true;
  console.log("Lead submitted:", { name: name.value, phone: phone.value, comment: comment.value });
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

      <label class="mt-4 block text-sm font-medium text-slate-700">Телефон *</label>
      <input
        :value="phone"
        type="tel"
        placeholder="+7 (___) ___-__-__"
        inputmode="tel"
        maxlength="18"
        class="mt-1 w-full rounded-md border-slate-300 text-sm focus:border-primary focus:ring-primary"
        @input="handlePhoneInput"
      />
      <p v-if="phone && !phonePattern.test(phone)" class="mt-1 text-xs text-danger">Формат: +7 (999) 123-45-67</p>

      <label class="mt-4 block text-sm font-medium text-slate-700">Комментарий</label>
      <textarea
        v-model="comment"
        rows="3"
        class="mt-1 w-full rounded-md border-slate-300 text-sm focus:border-primary focus:ring-primary"
      />

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
      Спасибо! Ваша заявка принята. Ожидайте звонка менеджера.
    </div>
  </section>
</template>
