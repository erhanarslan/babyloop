import { describe, expect, it } from "vitest";
import {
  isNotificationEmailProviderConfigured,
  isNotificationN8nProviderConfigured,
  isNotificationPushProviderConfigured
} from "../src/services/notification-email-config.service.js";
import { getNotificationPreferenceSummary } from "../src/services/notification-preferences.service.js";

describe("notification provider configuration", () => {
  it("requires every Resend email gate and reports email independently", () => {
    const env = {
      NOTIFICATION_EMAIL_ENABLED: "true",
      NOTIFICATION_EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "test-key",
      RESEND_FROM_EMAIL: "no-reply@example.test"
    };

    expect(isNotificationEmailProviderConfigured(env)).toBe(true);
    expect(getNotificationPreferenceSummary(env)).toMatchObject({
      deliveryProvidersEnabled: true,
      providerCallsAllowed: true,
      emailProviderEnabled: true,
      draftOnlyChannels: ["push", "n8n", "sms"]
    });
    expect(isNotificationEmailProviderConfigured({
      ...env,
      RESEND_API_KEY: ""
    })).toBe(false);
  });

  it("reuses the active authentication Resend configuration by default", () => {
    const env = {
      EMAIL_SEND_ENABLED: "true",
      EMAIL_PROVIDER: "resend",
      EMAIL_FROM: "BabyLoop <no-reply@example.test>",
      RESEND_API_KEY: "test-key"
    };

    expect(isNotificationEmailProviderConfigured(env)).toBe(true);
    expect(isNotificationEmailProviderConfigured({
      ...env,
      NOTIFICATION_EMAIL_ENABLED: "false"
    })).toBe(false);
  });

  it("detects push and n8n without misreporting email as active", () => {
    const env = {
      NOTIFICATION_PUSH_ENABLED: "true",
      PUSH_PROVIDER: "expo",
      EXPO_ACCESS_TOKEN: "test-expo-token",
      N8N_NOTIFICATION_WEBHOOK_ENABLED: "true",
      N8N_NOTIFICATION_WEBHOOK_URL: "https://n8n.example.test/hook"
    };
    const summary = getNotificationPreferenceSummary(env);

    expect(isNotificationPushProviderConfigured(env)).toBe(true);
    expect(isNotificationN8nProviderConfigured(env)).toBe(true);
    expect(summary.deliveryProvidersEnabled).toBe(true);
    expect(summary.emailProviderEnabled).toBe(false);
    expect(summary.draftOnlyChannels).toEqual(["email", "sms"]);
  });
});
