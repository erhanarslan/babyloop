import * as SecureStore from "expo-secure-store";

const MOBILE_PUSH_REGISTRATION_CACHE_KEY = "babyloop.notifications.pushRegistration";

export type MobilePushRegistrationCache = {
  profileId: string;
  registeredAt: number;
  tokenHashPrefix?: string;
};

export async function getMobilePushRegistrationCache(): Promise<MobilePushRegistrationCache | null> {
  const raw = await SecureStore.getItemAsync(MOBILE_PUSH_REGISTRATION_CACHE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const value: unknown = JSON.parse(raw);

    if (!isMobilePushRegistrationCache(value)) {
      return null;
    }

    return value;
  } catch {
    return null;
  }
}

export async function setMobilePushRegistrationCache(value: MobilePushRegistrationCache): Promise<void> {
  await SecureStore.setItemAsync(MOBILE_PUSH_REGISTRATION_CACHE_KEY, JSON.stringify(value));
}

function isMobilePushRegistrationCache(value: unknown): value is MobilePushRegistrationCache {
  return typeof value === "object" &&
    value !== null &&
    "profileId" in value &&
    "registeredAt" in value &&
    typeof value.profileId === "string" &&
    typeof value.registeredAt === "number" &&
    (!("tokenHashPrefix" in value) || typeof value.tokenHashPrefix === "string");
}
