import { ref } from "vue";
import { defineStore } from "pinia";

export type ToastType = "success" | "error" | "warning";

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

export const useNotificationsStore = defineStore("notifications", () => {
  const items = ref<ToastItem[]>([]);

  function push(type: ToastType, message: string, timeoutMs = 3500) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    items.value = [...items.value, { id, type, message }];
    window.setTimeout(() => {
      remove(id);
    }, timeoutMs);
  }

  function remove(id: number) {
    items.value = items.value.filter((item) => item.id !== id);
  }

  return {
    items,
    push,
    remove,
  };
});
