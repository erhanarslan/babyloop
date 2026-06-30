import Constants from "expo-constants";
import { Platform } from "react-native";

import { resolveMobileApiBaseUrl } from "./api-base-url";

export { resolveMobileApiBaseUrl } from "./api-base-url";

export function getApiBaseUrl(): string {
  return resolveMobileApiBaseUrl({
    envBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    configuredBaseUrl: Constants.expoConfig?.extra?.apiBaseUrl,
    platformOS: Platform.OS
  });
}
