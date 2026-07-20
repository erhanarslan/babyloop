import type { MobilePushRegistrationResult } from "./mobile-push-registration";

export const MOBILE_PUSH_REGISTRATION_MAX_ATTEMPTS = 8;
export const MOBILE_PUSH_REGISTRATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MOBILE_PUSH_REGISTRATION_RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000] as const;

export function getMobilePushRegistrationRetryDelay(attempt: number): number {
  const normalizedAttempt = Number.isFinite(attempt) ? Math.max(0, Math.floor(attempt) - 1) : 0;
  const index = Math.min(normalizedAttempt, MOBILE_PUSH_REGISTRATION_RETRY_DELAYS_MS.length - 1);
  return MOBILE_PUSH_REGISTRATION_RETRY_DELAYS_MS[index];
}

export function shouldStopMobilePushRegistration(result: MobilePushRegistrationResult): boolean {
  if (result.status === "registered" || result.status === "denied") {
    return true;
  }

  return result.reason === "physical_device_required" ||
    result.reason === "web_not_supported" ||
    result.reason === "android_fcm_configuration_missing";
}

export function isMobilePushRegistrationCacheFresh(input: {
  cachedProfileId: string;
  currentProfileId: string;
  now: number;
  registeredAt: number;
  ttlMs?: number;
}): boolean {
  const ttlMs = input.ttlMs ?? MOBILE_PUSH_REGISTRATION_CACHE_TTL_MS;
  return input.cachedProfileId === input.currentProfileId &&
    Number.isFinite(input.registeredAt) &&
    input.registeredAt <= input.now &&
    input.now - input.registeredAt < ttlMs;
}
