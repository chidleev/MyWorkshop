const configuredApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

function normalizeApiBaseUrl(value?: string): string {
  if (!value) {
    return "";
  }

  return value.replace(/\/+$/, "").replace(/\/api$/i, "");
}

export const API_BASE_URL = normalizeApiBaseUrl(configuredApiUrl);

export function resolveBackendAssetUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!/^https?:\/\//i.test(API_BASE_URL)) {
    return normalizedPath;
  }

  return `${new URL(API_BASE_URL).origin}${normalizedPath}`;
}
