<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { MOCK_EMPLOYEES, USER_ROLES, type UserRole, useAuthStore } from "../../stores/auth";
import { getDefaultRouteForRole } from "../../utils/roleRoutes";

const router = useRouter();
const authStore = useAuthStore();
const LAST_LOGIN_STORAGE_KEY = "myworkshop:last-login";

const selectedRole = ref<UserRole>(USER_ROLES[0]);
const employeeOptions = computed(() => MOCK_EMPLOYEES.filter((employee) => employee.role === selectedRole.value));
const selectedEmployeeId = ref(employeeOptions.value[0]?.id ?? "");

watch(selectedRole, () => {
  const hasSelectedEmployee = employeeOptions.value.some((employee) => employee.id === selectedEmployeeId.value);
  if (!hasSelectedEmployee) {
    selectedEmployeeId.value = employeeOptions.value[0]?.id ?? "";
  }
});

restoreLastLogin();

async function handleLogin() {
  persistLastLogin();
  authStore.login(selectedRole.value, selectedEmployeeId.value);
  await router.push(getDefaultRouteForRole(selectedRole.value));
}

function persistLastLogin() {
  const payload = JSON.stringify({
    role: selectedRole.value,
    employeeId: selectedEmployeeId.value
  });
  localStorage.setItem(LAST_LOGIN_STORAGE_KEY, payload);
}

function restoreLastLogin() {
  const savedValue = localStorage.getItem(LAST_LOGIN_STORAGE_KEY);
  if (!savedValue) {
    return;
  }

  try {
    const parsed = JSON.parse(savedValue) as { role?: string; employeeId?: string };
    if (parsed.role && USER_ROLES.includes(parsed.role as UserRole)) {
      selectedRole.value = parsed.role as UserRole;
    }

    if (parsed.employeeId) {
      const canUseSavedEmployee = employeeOptions.value.some((employee) => employee.id === parsed.employeeId);
      if (canUseSavedEmployee) {
        selectedEmployeeId.value = parsed.employeeId;
      }
    }
  } catch {
    localStorage.removeItem(LAST_LOGIN_STORAGE_KEY);
  }
}
</script>

<template>
  <section class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <h1 class="text-2xl font-semibold text-slate-900">Вход в систему</h1>
    <p class="mt-2 text-sm text-slate-600">
      Выберите роль для локальной авторизации через mock CRM.
    </p>

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

    <label class="mt-5 block text-sm font-medium text-slate-700" for="employee">
      employee_ext_id
    </label>
    <select
      id="employee"
      v-model="selectedEmployeeId"
      class="mt-2 block w-full rounded-md border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary"
    >
      <option v-for="employee in employeeOptions" :key="employee.id" :value="employee.id">
        {{ employee.id }} - {{ employee.fullName }}
      </option>
    </select>
    <p class="mt-2 text-xs text-slate-500">
      Этот идентификатор будет передан в backend как текущий сотрудник.
    </p>

    <button
      type="button"
      class="mt-5 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      :disabled="!selectedEmployeeId"
      @click="handleLogin"
    >
      Войти
    </button>

    <a
      href="/feedback-widget"
      target="_blank"
      rel="noopener noreferrer"
      class="mt-4 block text-center text-sm font-medium text-primary hover:text-blue-700 hover:underline"
    >
      Открыть страницу с виджетом формы обратной связи
    </a>
  </section>
</template>
