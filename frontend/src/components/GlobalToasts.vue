<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useNotificationsStore } from "../stores/notifications";

const notificationsStore = useNotificationsStore();
const { items } = storeToRefs(notificationsStore);
</script>

<template>
  <div class="pointer-events-none fixed right-4 top-4 z-[100] space-y-2">
    <transition-group name="toast">
      <div
        v-for="item in items"
        :key="item.id"
        class="pointer-events-auto min-w-72 rounded-lg border px-4 py-3 text-sm shadow-lg"
        :class="{
          'border-green-300 bg-green-50 text-green-800': item.type === 'success',
          'border-red-300 bg-red-50 text-red-800': item.type === 'error',
          'border-amber-300 bg-amber-50 text-amber-800': item.type === 'warning',
        }"
      >
        {{ item.message }}
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
