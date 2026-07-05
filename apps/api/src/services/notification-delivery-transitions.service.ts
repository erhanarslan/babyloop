import type { NotificationDeliveryLogStatus } from "./notification-delivery-log.service.js";

export type NotificationDeliveryTransitionTargetStatus = Extract<
  NotificationDeliveryLogStatus,
  "blocked" | "sent" | "failed" | "skipped"
>;

export type NotificationDeliveryTransitionReason =
  | "draft_only_skip"
  | "draft_only_block"
  | "delivery_disabled"
  | "provider_not_configured"
  | "terminal_status"
  | "invalid_transition";

export type NotificationDeliveryTransitionDecision = {
  currentStatus: NotificationDeliveryLogStatus;
  targetStatus: NotificationDeliveryTransitionTargetStatus;
  allowed: boolean;
  deliveryAllowed: false;
  draftOnly: true;
  reason: NotificationDeliveryTransitionReason;
  requires: {
    deliveryLog: true;
    idempotencyKey: true;
    adminAudit: true;
    providerSandbox: true;
  };
  auditMetadata: Record<string, unknown>;
  note: string;
};

export type NotificationDeliveryTransitionInput = {
  currentStatus: NotificationDeliveryLogStatus;
  targetStatus: NotificationDeliveryTransitionTargetStatus;
  reason?: string | null;
  actorProfileId?: string | null;
  now?: Date;
};

export type NotificationDeliveryTransitionPreview = {
  draftOnly: true;
  deliveryAllowed: false;
  allowedDraftOnlyTransitions: Array<{
    from: NotificationDeliveryLogStatus;
    to: NotificationDeliveryTransitionTargetStatus;
    reason: NotificationDeliveryTransitionReason;
  }>;
  futureSenderTransitions: Array<{
    from: NotificationDeliveryLogStatus;
    to: Extract<NotificationDeliveryTransitionTargetStatus, "sent" | "failed">;
    blockedUntil: string[];
  }>;
  terminalStatuses: Array<Extract<NotificationDeliveryLogStatus, "sent" | "failed" | "skipped">>;
  privacyNote: string;
};

const TERMINAL_STATUSES = new Set<NotificationDeliveryLogStatus>(["sent", "failed", "skipped"]);

export function evaluateNotificationDeliveryTransition(
  input: NotificationDeliveryTransitionInput
): NotificationDeliveryTransitionDecision {
  const base = buildBaseDecision(input);

  if (TERMINAL_STATUSES.has(input.currentStatus)) {
    return {
      ...base,
      allowed: false,
      reason: "terminal_status",
      note:
        "Terminal notification delivery log statusleri yeniden transition edilmez; admin audit ile ayrı case açılmalıdır."
    };
  }

  if (input.targetStatus === "sent") {
    return {
      ...base,
      allowed: false,
      reason: "delivery_disabled",
      note:
        "Sent transition gerçek provider delivery gerektirir. Draft-only modda email, push, n8n veya queue gönderimi yapılamaz."
    };
  }

  if (input.targetStatus === "failed") {
    return {
      ...base,
      allowed: false,
      reason: "provider_not_configured",
      note:
        "Failed transition provider attempt/retry altyapısı sonrası anlamlıdır. Provider sandbox ve retry policy olmadan açılamaz."
    };
  }

  if (input.currentStatus === "candidate" && input.targetStatus === "blocked") {
    return {
      ...base,
      allowed: true,
      reason: "draft_only_block",
      note:
        "Candidate log draft-only policy veya frequency/idempotency sebebiyle blocked olarak işaretlenebilir; gönderim yapılmaz."
    };
  }

  if (
    (input.currentStatus === "candidate" || input.currentStatus === "blocked") &&
    input.targetStatus === "skipped"
  ) {
    return {
      ...base,
      allowed: true,
      reason: "draft_only_skip",
      note:
        "Candidate veya blocked log draft-only süreçte skipped olarak kapatılabilir; email, push, n8n veya queue gönderimi yapılmaz."
    };
  }

  return {
    ...base,
    allowed: false,
    reason: "invalid_transition",
    note: "Bu notification delivery transition yolu tanımlı değildir."
  };
}

export function getNotificationDeliveryTransitionPreview(): NotificationDeliveryTransitionPreview {
  return {
    draftOnly: true,
    deliveryAllowed: false,
    allowedDraftOnlyTransitions: [
      {
        from: "candidate",
        to: "blocked",
        reason: "draft_only_block"
      },
      {
        from: "candidate",
        to: "skipped",
        reason: "draft_only_skip"
      },
      {
        from: "blocked",
        to: "skipped",
        reason: "draft_only_skip"
      }
    ],
    futureSenderTransitions: [
      {
        from: "candidate",
        to: "sent",
        blockedUntil: [
          "deliveryAllowed=true policy",
          "provider sandbox",
          "idempotency key enforcement",
          "admin audit",
          "retry/dead-letter policy"
        ]
      },
      {
        from: "candidate",
        to: "failed",
        blockedUntil: [
          "provider attempt record",
          "retry/dead-letter policy",
          "admin audit",
          "safe failure reason taxonomy"
        ]
      }
    ],
    terminalStatuses: ["sent", "failed", "skipped"],
    privacyNote:
      "Transition preview aggregate/policy bilgisidir; metadata, idempotency key, dedup key, e-mail, token, cookie, authorization veya raw body göstermez."
  };
}

function buildBaseDecision(input: NotificationDeliveryTransitionInput): NotificationDeliveryTransitionDecision {
  return {
    currentStatus: input.currentStatus,
    targetStatus: input.targetStatus,
    allowed: false,
    deliveryAllowed: false,
    draftOnly: true,
    reason: "invalid_transition",
    requires: {
      deliveryLog: true,
      idempotencyKey: true,
      adminAudit: true,
      providerSandbox: true
    },
    auditMetadata: sanitizeTransitionAuditMetadata({
      requestedReason: input.reason ?? null,
      actorProfileId: input.actorProfileId ?? null,
      evaluatedAt: (input.now ?? new Date()).toISOString()
    }),
    note: "Notification delivery transition draft-only policy ile değerlendirilir; provider çağrısı yapılmaz."
  };
}

function sanitizeTransitionAuditMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (/email|phone|token|password|cookie|authorization|secret|otp|raw|body/iu.test(key)) {
      continue;
    }

    if (typeof value === "string") {
      safe[key] = value
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[redacted-email]")
        .replace(/\b(?:accessToken|refreshToken|passwordHash|otpCode|authorization|cookie|set-cookie)\b/giu, "[redacted-secret]")
        .slice(0, 240);
      continue;
    }

    if (typeof value === "number" || typeof value === "boolean" || value === null) {
      safe[key] = value;
    }
  }

  return safe;
}
