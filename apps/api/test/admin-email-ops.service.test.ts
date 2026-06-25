import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import {
  getAdminEmailOpsPreview,
  sendAdminTestEmail
} from "../src/services/admin-email-ops.service.js";
import type { EmailDraft, EmailSendResult } from "../src/services/email-provider.service.js";

const app = {} as FastifyInstance;

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
    expect(preview.warning).toContain("sandbox");
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
    expect(preview.warning).toContain("gerçek gönderim modu aktiftir");
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
    expect(preview.emailProvider.missing).toEqual(
      expect.arrayContaining(["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"])
    );
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
        note: "  smoke   test \n note  "
      },
      {
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

    expect(result).toEqual({
      intent: "security_alert",
      result: {
        sent: false,
        provider: "smtp",
        sandboxOnly: true,
        reason: "email_delivery_disabled"
      },
      warning: "Admin test email sandbox/disabled modda kaldı; gerçek mail gönderilmedi."
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      to: "admin@example.test",
      intent: "security_alert",
      subject: "BabyLoop admin test email - security_alert"
    });
    expect(drafts[0]!.text).toContain("Intent: security_alert");
    expect(drafts[0]!.text).toContain("Not: smoke test note");
    expect(drafts[0]!.text).not.toContain("verification token:");
    expect(drafts[0]!.text).not.toContain("reset token:");
    expect(drafts[0]!.text).not.toContain("session");
  });

  it("returns sent result when provider accepts the admin test email", async () => {
    const result = await sendAdminTestEmail(
      app,
      {
        to: "admin@example.test",
        intent: "email_verification"
      },
      {
        sendDraft: async () => ({
          sent: true,
          provider: "smtp",
          sandboxOnly: false,
          messageId: "smtp-test-message-id"
        })
      }
    );

    expect(result).toEqual({
      intent: "email_verification",
      result: {
        sent: true,
        provider: "smtp",
        sandboxOnly: false,
        messageId: "smtp-test-message-id"
      },
      warning: "Admin test email gönderimi provider tarafından kabul edildi."
    });
  });
});
