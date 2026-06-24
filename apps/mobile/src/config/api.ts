import Constants from "expo-constants";
import { Platform } from "react-native";

const fallbackApiBaseUrl = "http://localhost:4000";
const androidEmulatorApiBaseUrl = "http://10.0.2.2:4000";

export function getApiBaseUrl(): string {
  const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const configured = Constants.expoConfig?.extra?.apiBaseUrl;

  const rawBaseUrl =
    typeof envBaseUrl === "string" && envBaseUrl.trim().length > 0
      ? envBaseUrl.trim()
      : typeof configured === "string" && configured.trim().length > 0
        ? configured.trim()
        : fallbackApiBaseUrl;

  const normalized = rawBaseUrl.replace(/\/$/, "");

  // Sadece env verilmemişse Android emulator fallback'i kullan.
  // Fiziksel telefonda EXPO_PUBLIC_API_BASE_URL ile Mac'in Wi-Fi IP'si verilmelidir.
  if (!envBaseUrl && Platform.OS === "android" && isLocalhostUrl(normalized)) {
    return androidEmulatorApiBaseUrl;
  }

  return normalized;
}

function isLocalhostUrl(value: string): boolean {
  return value.startsWith("http://localhost") || value.startsWith("http://127.0.0.1");
}
