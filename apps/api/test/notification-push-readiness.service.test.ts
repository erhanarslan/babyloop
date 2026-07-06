import { describe, expect, it } from "vitest";
import {
  assertNotificationPushSenderDisabled,
  getNotificationPushReadinessPreview
} from "../src/services/notification-push-readiness.service.js";

describe("notification push readiness", () => {
  it("keeps native push blocked and draft-only", () => {
    const preview = getNotificationPushReadinessPreview();

    expect(preview).toMatchObject({
      status: "blocked",
      deliveryAllowed: false,
      draftOnly: true,
      pushSenderEnabled: false,
      providerConfigured: false,
      tokenRegistryEnabled: true,
      tokenCollectionAllowed: false,
      consentRequired: true,
      auditRequired: true,
      idempotencyRequired: true,
      rateLimitRequired: true
    });
    expect(preview.blockedReasons).toContain("push_sender_disabled");
    expect(preview.blockedReasons).toContain("provider_not_configured");
    expect(preview.blockedReasons).not.toContain("token_registry_missing");
    expect(preview.warning).toContain("Expo, Firebase, APNs");
    expect(JSON.stringify(preview)).not.toMatch(/sendPush|getExpoPushTokenAsync|expo-notifications|firebase-admin|apn\.Provider|fetch\(|https:\/\/exp\.host|n8n hook|webhook called/iu);
  });

  it("lists all requirements before enabling push sender", () => {
    const preview = getNotificationPushReadinessPreview();
    const requirementKeys = preview.requirements.map((requirement) => requirement.key);

    expect(requirementKeys).toEqual(
      expect.arrayContaining([
        "native_device_token_registry",
        "device_consent_model",
        "platform_token_validation",
        "delivery_transition_model",
        "delivery_log_idempotency",
        "provider_sandbox",
        "retry_dead_letter_policy",
        "admin_audit",
        "rate_limit"
      ])
    );
    expect(preview.requirements.every((requirement) => requirement.requiredBeforeSend)).toBe(true);
    expect(preview.requirements.find((requirement) => requirement.key === "delivery_transition_model")?.status).toBe("complete");
    expect(preview.requirements.find((requirement) => requirement.key === "native_device_token_registry")?.status).toBe("complete");
    expect(preview.requirements.find((requirement) => requirement.key === "platform_token_validation")?.status).toBe("complete");
  });

  it("exposes a compact sender-disabled assertion for release gates", () => {
    expect(assertNotificationPushSenderDisabled()).toEqual({
      deliveryAllowed: false,
      draftOnly: true,
      pushSenderEnabled: false,
      providerConfigured: false
    });
  });
});
