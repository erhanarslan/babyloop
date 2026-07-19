import { describe, expect, it } from "vitest";

import {
  buildLocationPreferenceCookie,
  DEFAULT_LOCATION,
  LOCATION_COOKIE_MAX_AGE_SECONDS,
  normalizeLocationPreference,
  readLocationPreferenceFromCookie,
  resolveLocationPreference
} from "./location-preference-model";

describe("marketplace location preference", () => {
  it("accepts only supported location slugs", () => {
    expect(normalizeLocationPreference(" İstanbul ")).toBe("istanbul");
    expect(normalizeLocationPreference("ANKARA")).toBe("ankara");
    expect(normalizeLocationPreference("unknown-city")).toBe(DEFAULT_LOCATION);
    expect(resolveLocationPreference("İzmir")).toBe("izmir");
    expect(resolveLocationPreference("unknown-city")).toBeNull();
  });

  it("reads its server-visible cookie without trusting malformed values", () => {
    expect(readLocationPreferenceFromCookie("theme=dark; babyloop_marketplace_city=izmir")).toBe("izmir");
    expect(readLocationPreferenceFromCookie("babyloop_marketplace_city=unknown")).toBe(DEFAULT_LOCATION);
    expect(readLocationPreferenceFromCookie("theme=dark")).toBeNull();
  });

  it("builds a scoped, long-lived and secure production cookie", () => {
    const cookie = buildLocationPreferenceCookie("bursa", true);

    expect(cookie).toContain("babyloop_marketplace_city=bursa");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain(`Max-Age=${LOCATION_COOKIE_MAX_AGE_SECONDS}`);
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
  });
});
