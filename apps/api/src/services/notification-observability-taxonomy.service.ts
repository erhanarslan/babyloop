export type NotificationObservabilityEventName =
  | "notification.candidate.created"
  | "notification.delivery.blocked"
  | "notification.delivery.skipped"
  | "notification.delivery.sent"
  | "notification.delivery.failed"
  | "notification.preference.updated"
  | "notification.readiness.previewed"
  | "notification.provider.sandbox_required"
  | "notification.dead_letter.recorded"
  | "notification.retry.scheduled"
  | "notification.click.recorded";

export type NotificationObservabilityChannel = "email" | "push" | "in_app" | "n8n" | "none";

export type NotificationObservabilityDimension =
  | "event_name"
  | "channel"
  | "delivery_status"
  | "notification_kind"
  | "source"
  | "environment"
  | "draft_only"
  | "provider_enabled"
  | "preference_state"
  | "age_band"
  | "reason_code";

export type NotificationObservabilityMetric = {
  name: string;
  description: string;
  dimensions: NotificationObservabilityDimension[];
  piiSafe: true;
};

export type NotificationObservabilityTaxonomyEvent = {
  name: NotificationObservabilityEventName;
  channel: NotificationObservabilityChannel;
  description: string;
  deliveryMutationAllowed: false;
  piiSafe: true;
  allowedDimensions: NotificationObservabilityDimension[];
  forbiddenFields: string[];
};

export type NotificationObservabilityTaxonomy = {
  status: "readiness_only";
  deliveryEnabled: false;
  providerCallsAllowed: false;
  rawPayloadLoggingAllowed: false;
  piiLoggingAllowed: false;
  metricsEnabled: false;
  tracingEnabled: false;
  dashboardReady: false;
  events: NotificationObservabilityTaxonomyEvent[];
  metrics: NotificationObservabilityMetric[];
  dashboards: Array<{
    key: string;
    title: string;
    status: "planned" | "blocked";
    requiredBeforeProduction: true;
  }>;
  privacyBoundary: {
    allowEmail: false;
    allowPhone: false;
    allowToken: false;
    allowCookie: false;
    allowOtp: false;
    allowRawMessageBody: false;
    allowRawProviderResponse: false;
    allowRawWebhookPayload: false;
  };
  warning: string;
};

const FORBIDDEN_FIELDS = [
  "email",
  "phone",
  "accessToken",
  "refreshToken",
  "cookie",
  "otp",
  "password",
  "rawMessageBody",
  "rawProviderResponse",
  "rawWebhookPayload",
  "authorization",
  "providerSecret"
];

export function getNotificationObservabilityTaxonomy(): NotificationObservabilityTaxonomy {
  const safeBaseDimensions: NotificationObservabilityDimension[] = [
    "event_name",
    "channel",
    "delivery_status",
    "notification_kind",
    "source",
    "environment",
    "draft_only",
    "provider_enabled",
    "reason_code"
  ];

  return {
    status: "readiness_only",
    deliveryEnabled: false,
    providerCallsAllowed: false,
    rawPayloadLoggingAllowed: false,
    piiLoggingAllowed: false,
    metricsEnabled: false,
    tracingEnabled: false,
    dashboardReady: false,
    events: [
      {
        name: "notification.candidate.created",
        channel: "none",
        description: "A notification candidate was created in draft-only readiness mode.",
        deliveryMutationAllowed: false,
        piiSafe: true,
        allowedDimensions: [...safeBaseDimensions, "age_band"],
        forbiddenFields: FORBIDDEN_FIELDS
      },
      {
        name: "notification.delivery.blocked",
        channel: "none",
        description: "A candidate was blocked before delivery because a readiness boundary prevented sending.",
        deliveryMutationAllowed: false,
        piiSafe: true,
        allowedDimensions: safeBaseDimensions,
        forbiddenFields: FORBIDDEN_FIELDS
      },
      {
        name: "notification.delivery.skipped",
        channel: "none",
        description: "A candidate was intentionally skipped, for example because of preference, consent, or frequency limits.",
        deliveryMutationAllowed: false,
        piiSafe: true,
        allowedDimensions: [...safeBaseDimensions, "preference_state"],
        forbiddenFields: FORBIDDEN_FIELDS
      },
      {
        name: "notification.delivery.sent",
        channel: "none",
        description: "Reserved taxonomy event for future sent-state metrics; real sending remains disabled.",
        deliveryMutationAllowed: false,
        piiSafe: true,
        allowedDimensions: safeBaseDimensions,
        forbiddenFields: FORBIDDEN_FIELDS
      },
      {
        name: "notification.delivery.failed",
        channel: "none",
        description: "Reserved taxonomy event for future failed-state metrics; provider response must remain redacted.",
        deliveryMutationAllowed: false,
        piiSafe: true,
        allowedDimensions: safeBaseDimensions,
        forbiddenFields: FORBIDDEN_FIELDS
      },
      {
        name: "notification.preference.updated",
        channel: "none",
        description: "A notification preference was updated without logging private user contact data.",
        deliveryMutationAllowed: false,
        piiSafe: true,
        allowedDimensions: ["event_name", "preference_state", "environment", "source"],
        forbiddenFields: FORBIDDEN_FIELDS
      },
      {
        name: "notification.readiness.previewed",
        channel: "none",
        description: "Backoffice readiness preview was viewed without exposing secrets or recipient details.",
        deliveryMutationAllowed: false,
        piiSafe: true,
        allowedDimensions: ["event_name", "environment", "draft_only", "provider_enabled", "source"],
        forbiddenFields: FORBIDDEN_FIELDS
      },
      {
        name: "notification.provider.sandbox_required",
        channel: "none",
        description: "A provider action remained blocked because sandbox validation is required first.",
        deliveryMutationAllowed: false,
        piiSafe: true,
        allowedDimensions: safeBaseDimensions,
        forbiddenFields: FORBIDDEN_FIELDS
      },
      {
        name: "notification.dead_letter.recorded",
        channel: "none",
        description: "Reserved taxonomy event for future dead-letter records; raw payloads must remain blocked.",
        deliveryMutationAllowed: false,
        piiSafe: true,
        allowedDimensions: safeBaseDimensions,
        forbiddenFields: FORBIDDEN_FIELDS
      },
      {
        name: "notification.retry.scheduled",
        channel: "none",
        description: "Reserved taxonomy event for future retry scheduling; queue worker remains disabled.",
        deliveryMutationAllowed: false,
        piiSafe: true,
        allowedDimensions: safeBaseDimensions,
        forbiddenFields: FORBIDDEN_FIELDS
      },
      {
        name: "notification.click.recorded",
        channel: "none",
        description: "Reserved taxonomy event for future click tracking with privacy-safe identifiers only.",
        deliveryMutationAllowed: false,
        piiSafe: true,
        allowedDimensions: ["event_name", "channel", "notification_kind", "environment", "source"],
        forbiddenFields: FORBIDDEN_FIELDS
      }
    ],
    metrics: [
      {
        name: "notification_candidates_total",
        description: "Count of draft-only notification candidates by kind, source, and environment.",
        dimensions: ["notification_kind", "source", "environment", "draft_only"],
        piiSafe: true
      },
      {
        name: "notification_blocked_total",
        description: "Count of notification candidates blocked before real delivery.",
        dimensions: ["notification_kind", "reason_code", "environment", "provider_enabled"],
        piiSafe: true
      },
      {
        name: "notification_skipped_total",
        description: "Count of notification candidates skipped due to preferences, consent, or frequency limits.",
        dimensions: ["notification_kind", "preference_state", "reason_code", "environment"],
        piiSafe: true
      },
      {
        name: "notification_provider_readiness_total",
        description: "Count of readiness checks by provider-enabled state without provider calls.",
        dimensions: ["channel", "provider_enabled", "environment"],
        piiSafe: true
      }
    ],
    dashboards: [
      {
        key: "notification_readiness",
        title: "Notification readiness and blocked delivery",
        status: "planned",
        requiredBeforeProduction: true
      },
      {
        key: "notification_preferences",
        title: "Notification consent and preference outcomes",
        status: "planned",
        requiredBeforeProduction: true
      },
      {
        key: "notification_retries_dead_letters",
        title: "Notification retry and dead-letter outcomes",
        status: "blocked",
        requiredBeforeProduction: true
      },
      {
        key: "notification_clicks",
        title: "Notification click tracking outcomes",
        status: "blocked",
        requiredBeforeProduction: true
      }
    ],
    privacyBoundary: {
      allowEmail: false,
      allowPhone: false,
      allowToken: false,
      allowCookie: false,
      allowOtp: false,
      allowRawMessageBody: false,
      allowRawProviderResponse: false,
      allowRawWebhookPayload: false
    },
    warning:
      "Notification observability taxonomy is readiness-only; it does not enable metrics exporters, tracing exporters, provider calls, queue jobs, webhook calls, real email sending, real push sending, real n8n workflow triggering, or raw payload logging."
  };
}

export function assertNotificationObservabilityReadinessOnly(): {
  deliveryEnabled: false;
  providerCallsAllowed: false;
  rawPayloadLoggingAllowed: false;
  piiLoggingAllowed: false;
  metricsEnabled: false;
  tracingEnabled: false;
} {
  const taxonomy = getNotificationObservabilityTaxonomy();

  return {
    deliveryEnabled: taxonomy.deliveryEnabled,
    providerCallsAllowed: taxonomy.providerCallsAllowed,
    rawPayloadLoggingAllowed: taxonomy.rawPayloadLoggingAllowed,
    piiLoggingAllowed: taxonomy.piiLoggingAllowed,
    metricsEnabled: taxonomy.metricsEnabled,
    tracingEnabled: taxonomy.tracingEnabled
  };
}
