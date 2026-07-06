export type NotificationPushReadinessStatus =
  | "blocked"
  | "planned"
  | "ready_for_sandbox"
  | "ready_for_sender";

export type NotificationPushReadinessRequirement = {
  key: string;
  label: string;
  status: "missing" | "planned" | "complete";
  requiredBeforeSend: true;
};

export type NotificationPushReadinessPreview = {
  status: NotificationPushReadinessStatus;
  deliveryAllowed: false;
  draftOnly: true;
  pushSenderEnabled: false;
  providerConfigured: false;
  tokenRegistryEnabled: true;
  tokenCollectionAllowed: false;
  consentRequired: true;
  auditRequired: true;
  idempotencyRequired: true;
  rateLimitRequired: true;
  requirements: NotificationPushReadinessRequirement[];
  blockedReasons: Array<
    | "push_sender_disabled"
    | "provider_not_configured"
    | "device_consent_missing"
    | "rate_limit_required"
    | "delivery_transition_required"
    | "admin_audit_required"
  >;
  rolloutStages: Array<{
    stage: "registry" | "sandbox" | "sender" | "production";
    status: "planned" | "blocked";
    note: string;
  }>;
  warning: string;
};

export function getNotificationPushReadinessPreview(): NotificationPushReadinessPreview {
  return {
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
    rateLimitRequired: true,
    requirements: [
      {
        key: "native_device_token_registry",
        label: "Native device token registry",
        status: "complete",
        requiredBeforeSend: true
      },
      {
        key: "device_consent_model",
        label: "Device-level push consent model",
        status: "missing",
        requiredBeforeSend: true
      },
      {
        key: "platform_token_validation",
        label: "Platform token validation and revocation",
        status: "complete",
        requiredBeforeSend: true
      },
      {
        key: "delivery_transition_model",
        label: "Delivery transition model",
        status: "complete",
        requiredBeforeSend: true
      },
      {
        key: "delivery_log_idempotency",
        label: "Delivery log idempotency and frequency window",
        status: "complete",
        requiredBeforeSend: true
      },
      {
        key: "provider_sandbox",
        label: "Push provider sandbox",
        status: "missing",
        requiredBeforeSend: true
      },
      {
        key: "retry_dead_letter_policy",
        label: "Retry and dead-letter policy",
        status: "missing",
        requiredBeforeSend: true
      },
      {
        key: "admin_audit",
        label: "Admin audit for sender activation",
        status: "planned",
        requiredBeforeSend: true
      },
      {
        key: "rate_limit",
        label: "Per-profile and per-device rate limit",
        status: "missing",
        requiredBeforeSend: true
      }
    ],
    blockedReasons: [
      "push_sender_disabled",
      "provider_not_configured",
      "device_consent_missing",
      "rate_limit_required",
      "delivery_transition_required",
      "admin_audit_required"
    ],
    rolloutStages: [
      {
        stage: "registry",
        status: "planned",
        note:
          "Mobile push token registry API ve hash-only storage hazırdır; bu preview native token toplamaz ve Expo/Firebase/APNs sender açmaz."
      },
      {
        stage: "sandbox",
        status: "blocked",
        note:
          "Provider sandbox, fake token testleri ve revocation davranışı tamamlanmadan push sender açılamaz."
      },
      {
        stage: "sender",
        status: "blocked",
        note:
          "Sender ancak delivery log transition, idempotency, retry/dead-letter ve audit sonrası açılabilir."
      },
      {
        stage: "production",
        status: "blocked",
        note:
          "Production push için consent, unsubscribe, rate limit, abuse guard ve observability gerekir."
      }
    ],
    warning:
      "Native push readiness preview yalnızca planlama/ops görünürlüğüdür; Expo, Firebase, APNs, push provider, queue, n8n veya webhook çağrısı yapmaz."
  };
}

export function assertNotificationPushSenderDisabled(): {
  deliveryAllowed: false;
  draftOnly: true;
  pushSenderEnabled: false;
  providerConfigured: false;
} {
  const preview = getNotificationPushReadinessPreview();

  return {
    deliveryAllowed: preview.deliveryAllowed,
    draftOnly: preview.draftOnly,
    pushSenderEnabled: preview.pushSenderEnabled,
    providerConfigured: preview.providerConfigured
  };
}
