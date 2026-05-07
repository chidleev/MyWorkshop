<script setup lang="ts">
import { computed, ref } from "vue";
import { isValidRuPhone, normalizePhoneInput } from "../../utils/phone";

const name = ref("");
const phone = ref("");
const comment = ref("");
const isLoading = ref(false);
const isSuccess = ref(false);

const isFormValid = computed(() => name.value.trim().length > 0 && isValidRuPhone(phone.value));

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
      <p v-if="phone && !isValidRuPhone(phone)" class="mt-1 text-xs text-danger">
        Введите корректный номер: +7 (999) 123-45-67
      </p>

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
