import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { getAdminEmailOpsPreview } from "../src/services/admin-email-ops.service.js";

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
});
