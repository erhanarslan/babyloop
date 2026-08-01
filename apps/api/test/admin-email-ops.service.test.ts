import type { FastifyInstance } from "fastify";
import { describe, expect, it, vi } from "vitest";
import {
  getAdminEmailOpsPreview,
  createAdminEmailOpsState,
  AdminEmailOpsError,
  sendAdminTestEmail
} from "../src/services/admin-email-ops.service.js";
import type { EmailDraft, EmailSendResult } from "../src/services/email-provider.service.js";

const app = {} as FastifyInstance;
const allowedEnv = {
  EMAIL_PROVIDER: "smtp",
  NOTIFICATION_SMOKE_RECIPIENT_EMAIL: "admin@example.test"
};

describe("admin email ops service", () => {
  it("returns sandbox preview by default without secrets", async () => {
    const preview = await getAdminEmailOpsPreview(app, {
      EMAIL_PROVIDER: "smtp",
      EMAIL_FROM: "BabyLoop <hello@example.test>",
      SMTP_HOST: "smtp.example.test",
      SMTP_PASS: "secret-pass",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
      SMTP_USER: "smtp-user"
    });

    expect(preview.emailProvider.driver).toBe("smtp");
    expect(preview.emailProvider.sendEnabled).toBe(false);
    expect(preview.emailProvider.sandboxOnly).toBe(true);
    expect(preview.emailProvider.providerConfigured).toBe(true);
    expect(preview.supportedIntents).toEqual([
      "email_verification",
      "password_reset",
      "notification_digest",
      "security_alert"
    ]);
    expect(preview.warning).toContain("Gönderim kapalı");
    expect(JSON.stringify(preview)).not.toContain("secret-pass");
    expect(JSON.stringify(preview)).not.toContain("smtp-user");
  });

  it("returns real-send readiness when the explicit SMTP kill-switch is enabled", async () => {
    const preview = await getAdminEmailOpsPreview(app, {
      EMAIL_PROVIDER: "smtp",
      EMAIL_SEND_ENABLED: "true",
      EMAIL_FROM: "BabyLoop <hello@example.test>",
      SMTP_HOST: "smtp.example.test",
      SMTP_PASS: "secret-pass",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
      SMTP_USER: "smtp-user"
    });

    expect(preview.emailProvider.driver).toBe("smtp");
    expect(preview.emailProvider.sendEnabled).toBe(true);
    expect(preview.emailProvider.sandboxOnly).toBe(false);
    expect(preview.emailProvider.providerConfigured).toBe(true);
    expect(preview.warning).toContain("Gerçek gönderim açık");
    expect(JSON.stringify(preview)).not.toContain("secret-pass");
    expect(JSON.stringify(preview)).not.toContain("smtp-user");
  });

  it("reports missing SMTP configuration safely", async () => {
    const preview = await getAdminEmailOpsPreview(app, {
      EMAIL_PROVIDER: "smtp",
      EMAIL_SEND_ENABLED: "true",
      EMAIL_FROM: "BabyLoop <hello@example.test>"
    });

    expect(preview.emailProvider.providerConfigured).toBe(false);
    expect(preview.emailProvider.missingConfigurationCount).toBe(4);
    expect(JSON.stringify(preview)).not.toContain("undefined");
  });

  it("does not leak Resend secrets in preview", async () => {
    const preview = await getAdminEmailOpsPreview(app, {
      EMAIL_PROVIDER: "resend",
      EMAIL_FROM: "BabyLoop <hello@example.test>",
      RESEND_API_KEY: "secret-resend-key"
    });

    expect(preview.emailProvider.driver).toBe("resend");
    expect(preview.emailProvider.providerConfigured).toBe(true);
    expect(JSON.stringify(preview)).not.toContain("secret-resend-key");
  });

  it("builds and sends a controlled sandbox test email draft", async () => {
    const drafts: EmailDraft[] = [];
    const result = await sendAdminTestEmail(
      app,
      {
        to: "admin@example.test",
        intent: "security_alert",
        note: "  smoke   test \n note  ",
        confirmation: "SEND_TEST_EMAIL",
        idempotencyKey: "44444444-4444-4444-8444-444444444444"
      },
      {
        audit: async () => undefined,
        env: allowedEnv,
        state: createAdminEmailOpsState(),
        sendDraft: async (draft) => {
          drafts.push(draft);

          return {
            sent: false,
            provider: "smtp",
            sandboxOnly: true,
            reason: "email_delivery_disabled"
          } satisfies EmailSendResult;
        }
      }
    );

    expect(result).toMatchObject({
      intent: "security_alert",
      status: "not_sent",
      provider: "smtp",
      sandboxOnly: true,
      errorCategory: "delivery_disabled",
      recipientMasked: "a***@example.test"
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      to: "admin@example.test",
      intent: "security_alert",
      subject: "BabyLoop kontrollü e-posta testi - security_alert"
    });
    expect(drafts[0]!.text).toContain("Senaryo: security_alert");
    expect(drafts[0]!.text).toContain("Not: smoke test note");
    expect(drafts[0]!.text).not.toContain("verification token:");
    expect(drafts[0]!.text).not.toContain("reset token:");
    expect(drafts[0]!.text).not.toContain("session");
  });

  it("returns sent result when provider accepts the admin test email", async () => {
    const audit = vi.fn(async () => undefined);
    const result = await sendAdminTestEmail(
      app,
      {
        to: "admin@example.test",
        intent: "email_verification",
        confirmation: "SEND_TEST_EMAIL",
        idempotencyKey: "55555555-5555-4555-8555-555555555555"
      },
      {
        audit,
        env: allowedEnv,
        state: createAdminEmailOpsState(),
        sendDraft: async () => ({
          sent: true,
          provider: "smtp",
          sandboxOnly: false,
          messageId: "smtp-test-message-id"
        })
      }
    );

    expect(result).toMatchObject({
      intent: "email_verification",
      status: "accepted",
      provider: "smtp",
      sandboxOnly: false,
      deliveryReference: "smtp-…e-id",
      errorCategory: null
    });
    expect(audit).toHaveBeenCalledTimes(2);
    expect(audit).toHaveBeenLastCalledWith({
      eventType: "admin_email_test_send_completed",
      metadata: {
        category: "accepted",
        intent: "email_verification",
        provider: "smtp"
      }
    });
    expect(JSON.stringify(audit.mock.calls)).not.toContain("admin@example.test");
  });

  it("classifies provider failures without leaking the provider response", async () => {
    const audit = vi.fn(async () => undefined);
    const result = await sendAdminTestEmail(
      app,
      {
        to: "admin@example.test",
        intent: "security_alert",
        confirmation: "SEND_TEST_EMAIL",
        idempotencyKey: "56565656-5656-4656-8656-565656565656"
      },
      {
        audit,
        env: allowedEnv,
        state: createAdminEmailOpsState(),
        sendDraft: async () => {
          throw new Error("SMTP provider rejected: secret-response-body");
        }
      }
    );

    expect(result).toMatchObject({
      errorCategory: "provider_rejected",
      status: "not_sent",
      deliveryReference: null
    });
    expect(JSON.stringify(result)).not.toContain("secret-response-body");
    expect(audit).toHaveBeenLastCalledWith({
      eventType: "admin_email_test_send_failed",
      metadata: {
        category: "provider_rejected",
        intent: "security_alert",
        provider: "smtp"
      }
    });
  });

  it("deduplicates the same request and rejects a different payload for the same key", async () => {
    const state = createAdminEmailOpsState();
    const sendDraft = vi.fn(async () => ({ sent: true, provider: "smtp", sandboxOnly: false, messageId: "delivery-1" } as const));
    const body = {
      to: "admin@example.test",
      intent: "security_alert" as const,
      confirmation: "SEND_TEST_EMAIL" as const,
      idempotencyKey: "66666666-6666-4666-8666-666666666666"
    };
    const options = { audit: async () => undefined, env: allowedEnv, sendDraft, state };

    const [first, second] = await Promise.all([sendAdminTestEmail(app, body, options), sendAdminTestEmail(app, body, options)]);
    expect(sendDraft).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    await expect(sendAdminTestEmail(app, { ...body, intent: "password_reset" }, options)).rejects.toMatchObject({
      category: "invalid_recipient"
    } satisfies Partial<AdminEmailOpsError>);
  });

  it("does not resend after an outcome audit write failure", async () => {
    const state = createAdminEmailOpsState();
    const sendDraft = vi.fn(async () => ({
      sent: true,
      provider: "smtp",
      sandboxOnly: false,
      messageId: "delivery-audit-failure"
    } as const));
    const audit = vi.fn(async ({ eventType }: { eventType: string }) => {
      if (eventType === "admin_email_test_send_completed") {
        throw new Error("local audit store unavailable");
      }
    });
    const logError = vi.fn();
    const appWithLog = { log: { error: logError } } as unknown as FastifyInstance;
    const body = {
      to: "admin@example.test",
      intent: "security_alert" as const,
      confirmation: "SEND_TEST_EMAIL" as const,
      idempotencyKey: "67676767-6767-4676-8676-676767676767"
    };
    const options = { audit, env: allowedEnv, sendDraft, state };

    const first = await sendAdminTestEmail(appWithLog, body, options);
    const replay = await sendAdminTestEmail(appWithLog, body, options);

    expect(first.status).toBe("accepted");
    expect(replay).toEqual(first);
    expect(sendDraft).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith(
      { eventType: "admin_email_test_send_completed" },
      "Admin email outcome audit write failed."
    );
  });

  it("enforces recipient allowlist and bounded rate limiting", async () => {
    const state = createAdminEmailOpsState();
    const base = {
      confirmation: "SEND_TEST_EMAIL" as const,
      intent: "security_alert" as const,
      to: "admin@example.test"
    };
    const options = {
      actorProfileId: "actor-1",
      audit: async () => undefined,
      env: allowedEnv,
      sendDraft: async () => ({ sent: false, provider: "smtp", sandboxOnly: true, reason: "email_delivery_disabled" } as const),
      state
    };

    await expect(sendAdminTestEmail(app, { ...base, to: "other@example.test", idempotencyKey: "77777777-7777-4777-8777-777777777777" }, options)).rejects.toMatchObject({ category: "recipient_not_allowed" });
    for (const idempotencyKey of ["88888888-8888-4888-8888-888888888881", "88888888-8888-4888-8888-888888888882", "88888888-8888-4888-8888-888888888883"]) {
      await sendAdminTestEmail(app, { ...base, idempotencyKey }, options);
    }
    await expect(sendAdminTestEmail(app, { ...base, idempotencyKey: "88888888-8888-4888-8888-888888888884" }, options)).rejects.toMatchObject({ category: "rate_limited" });
  });
});
