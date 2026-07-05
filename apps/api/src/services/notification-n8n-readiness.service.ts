export type NotificationN8nReadinessStatus = "blocked" | "planned" | "ready_for_sandbox" | "ready_for_workflow";

export type NotificationN8nReadinessRequirement = {
  key: string;
  label: string;
  status: "missing" | "planned" | "complete";
  requiredBeforeWebhook: true;
};

export type NotificationN8nReadinessPreview = {
  status: NotificationN8nReadinessStatus;
  deliveryAllowed: false;
  draftOnly: true;
  n8nWorkflowEnabled: false;
  webhookConfigured: false;
  webhookCallsAllowed: false;
  queueEnabled: false;
  retryEnabled: false;
  idempotencyRequired: true;
  auditRequired: true;
  rateLimitRequired: true;
  consentRequired: true;
  requirements: NotificationN8nReadinessRequirement[];
  workflowCandidates: Array<{
    key: "child_lifecycle" | "child_reminder" | "saved_search";
    label: string;
    status: "candidate_ready" | "planned";
    note: string;
  }>;
  blockedReasons: Array<
    | "n8n_workflow_disabled"
    | "webhook_not_configured"
    | "queue_missing"
    | "retry_policy_required"
    | "idempotency_required"
    | "admin_audit_required"
    | "rate_limit_required"
    | "consent_required"
  >;
  rolloutStages: Array<{
    stage: "contract" | "sandbox" | "queue" | "production";
    status: "planned" | "blocked";
    note: string;
  }>;
  warning: string;
};

export function getNotificationN8nReadinessPreview(): NotificationN8nReadinessPreview {
  return {
    status: "blocked",
    deliveryAllowed: false,
    draftOnly: true,
    n8nWorkflowEnabled: false,
    webhookConfigured: false,
    webhookCallsAllowed: false,
    queueEnabled: false,
    retryEnabled: false,
    idempotencyRequired: true,
    auditRequired: true,
    rateLimitRequired: true,
    consentRequired: true,
    requirements: [
      {
        key: "webhook_contract",
        label: "Versioned webhook contract",
        status: "missing",
        requiredBeforeWebhook: true
      },
      {
        key: "idempotency_header",
        label: "Idempotency header/token",
        status: "complete",
        requiredBeforeWebhook: true
      },
      {
        key: "delivery_transition_model",
        label: "Delivery transition model",
        status: "complete",
        requiredBeforeWebhook: true
      },
      {
        key: "delivery_log_candidate_source",
        label: "Delivery log candidate source",
        status: "complete",
        requiredBeforeWebhook: true
      },
      {
        key: "signed_webhook_payload",
        label: "Signed webhook payload",
        status: "missing",
        requiredBeforeWebhook: true
      },
      {
        key: "queue_worker",
        label: "Queue worker and retry policy",
        status: "missing",
        requiredBeforeWebhook: true
      },
      {
        key: "dead_letter_policy",
        label: "Dead-letter and replay policy",
        status: "missing",
        requiredBeforeWebhook: true
      },
      {
        key: "admin_audit",
        label: "Admin audit for workflow activation",
        status: "planned",
        requiredBeforeWebhook: true
      },
      {
        key: "rate_limit",
        label: "Per-profile workflow rate limit",
        status: "missing",
        requiredBeforeWebhook: true
      },
      {
        key: "consent_model",
        label: "Workflow consent/preference model",
        status: "missing",
        requiredBeforeWebhook: true
      }
    ],
    workflowCandidates: [
      {
        key: "child_lifecycle",
        label: "Child lifecycle recommendations",
        status: "candidate_ready",
        note: "Candidate log ve frequency/idempotency zemini var; webhook çağrısı kapalıdır."
      },
      {
        key: "child_reminder",
        label: "Child reminders",
        status: "candidate_ready",
        note: "Reminder candidate log zemini var; n8n tetikleme yoktur."
      },
      {
        key: "saved_search",
        label: "Saved-search matches",
        status: "candidate_ready",
        note: "Saved-search/listing candidate log zemini var; n8n workflow gönderimi yoktur."
      }
    ],
    blockedReasons: [
      "n8n_workflow_disabled",
      "webhook_not_configured",
      "queue_missing",
      "retry_policy_required",
      "idempotency_required",
      "admin_audit_required",
      "rate_limit_required",
      "consent_required"
    ],
    rolloutStages: [
      {
        stage: "contract",
        status: "planned",
        note: "Webhook payload contract, schema version, signature ve idempotency header tasarlanacak."
      },
      {
        stage: "sandbox",
        status: "blocked",
        note: "Sandbox endpoint, fake workflow ve replay tests tamamlanmadan webhook aktive edilemez."
      },
      {
        stage: "queue",
        status: "blocked",
        note: "Queue worker, retry/backoff, dead-letter ve observability tamamlanmadan üretim workflow tetiklenemez."
      },
      {
        stage: "production",
        status: "blocked",
        note: "Production için consent, rate limit, admin audit, circuit breaker ve rollback planı gerekir."
      }
    ],
    warning:
      "n8n readiness preview yalnızca planlama/ops görünürlüğüdür; webhook, queue, worker, provider call, email, push veya gerçek n8n workflow tetiklemesi yapmaz."
  };
}

export function assertNotificationN8nDisabled(): {
  deliveryAllowed: false;
  draftOnly: true;
  n8nWorkflowEnabled: false;
  webhookConfigured: false;
  webhookCallsAllowed: false;
  queueEnabled: false;
} {
  const preview = getNotificationN8nReadinessPreview();

  return {
    deliveryAllowed: preview.deliveryAllowed,
    draftOnly: preview.draftOnly,
    n8nWorkflowEnabled: preview.n8nWorkflowEnabled,
    webhookConfigured: preview.webhookConfigured,
    webhookCallsAllowed: preview.webhookCallsAllowed,
    queueEnabled: preview.queueEnabled
  };
}
