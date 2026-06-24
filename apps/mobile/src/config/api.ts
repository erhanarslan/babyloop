import Constants from "expo-constants";

const fallbackApiBaseUrl = "http://localhost:4000";

export function getApiBaseUrl(): string {
  const configured = Constants.expoConfig?.extra?.apiBaseUrl;

  if (typeof configured === "string" && configured.trim().length > 0) {
    return configured.trim().replace(/\/$/, "");
  }

  return fallbackApiBaseUrl;
}
