import { ref } from "vue";
import { defineStore } from "pinia";
import { mockDeployments, type Deployment } from "../mocks/deployments";

export const useInstallerStore = defineStore("installer", () => {
  const deployments = ref<Deployment[]>(structuredClone(mockDeployments));

  function completeDeployment(id: number) {
    deployments.value = deployments.value.map((item) =>
      item.id === id ? { ...item, status: "Монтаж завершен" } : item
    );
  }

  return {
    deployments,
    completeDeployment,
  };
});
