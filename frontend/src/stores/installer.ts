import { ref } from "vue";
import { defineStore } from "pinia";
import { resolveBackendAssetUrl } from "../api/baseUrl";
import { fetchDeployments } from "../api/installer";
import type { Deployment } from "../mocks/deployments";
import { isServerAvailable, SERVER_UNAVAILABLE_MESSAGE } from "../utils/serverHealth";

export const useInstallerStore = defineStore("installer", () => {
  const deployments = ref<Deployment[]>([]);
  const initialized = ref(false);
  const isLoading = ref(false);
  const loadError = ref("");

  async function ensureLoaded(force = false) {
    if (initialized.value && !force) {
      return;
    }

    isLoading.value = true;
    loadError.value = "";
    if (!(await isServerAvailable())) {
      deployments.value = [];
      loadError.value = SERVER_UNAVAILABLE_MESSAGE;
      initialized.value = true;
      isLoading.value = false;
      return;
    }

    try {
      const response = await fetchDeployments();
      const grouped = new Map<number, Deployment>();

      for (const row of response.data) {
        const existing = grouped.get(row.order_id);
        const mediaFiles =
          row.secure_link && row.secure_link.length > 0
            ? [...(existing?.media_files ?? []), resolveBackendAssetUrl(row.secure_link)]
            : existing?.media_files ?? [];
        const normalizedTarget = row.target_date?.replace("T", " ") ?? "";
        const [installDatePart = "", installTimePart = ""] = normalizedTarget.split(" ");
        const installDate = installDatePart || "—";
        const installTime = installTimePart ? installTimePart.slice(0, 5) : "—";

        grouped.set(row.order_id, {
          id: row.order_id,
          order_number: row.agreement_number ?? `Заказ #${row.order_id}`,
          full_name: row.full_name,
          phone: row.phone,
          address: row.address,
          install_date: installDate,
          install_time: installTime,
          status: row.current_stage === "Завершен" ? "Монтаж завершен" : "Ожидает выезда",
          media_files: mediaFiles,
        });
      }

      deployments.value = Array.from(grouped.values()).filter((item) => item.status !== "Монтаж завершен");
      initialized.value = true;
      isLoading.value = false;
    } catch {
      deployments.value = [];
      loadError.value = "Не удалось загрузить выезды с сервера.";
      initialized.value = true;
      isLoading.value = false;
    }
  }

  function completeDeployment(id: number) {
    deployments.value = deployments.value.filter((item) => item.id !== id);
  }

  return {
    deployments,
    isLoading,
    loadError,
    ensureLoaded,
    completeDeployment,
  };
});
