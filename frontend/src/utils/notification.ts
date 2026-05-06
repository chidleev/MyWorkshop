import { useNotificationsStore } from "../stores/notifications";

export function showSuccess(message: string) {
  const store = useNotificationsStore();
  store.push("success", message);
}

export function showError(message: string) {
  const store = useNotificationsStore();
  store.push("error", message);
}

export function showWarning(message: string) {
  const store = useNotificationsStore();
  store.push("warning", message);
}
