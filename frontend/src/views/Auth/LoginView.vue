<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { USER_ROLES, type UserRole, useAuthStore } from "../../stores/auth";

const router = useRouter();
const authStore = useAuthStore();
const selectedRole = ref<UserRole>(USER_ROLES[0]);

async function handleLogin() {
  authStore.login(selectedRole.value);
  await router.push("/");
}
</script>

<template>
  <section class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <h1 class="text-2xl font-semibold text-slate-900">Вход в систему</h1>
    <p class="mt-2 text-sm text-slate-600">Выберите роль для локальной авторизации через mock CRM.</p>

    <label class="mt-5 block text-sm font-medium text-slate-700" for="role">Роль сотрудника</label>
    <select
      id="role"
      v-model="selectedRole"
      class="mt-2 block w-full rounded-md border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary"
    >
      <option v-for="role in USER_ROLES" :key="role" :value="role">
        {{ role }}
      </option>
    </select>

    <button
      type="button"
      class="mt-5 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      @click="handleLogin"
    >
      Войти
    </button>
  </section>
</template>
