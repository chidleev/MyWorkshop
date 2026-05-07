<template>
  <div>
    <GlobalToasts />
    <RouterView />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import GlobalToasts from "./components/GlobalToasts.vue";
import { useAuthStore, type UserInfo, type UserRole } from "./stores/auth";

const authStore = useAuthStore();

onMounted(() => {
  if (authStore.isAuthenticated) {
    return;
  }

  const token = localStorage.getItem("auth.token");
  const role = localStorage.getItem("auth.role") as UserRole | null;
  const rawUserInfo = localStorage.getItem("auth.userInfo");
  if (!token || !role || !rawUserInfo) {
    return;
  }

  try {
    const userInfo = JSON.parse(rawUserInfo) as UserInfo;
    authStore.setSession(token, role, userInfo);
  } catch {
    authStore.clearSession();
  }
});
</script>
