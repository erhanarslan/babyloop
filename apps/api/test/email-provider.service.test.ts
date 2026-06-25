import { describe, expect, it } from "vitest";
import {
  getEmailProviderConfig,
  getEmailProviderPreview,
  sendEmailDraft,
  type EmailDraft
} from "../src/services/email-provider.service.js";

const smtpEnv = {
  EMAIL_PROVIDER: "smtp",
  EMAIL_FROM: "BabyLoop <hello@example.test>",
  SMTP_HOST: "smtp.example.test",
  SMTP_PASS: "secret-pass",
  SMTP_PORT: "587",
  SMTP_SECURE: "false",
  SMTP_USER: "smtp-user"
};

const draft: EmailDraft = {
  intent: "email_verification",
  subject: "Verify your email",
  text: "Verify",
  to: "user@example.test"
};

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

  it("parses smtp config but keeps sending disabled by default", () => {
    const config = getEmailProviderConfig(smtpEnv);

    expect(config.driver).toBe("smtp");
    expect(config.sendEnabled).toBe(false);
    expect(config.port).toBe(587);
    expect(config.secure).toBe(false);
    expect(config.passwordConfigured).toBe(true);
  });

  it("enables smtp sending only behind EMAIL_SEND_ENABLED=true", () => {
    const config = getEmailProviderConfig({
      ...smtpEnv,
      EMAIL_SEND_ENABLED: "true"
    });

    expect(config.driver).toBe("smtp");
    expect(config.sendEnabled).toBe(true);
    expect(config.usernameConfigured).toBe(true);
    expect(config.passwordConfigured).toBe(true);
  });

  it("keeps smtp preview secret-safe when send is enabled", () => {
    const preview = getEmailProviderPreview({
      ...smtpEnv,
      EMAIL_SEND_ENABLED: "true"
    });

    expect(preview.driver).toBe("smtp");
    expect(preview.sendEnabled).toBe(true);
    expect(preview.sandboxOnly).toBe(false);
    expect(preview.providerConfigured).toBe(true);
    expect(JSON.stringify(preview)).not.toContain("secret-pass");
    expect(JSON.stringify(preview)).not.toContain("smtp-user");
  });

  it("does not send email drafts when send is disabled", async () => {
    const result = await sendEmailDraft(draft, smtpEnv, () => {
      throw new Error("transport should not be created when send is disabled");
    });

    expect(result.sent).toBe(false);
    expect(result.sandboxOnly).toBe(true);
    expect(result.reason).toBe("email_delivery_disabled");
  });

  it("sends smtp email drafts when send is enabled", async () => {
    const sentMessages: Array<{
      from: string;
      to: string;
      subject: string;
      text: string;
    }> = [];

    const result = await sendEmailDraft(
      draft,
      {
        ...smtpEnv,
        EMAIL_SEND_ENABLED: "true"
      },
      () => ({
        async sendMail(message) {
          sentMessages.push(message);

          return {
            messageId: "smtp-message-id"
          };
        }
      })
    );

    expect(result).toEqual({
      sent: true,
      provider: "smtp",
      sandboxOnly: false,
      messageId: "smtp-message-id"
    });
    expect(sentMessages).toEqual([
      {
        from: "BabyLoop <hello@example.test>",
        to: "user@example.test",
        subject: "Verify your email",
        text: "Verify"
      }
    ]);
  });

  it("rejects send enabled without smtp provider", () => {
    expect(() =>
      getEmailProviderConfig({
        EMAIL_PROVIDER: "mock",
        EMAIL_SEND_ENABLED: "true"
      })
    ).toThrow("EMAIL_SEND_ENABLED=true is currently supported only with EMAIL_PROVIDER=smtp.");
  });

  it("requires smtp credentials when send is enabled", () => {
    expect(() =>
      getEmailProviderConfig({
        EMAIL_PROVIDER: "smtp",
        EMAIL_FROM: "BabyLoop <hello@example.test>",
        SMTP_HOST: "smtp.example.test",
        SMTP_PORT: "587",
        EMAIL_SEND_ENABLED: "true"
      })
    ).toThrow("SMTP_USER and SMTP_PASS are required when EMAIL_SEND_ENABLED=true.");
  });

  it("does not send email drafts in foundation mode", async () => {
    const result = await sendEmailDraft(draft);

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
