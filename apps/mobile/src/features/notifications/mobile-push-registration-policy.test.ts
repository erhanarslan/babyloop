import {
  getMobilePushRegistrationRetryDelay,
  isMobilePushRegistrationCacheFresh,
  shouldStopMobilePushRegistration
} from "./mobile-push-registration-policy";

describe("mobile push registration policy", () => {
  it("uses bounded exponential-style retry delays", () => {
    expect([1, 2, 3, 4, 9].map(getMobilePushRegistrationRetryDelay)).toEqual([
      5_000,
      15_000,
      30_000,
      60_000,
      60_000
    ]);
  });

  it("stops only for successful, denied, or non-retryable device results", () => {
    expect(shouldStopMobilePushRegistration({ status: "registered" })).toBe(true);
    expect(shouldStopMobilePushRegistration({ status: "denied", reason: "permission_denied" })).toBe(true);
    expect(shouldStopMobilePushRegistration({ status: "unavailable", reason: "physical_device_required" })).toBe(true);
    expect(shouldStopMobilePushRegistration({ status: "error", reason: "push_token_register_failed" })).toBe(false);
    expect(shouldStopMobilePushRegistration({ status: "unavailable", reason: "missing_expo_push_token" })).toBe(false);
  });

  it("accepts only a recent cache entry for the same profile", () => {
    const input = {
      cachedProfileId: "profile-1",
      currentProfileId: "profile-1",
      now: 200_000,
      registeredAt: 150_000,
      ttlMs: 100_000
    };

    expect(isMobilePushRegistrationCacheFresh(input)).toBe(true);
    expect(isMobilePushRegistrationCacheFresh({ ...input, currentProfileId: "profile-2" })).toBe(false);
    expect(isMobilePushRegistrationCacheFresh({ ...input, now: 300_001 })).toBe(false);
  });
});
