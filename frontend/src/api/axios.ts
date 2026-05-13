import axios from "axios";
import router from "../router";
import { useAuthStore } from "../stores/auth";
import { showError } from "../utils/notification";
import { getDefaultRouteForRole } from "../utils/roleRoutes";
import { API_BASE_URL } from "./baseUrl";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth.token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const status = error?.response?.status as number | undefined;
    const hasNoResponse = !error?.response;
    const message =
      (error?.response?.data?.message as string | undefined) ??
      "Ошибка сети или сервера. Повторите попытку позже.";

    if (status === 401) {
      try {
        useAuthStore().logout();
      } catch {
        localStorage.removeItem("auth.token");
        localStorage.removeItem("auth.role");
        localStorage.removeItem("auth.userInfo");
      }
      if (router.currentRoute.value.name !== "login") {
        await router.push({ name: "login" });
      }
    } else if (status === 403) {
      showError(message);
      await router.push(getDefaultRouteForRole(useAuthStore().userRole));
    } else if (hasNoResponse) {
      showError("Сервер недоступен. Проверьте подключение и повторите позже.");
    } else if (status === 400 || status === 409 || status === 500 || status === 502 || status === 503) {
      showError(message);
    }

    return Promise.reject(error);
  }
);

export interface ApiEnvelope<T> {
  status: string;
  data: T;
  total_budget?: number;
}

export default api;
