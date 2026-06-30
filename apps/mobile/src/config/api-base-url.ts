const fallbackApiBaseUrl = "http://localhost:4000";
const androidEmulatorApiBaseUrl = "http://10.0.2.2:4000";

export type MobileApiBaseUrlInput = {
  configuredBaseUrl?: string | null;
  envBaseUrl?: string | null;
  platformOS: string;
};

export function resolveMobileApiBaseUrl({
  configuredBaseUrl,
  envBaseUrl,
  platformOS
}: MobileApiBaseUrlInput): string {
  const rawBaseUrl =
    typeof envBaseUrl === "string" && envBaseUrl.trim().length > 0
      ? envBaseUrl.trim()
      : typeof configuredBaseUrl === "string" && configuredBaseUrl.trim().length > 0
        ? configuredBaseUrl.trim()
        : fallbackApiBaseUrl;

  const normalized = rawBaseUrl.replace(/\/+$/, "");

  if (!envBaseUrl && platformOS === "android" && isLocalhostUrl(normalized)) {
    return androidEmulatorApiBaseUrl;
  }

  return normalized;
}

function isLocalhostUrl(value: string): boolean {
  return value.startsWith("http://localhost") || value.startsWith("http://127.0.0.1");
}
