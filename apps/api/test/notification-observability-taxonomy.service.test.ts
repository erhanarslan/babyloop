import { describe, expect, it } from "vitest";
import {
  assertNotificationObservabilityReadinessOnly,
  getNotificationObservabilityTaxonomy
} from "../src/services/notification-observability-taxonomy.service.js";

describe("notification observability taxonomy", () => {
  it("defines privacy-safe notification events without enabling delivery", () => {
    const taxonomy = getNotificationObservabilityTaxonomy();

    expect(taxonomy).toMatchObject({
      status: "readiness_only",
      deliveryEnabled: false,
      providerCallsAllowed: false,
      rawPayloadLoggingAllowed: false,
      piiLoggingAllowed: false,
      metricsEnabled: false,
      tracingEnabled: false,
      dashboardReady: false
    });

    expect(taxonomy.events.map((event) => event.name)).toEqual(
      expect.arrayContaining([
        "notification.candidate.created",
        "notification.delivery.blocked",
        "notification.delivery.skipped",
        "notification.delivery.sent",
        "notification.delivery.failed",
        "notification.preference.updated",
        "notification.readiness.previewed",
        "notification.provider.sandbox_required",
        "notification.dead_letter.recorded",
        "notification.retry.scheduled",
        "notification.click.recorded"
      ])
    );

    expect(taxonomy.events.every((event) => event.deliveryMutationAllowed === false)).toBe(true);
    expect(taxonomy.events.every((event) => event.piiSafe === true)).toBe(true);
    expect(JSON.stringify(taxonomy)).not.toMatch(
      /parent@example\.com|\+905|access-token-secret|refresh-token-secret|otp-secret|raw-message-body-secret|raw-provider-response-secret|raw-webhook-payload-secret/iu
    );
  });

  it("lists required metrics and dashboards without enabling exporters", () => {
    const taxonomy = getNotificationObservabilityTaxonomy();

    expect(taxonomy.metrics.map((metric) => metric.name)).toEqual(
      expect.arrayContaining([
        "notification_candidates_total",
        "notification_blocked_total",
        "notification_skipped_total",
        "notification_provider_readiness_total"
      ])
    );
    expect(taxonomy.metrics.every((metric) => metric.piiSafe === true)).toBe(true);
    expect(taxonomy.dashboards.map((dashboard) => dashboard.key)).toEqual(
      expect.arrayContaining([
        "notification_readiness",
        "notification_preferences",
        "notification_retries_dead_letters",
        "notification_clicks"
      ])
    );
    expect(taxonomy.dashboards.every((dashboard) => dashboard.requiredBeforeProduction === true)).toBe(true);
  });

  it("keeps raw payload, provider, and PII logging disabled", () => {
    const taxonomy = getNotificationObservabilityTaxonomy();

    expect(taxonomy.privacyBoundary).toEqual({
      allowEmail: false,
      allowPhone: false,
      allowToken: false,
      allowCookie: false,
      allowOtp: false,
      allowRawMessageBody: false,
      allowRawProviderResponse: false,
      allowRawWebhookPayload: false
    });
    expect(taxonomy.warning).toContain("does not enable metrics exporters");
    expect(taxonomy.warning).toContain("raw payload logging");
  });

  it("exposes a compact readiness-only assertion", () => {
    expect(assertNotificationObservabilityReadinessOnly()).toEqual({
      deliveryEnabled: false,
      providerCallsAllowed: false,
      rawPayloadLoggingAllowed: false,
      piiLoggingAllowed: false,
      metricsEnabled: false,
      tracingEnabled: false
    });
  });
});
