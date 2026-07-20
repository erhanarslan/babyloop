const FALLBACK_WEB_BASE_URL = "http://localhost:3000";

export function getWebBaseUrl(): string {
  return (process.env.EXPO_PUBLIC_WEB_BASE_URL?.trim() || FALLBACK_WEB_BASE_URL).replace(/\/+$/, "");
}

export function buildWebUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getWebBaseUrl()}${normalizedPath}`;
}
