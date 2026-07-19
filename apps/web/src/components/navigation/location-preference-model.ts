import { getLocationLabel, locationOptions } from "./public-navigation-model";

export const LOCATION_STORAGE_KEY = "babyloop_marketplace_city";
export const LOCATION_COOKIE_KEY = "babyloop_marketplace_city";
export const LOCATION_CHANGED_EVENT = "babyloop-marketplace-location-change";
export const DEFAULT_LOCATION = "turkiye";
export const LOCATION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export function normalizeLocationPreference(value: string | null | undefined): string {
  return resolveLocationPreference(value) ?? DEFAULT_LOCATION;
}

export function resolveLocationPreference(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLocaleLowerCase("tr-TR") ?? "";
  const option = locationOptions.find((item) => (
    item.value === normalized ||
    getLocationLabel(item.value).toLocaleLowerCase("tr-TR") === normalized
  ));

  return option?.value ?? null;
}

export function readLocationPreferenceFromCookie(cookieHeader: string): string | null {
  const cookies = cookieHeader.split(";");

  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf("=");

    if (separatorIndex < 0) {
      continue;
    }

    const name = cookie.slice(0, separatorIndex).trim();

    if (name !== LOCATION_COOKIE_KEY) {
      continue;
    }

    try {
      return normalizeLocationPreference(
        decodeURIComponent(cookie.slice(separatorIndex + 1).trim())
      );
    } catch {
      return DEFAULT_LOCATION;
    }
  }

  return null;
}

export function buildLocationPreferenceCookie(value: string, secure: boolean): string {
  const normalized = normalizeLocationPreference(value);

  return [
    `${LOCATION_COOKIE_KEY}=${encodeURIComponent(normalized)}`,
    "Path=/",
    `Max-Age=${LOCATION_COOKIE_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
    ...(secure ? ["Secure"] : [])
  ].join("; ");
}
