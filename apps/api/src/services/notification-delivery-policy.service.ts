export type NotificationDeliveryCandidateKind = "child_lifecycle" | "saved_search" | "child_reminder";
export type NotificationDeliveryChannel = "in_app" | "email_draft" | "email" | "push" | "n8n";

export type NotificationDeliveryPolicyInput = {
  profileId: string;
  kind: NotificationDeliveryCandidateKind;
  sourceType: "child_profile" | "saved_search";
  sourceId: string;
  channel: NotificationDeliveryChannel;
  actionHref: string;
  cadence?: "off" | "weekly" | "monthly" | "yearly" | undefined;
};

export type NotificationDeliveryPolicyResult = {
  deliveryAllowed: false;
  draftOnly: true;
  dedupKey: string;
  frequencyWindowHours: number;
  blockedReasons: Array<
    | "delivery_disabled"
    | "delivery_log_required"
    | "provider_not_configured"
    | "frequency_policy_required"
    | "dedup_required"
  >;
  requirements: {
    consentRequired: true;
    deliveryLogRequired: true;
    idempotencyRequired: true;
    auditRequired: true;
  };
};

export type NotificationDeliveryPolicyPreview = {
  sendEnabled: false;
  draftOnly: true;
  defaultFrequencyWindowHours: number;
  childLifecycleFrequencyWindowHours: number;
  savedSearchFrequencyWindowHours: number;
  requiredBeforeSend: string[];
};

const DEFAULT_FREQUENCY_WINDOW_HOURS = 24;
const CHILD_LIFECYCLE_FREQUENCY_WINDOW_HOURS = 24 * 30;
const SAVED_SEARCH_FREQUENCY_WINDOW_HOURS = 24;

export function evaluateNotificationDeliveryPolicy(
  input: NotificationDeliveryPolicyInput
): NotificationDeliveryPolicyResult {
  const frequencyWindowHours = resolveFrequencyWindowHours(input);

  return {
    deliveryAllowed: false,
    draftOnly: true,
    dedupKey: buildNotificationDedupKey(input),
    frequencyWindowHours,
    blockedReasons: [
      "delivery_disabled",
      "delivery_log_required",
      "provider_not_configured",
      "frequency_policy_required",
      "dedup_required"
    ],
    requirements: {
      consentRequired: true,
      deliveryLogRequired: true,
      idempotencyRequired: true,
      auditRequired: true
    }
  };
}

export function getNotificationDeliveryPolicyPreview(): NotificationDeliveryPolicyPreview {
  return {
    sendEnabled: false,
    draftOnly: true,
    defaultFrequencyWindowHours: DEFAULT_FREQUENCY_WINDOW_HOURS,
    childLifecycleFrequencyWindowHours: CHILD_LIFECYCLE_FREQUENCY_WINDOW_HOURS,
    savedSearchFrequencyWindowHours: SAVED_SEARCH_FREQUENCY_WINDOW_HOURS,
    requiredBeforeSend: [
      "notification_delivery_logs schema",
      "dedup key unique policy",
      "frequency limiter",
      "provider sandbox",
      "admin audit trail",
      "idempotency key for n8n/email hooks"
    ]
  };
}

function resolveFrequencyWindowHours(input: NotificationDeliveryPolicyInput): number {
  if (input.kind === "child_lifecycle") {
    if (input.cadence === "weekly") {
      return 24 * 7;
    }

    if (input.cadence === "yearly") {
      return 24 * 365;
    }

    return CHILD_LIFECYCLE_FREQUENCY_WINDOW_HOURS;
  }

  if (input.kind === "child_reminder") {
    return 24;
  }

  if (input.kind === "saved_search") {
    return SAVED_SEARCH_FREQUENCY_WINDOW_HOURS;
  }

  return DEFAULT_FREQUENCY_WINDOW_HOURS;
}

function buildNotificationDedupKey(input: NotificationDeliveryPolicyInput): string {
  return [
    "notification",
    normalizeKeyPart(input.profileId),
    normalizeKeyPart(input.kind),
    normalizeKeyPart(input.sourceType),
    normalizeKeyPart(input.sourceId),
    normalizeKeyPart(input.channel),
    normalizeKeyPart(input.actionHref)
  ].join(":");
}

function normalizeKeyPart(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/[^a-z0-9ğüşöçıİ_-]+/giu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 160);
}
