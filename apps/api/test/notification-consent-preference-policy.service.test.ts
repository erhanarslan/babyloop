import { describe, expect, it } from "vitest";
import {
  assertNotificationConsentPreferenceReadinessOnly,
  evaluateNotificationConsentPreference,
  getNotificationConsentPreferencePreview
} from "../src/services/notification-consent-preference-policy.service.js";

describe("notification consent preference policy", () => {
  it("blocks delivery when consent is missing", () => {
    const decision = evaluateNotificationConsentPreference({
      source: "child_reminder",
      channel: "push",
      userConsent: false,
      channelEnabled: true,
      sourceEnabled: true
    });

    expect(decision).toMatchObject({
      allowed: false,
      state: "missing_consent",
      reasonCode: "consent_missing",
      deliveryMutationAllowed: false,
      providerCallAllowed: false,
      auditRequired: true,
      preferenceRequiredBeforeDelivery: true,
      piiSafe: true
    });
  });

  it("blocks disabled channels, disabled sources, mutes, safety blocks, and rate limits", () => {
    expect(
      evaluateNotificationConsentPreference({
        source: "saved_search",
        channel: "email",
        userConsent: true,
        channelEnabled: false,
        sourceEnabled: true
      }).reasonCode
    ).toBe("channel_disabled");

    expect(
      evaluateNotificationConsentPreference({
        source: "saved_search",
        channel: "email",
        userConsent: true,
        channelEnabled: true,
        sourceEnabled: false
      }).reasonCode
    ).toBe("source_disabled");

    expect(
      evaluateNotificationConsentPreference({
        source: "child_lifecycle",
        channel: "in_app",
        userConsent: true,
        channelEnabled: true,
        sourceEnabled: true,
        mutedUntil: new Date(Date.now() + 60_000)
      }).reasonCode
    ).toBe("muted");

    expect(
      evaluateNotificationConsentPreference({
        source: "trust_safety",
        channel: "n8n",
        userConsent: true,
        channelEnabled: true,
        sourceEnabled: true,
        blockedBySafety: true
      }).reasonCode
    ).toBe("blocked_by_safety");

    expect(
      evaluateNotificationConsentPreference({
        source: "child_reminder",
        channel: "push",
        userConsent: true,
        channelEnabled: true,
        sourceEnabled: true,
        rateLimited: true
      }).reasonCode
    ).toBe("rate_limited");
  });

  it("allows only policy-approved candidates while keeping provider calls disabled", () => {
    const decision = evaluateNotificationConsentPreference({
      source: "trust_safety",
      channel: "in_app",
      userConsent: true,
      channelEnabled: true,
      sourceEnabled: true
    });

    expect(decision).toEqual({
      allowed: true,
      state: "allowed",
      source: "trust_safety",
      channel: "in_app",
      reasonCode: "allowed",
      deliveryMutationAllowed: false,
      providerCallAllowed: false,
      auditRequired: true,
      preferenceRequiredBeforeDelivery: true,
      piiSafe: true
    });
  });

  it("exposes readiness preview with required preference scopes", () => {
    const preview = getNotificationConsentPreferencePreview();

    expect(preview).toMatchObject({
      status: "readiness_only",
      deliveryEnabled: false,
      providerCallsAllowed: false,
      consentRequiredBeforeDelivery: true,
      preferenceRequiredBeforeDelivery: true,
      optOutRequired: true,
      auditRequired: true,
      rateLimitRequired: true,
      blockedUserSafetyRequired: true,
      rawContactLoggingAllowed: false
    });
    expect(preview.requiredPreferenceScopes).toEqual(
      expect.arrayContaining([
        "global notification opt-in/out",
        "channel-level email preference",
        "channel-level push preference",
        "child reminder preference",
        "saved search preference",
        "marketplace preference",
        "messages preference",
        "audit of preference updates"
      ])
    );
    expect(preview.blockedUntilImplemented).toEqual(
      expect.arrayContaining(["real email sending", "real push sending", "real n8n workflow triggering"])
    );
    expect(JSON.stringify(preview)).not.toMatch(/parent@example\.com|\+905|access-token-secret|refresh-token-secret|otp-secret|raw-contact-secret/iu);
  });

  it("exposes compact readiness-only assertion", () => {
    expect(assertNotificationConsentPreferenceReadinessOnly()).toEqual({
      deliveryEnabled: false,
      providerCallsAllowed: false,
      consentRequiredBeforeDelivery: true,
      preferenceRequiredBeforeDelivery: true,
      rawContactLoggingAllowed: false
    });
  });
});
