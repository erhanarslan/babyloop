import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const MOBILE_AUTH_TOKEN_STORAGE_KEY = "babyloop.mobile.accessToken.v1";

let secureStoreAvailabilityPromise: Promise<boolean> | null = null;

export async function getStoredMobileAuthToken(): Promise<string | null> {
  if (!(await canUseSecureStore())) {
    return null;
  }

  try {
    const token = await SecureStore.getItemAsync(MOBILE_AUTH_TOKEN_STORAGE_KEY);

    return token && token.trim().length > 0 ? token : null;
  } catch {
    return null;
  }
}

export async function setStoredMobileAuthToken(token: string): Promise<void> {
  if (!(await canUseSecureStore())) {
    return;
  }

  try {
    await SecureStore.setItemAsync(MOBILE_AUTH_TOKEN_STORAGE_KEY, token);
  } catch {
    return;
  }
}

export async function clearStoredMobileAuthToken(): Promise<void> {
  if (!(await canUseSecureStore())) {
    return;
  }

  try {
    await SecureStore.deleteItemAsync(MOBILE_AUTH_TOKEN_STORAGE_KEY);
  } catch {
    return;
  }
}

async function canUseSecureStore(): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }

  if (!secureStoreAvailabilityPromise) {
    secureStoreAvailabilityPromise = SecureStore.isAvailableAsync().catch(() => false);
  }

  return secureStoreAvailabilityPromise;
}
