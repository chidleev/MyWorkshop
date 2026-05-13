import { API_BASE_URL } from "../api/baseUrl";

export const SERVER_UNAVAILABLE_MESSAGE =
  "Сервер недоступен. Проверьте подключение и повторите позже.";

const REQUEST_TIMEOUT_ERROR = "request_timeout";

function withTimeout(promise: Promise<Response>, timeoutMs: number) {
  return new Promise<Response>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("health_timeout")), timeoutMs);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

export async function isServerAvailable(timeoutMs = 3000) {
  const healthUrl = `${API_BASE_URL}/api/health`;

  try {
    const response = await withTimeout(fetch(healthUrl), timeoutMs);
    if (!response.ok) return false;

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("text/html")) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function withRequestTimeout<T>(promise: Promise<T>, timeoutMs = 10000) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(REQUEST_TIMEOUT_ERROR)), timeoutMs);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

export function isServerUnavailableError(error: unknown) {
  const candidate = error as { message?: string; response?: unknown } | null;
  return candidate?.message === REQUEST_TIMEOUT_ERROR || !candidate?.response;
}
