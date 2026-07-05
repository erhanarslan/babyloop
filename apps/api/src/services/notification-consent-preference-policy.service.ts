export type NotificationPreferenceChannel = "email" | "push" | "in_app" | "n8n";
export type NotificationPreferenceSource = "child_reminder" | "saved_search" | "child_lifecycle" | "marketing" | "security";
export type NotificationPreferenceState = "allowed" | "blocked" | "missing_consent" | "muted" | "rate_limited";

export type NotificationConsentPreferenceInput = {
  source: NotificationPreferenceSource;
  channel: NotificationPreferenceChannel;
  userConsent: boolean;
  channelEnabled: boolean;
  sourceEnabled: boolean;
  mutedUntil?: Date | string | null;
  rateLimited?: boolean;
  blockedBySafety?: boolean;
};

export type NotificationConsentPreferenceDecision = {
  allowed: boolean;
  state: NotificationPreferenceState;
  source: NotificationPreferenceSource;
  channel: NotificationPreferenceChannel;
  reasonCode:
    | "consent_missing"
    | "channel_disabled"
    | "source_disabled"
    | "muted"
    | "rate_limited"
    | "blocked_by_safety"
    | "allowed";
  deliveryMutationAllowed: false;
  providerCallAllowed: false;
  auditRequired: true;
  preferenceRequiredBeforeDelivery: true;
  piiSafe: true;
};

export type NotificationConsentPreferencePreview = {
  status: "readiness_only";
  deliveryEnabled: false;
  providerCallsAllowed: false;
  consentRequiredBeforeDelivery: true;
  preferenceRequiredBeforeDelivery: true;
  optOutRequired: true;
  auditRequired: true;
  rateLimitRequired: true;
  blockedUserSafetyRequired: true;
  rawContactLoggingAllowed: false;
  supportedSources: NotificationPreferenceSource[];
  supportedChannels: NotificationPreferenceChannel[];
  requiredPreferenceScopes: string[];
  blockedUntilImplemented: string[];
  warning: string;
};

export function evaluateNotificationConsentPreference(
  input: NotificationConsentPreferenceInput
): NotificationConsentPreferenceDecision {
  const mutedUntil = normalizeDate(input.mutedUntil);
  const isMuted = Boolean(mutedUntil && mutedUntil.getTime() > Date.now());

  if (input.blockedBySafety) {
    return decision(input, "blocked", "blocked_by_safety");
  }

  if (!input.userConsent) {
    return decision(input, "missing_consent", "consent_missing");
  }

  if (!input.channelEnabled) {
    return decision(input, "blocked", "channel_disabled");
  }

  if (!input.sourceEnabled) {
    return decision(input, "blocked", "source_disabled");
  }

  if (isMuted) {
    return decision(input, "muted", "muted");
  }

  if (input.rateLimited) {
    return decision(input, "rate_limited", "rate_limited");
  }

  return decision(input, "allowed", "allowed", true);
}

export function getNotificationConsentPreferencePreview(): NotificationConsentPreferencePreview {
  return {
    status: "readiness_only",
    deliveryEnabled: false,
    providerCallsAllowed: false,
    consentRequiredBeforeDelivery: true,
    preferenceRequiredBeforeDelivery: true,
    optOutRequired: true,
    auditRequired: true,
    rateLimitRequired: true,
    blockedUserSafetyRequired: true,
    rawContactLoggingAllowed: false,
    supportedSources: ["child_reminder", "saved_search", "child_lifecycle", "marketing", "security"],
    supportedChannels: ["email", "push", "in_app", "n8n"],
    requiredPreferenceScopes: [
      "global notification opt-in/out",
      "channel-level email preference",
      "channel-level push preference",
      "channel-level in-app preference",
      "child reminder preference",
      "saved search preference",
      "child lifecycle recommendation preference",
      "marketing opt-in",
      "security notification override rules",
      "mute/snooze window",
      "audit of preference updates"
    ],
    blockedUntilImplemented: [
      "real email sending",
      "real push sending",
      "real n8n workflow triggering",
      "provider calls",
      "queue jobs",
      "raw contact logging",
      "unconsented delivery"
    ],
    warning:
      "Notification consent/preference policy is readiness-only; it does not enable real sending, provider calls, queue jobs, webhook calls, or raw contact logging."
  };
}

export function assertNotificationConsentPreferenceReadinessOnly(): {
  deliveryEnabled: false;
  providerCallsAllowed: false;
  consentRequiredBeforeDelivery: true;
  preferenceRequiredBeforeDelivery: true;
  rawContactLoggingAllowed: false;
} {
  const preview = getNotificationConsentPreferencePreview();

  return {
    deliveryEnabled: preview.deliveryEnabled,
    providerCallsAllowed: preview.providerCallsAllowed,
    consentRequiredBeforeDelivery: preview.consentRequiredBeforeDelivery,
    preferenceRequiredBeforeDelivery: preview.preferenceRequiredBeforeDelivery,
    rawContactLoggingAllowed: preview.rawContactLoggingAllowed
  };
}

function decision(
  input: NotificationConsentPreferenceInput,
  state: NotificationPreferenceState,
  reasonCode: NotificationConsentPreferenceDecision["reasonCode"],
  allowed = false
): NotificationConsentPreferenceDecision {
  return {
    allowed,
    state,
    source: input.source,
    channel: input.channel,
    reasonCode,
    deliveryMutationAllowed: false,
    providerCallAllowed: false,
    auditRequired: true,
    preferenceRequiredBeforeDelivery: true,
    piiSafe: true
  };
}

function normalizeDate(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
