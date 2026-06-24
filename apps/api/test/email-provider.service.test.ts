import { describe, expect, it } from "vitest";
import {
  getEmailProviderConfig,
  getEmailProviderPreview,
  sendEmailDraft
} from "../src/services/email-provider.service.js";

describe("email provider service", () => {
  it("defaults to mock sandbox delivery", () => {
    const config = getEmailProviderConfig({});

    expect(config.driver).toBe("mock");
    expect(config.sendEnabled).toBe(false);
  });

  it("returns safe preview without exposing secrets", () => {
    const preview = getEmailProviderPreview({
      EMAIL_PROVIDER: "resend",
      EMAIL_FROM: "BabyLoop <hello@example.test>",
      RESEND_API_KEY: "secret-key"
    });

    expect(preview.driver).toBe("resend");
    expect(preview.sendEnabled).toBe(false);
    expect(preview.providerConfigured).toBe(true);
    expect(JSON.stringify(preview)).not.toContain("secret-key");
  });

  it("reports missing resend configuration", () => {
    const preview = getEmailProviderPreview({
      EMAIL_PROVIDER: "resend"
    });

    expect(preview.providerConfigured).toBe(false);
    expect(preview.missing).toContain("EMAIL_FROM");
    expect(preview.missing).toContain("RESEND_API_KEY");
  });

  it("parses smtp config but keeps sending disabled", () => {
    const config = getEmailProviderConfig({
      EMAIL_PROVIDER: "smtp",
      EMAIL_FROM: "BabyLoop <hello@example.test>",
      SMTP_HOST: "smtp.example.test",
      SMTP_PASS: "pass",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
      SMTP_USER: "user"
    });

    expect(config.driver).toBe("smtp");
    expect(config.sendEnabled).toBe(false);
    expect(config.port).toBe(587);
    expect(config.secure).toBe(false);
    expect(config.passwordConfigured).toBe(true);
  });

  it("does not send email drafts in foundation mode", async () => {
    const result = await sendEmailDraft({
      intent: "email_verification",
      subject: "Verify your email",
      text: "Verify",
      to: "user@example.test"
    });

    expect(result.sent).toBe(false);
    expect(result.sandboxOnly).toBe(true);
    expect(result.reason).toBe("email_delivery_disabled");
  });

  it("rejects unknown providers", () => {
    expect(() => getEmailProviderConfig({ EMAIL_PROVIDER: "mailgun" })).toThrow(
      "EMAIL_PROVIDER must be mock, smtp, or resend."
    );
  });
});
