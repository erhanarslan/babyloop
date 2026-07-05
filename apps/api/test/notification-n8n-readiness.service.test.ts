import { describe, expect, it } from "vitest";
import {
  assertNotificationN8nDisabled,
  getNotificationN8nReadinessPreview
} from "../src/services/notification-n8n-readiness.service.js";

describe("notification n8n readiness", () => {
  it("keeps n8n workflows blocked and draft-only", () => {
    const preview = getNotificationN8nReadinessPreview();

    expect(preview).toMatchObject({
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
      consentRequired: true
    });
    expect(preview.blockedReasons).toContain("n8n_workflow_disabled");
    expect(preview.blockedReasons).toContain("webhook_not_configured");
    expect(preview.blockedReasons).toContain("queue_missing");
    expect(preview.warning).toContain("webhook, queue, worker");
    expect(JSON.stringify(preview)).not.toMatch(/sendN8n|triggerN8n|executeWorkflow|fetch\(|https:\/\/hooks\.|N8N_WEBHOOK_URL|WEBHOOK_SECRET=|queue\.add|bullmq|resend\.emails\.send|sendPush/iu);
  });

  it("lists requirements before enabling n8n workflow delivery", () => {
    const preview = getNotificationN8nReadinessPreview();
    const requirementKeys = preview.requirements.map((requirement) => requirement.key);

    expect(requirementKeys).toEqual(
      expect.arrayContaining([
        "webhook_contract",
        "idempotency_header",
        "delivery_transition_model",
        "delivery_log_candidate_source",
        "signed_webhook_payload",
        "queue_worker",
        "dead_letter_policy",
        "admin_audit",
        "rate_limit",
        "consent_model"
      ])
    );
    expect(preview.requirements.every((requirement) => requirement.requiredBeforeWebhook)).toBe(true);
    expect(preview.requirements.find((requirement) => requirement.key === "idempotency_header")?.status).toBe("complete");
    expect(preview.requirements.find((requirement) => requirement.key === "webhook_contract")?.status).toBe("missing");
  });

  it("shows current workflow candidate sources without invoking workflows", () => {
    const preview = getNotificationN8nReadinessPreview();

    expect(preview.workflowCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "child_lifecycle", status: "candidate_ready" }),
        expect.objectContaining({ key: "child_reminder", status: "candidate_ready" }),
        expect.objectContaining({ key: "saved_search", status: "candidate_ready" })
      ])
    );
    expect(JSON.stringify(preview.workflowCandidates)).toContain("n8n workflow gönderimi yoktur");
  });

  it("exposes a compact n8n-disabled assertion for release gates", () => {
    expect(assertNotificationN8nDisabled()).toEqual({
      deliveryAllowed: false,
      draftOnly: true,
      n8nWorkflowEnabled: false,
      webhookConfigured: false,
      webhookCallsAllowed: false,
      queueEnabled: false
    });
  });
});
