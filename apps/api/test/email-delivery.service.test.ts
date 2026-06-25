import { describe, expect, it } from "vitest";
import {
  buildEmailVerificationUrl,
  buildPasswordResetUrl,
  createEmailDeliveryService
} from "../src/services/email-delivery.service.js";
import type { EmailDraft, EmailSendResult } from "../src/services/email-provider.service.js";

function createRecordingDraftSender() {
  const drafts: EmailDraft[] = [];

  return {
    drafts,
    async sendDraft(draft: EmailDraft): Promise<EmailSendResult> {
      drafts.push(draft);

      return {
        sent: false,
        provider: "mock",
        sandboxOnly: true,
        reason: "email_delivery_disabled"
      };
    }
  };
}

describe("email delivery service", () => {

  it("does not call the provider while delivery mode is noop", async () => {
    const service = createEmailDeliveryService({
      mode: "noop",
      webAppUrl: "https://babyloop.test",
      sendDraft: async () => {
        throw new Error("provider should not be called in noop mode");
      }
    });

    await service.sendEmailVerificationEmail({
      recipientEmail: "parent@example.test",
      verificationUrl: "https://babyloop.test/auth/verify-email?token=secret-verification-token",
      expiresInSeconds: 86400
    });
  });


  it("builds official verification and reset URLs", () => {
    expect(buildEmailVerificationUrl("https://babyloop.test/", "verify-token")).toBe(
      "https://babyloop.test/auth/verify-email?token=verify-token"
    );
    expect(buildPasswordResetUrl("https://babyloop.test/", "reset-token")).toBe(
      "https://babyloop.test/reset-password?token=reset-token"
    );
  });

  it("sends email verification as a provider draft", async () => {
    const recorder = createRecordingDraftSender();
    const service = createEmailDeliveryService({
      mode: "provider",
      webAppUrl: "https://babyloop.test",
      sendDraft: recorder.sendDraft
    });

    await service.sendEmailVerificationEmail({
      recipientEmail: "parent@example.test",
      verificationUrl: "https://babyloop.test/auth/verify-email?token=secret-verification-token",
      displayName: "Ayşe\n<script>",
      expiresInSeconds: 86400
    });

    expect(recorder.drafts).toHaveLength(1);
    expect(recorder.drafts[0]).toMatchObject({
      intent: "email_verification",
      to: "parent@example.test",
      subject: "BabyLoop e-posta doğrulama"
    });
    expect(recorder.drafts[0]!.subject).not.toContain("secret-verification-token");
    expect(recorder.drafts[0]!.text).toContain("https://babyloop.test/auth/verify-email?token=secret-verification-token");
    expect(recorder.drafts[0]!.text).toContain("1 gün");
    expect(recorder.drafts[0]!.text).not.toContain("\n<script>");
  });

  it("sends password reset as a provider draft", async () => {
    const recorder = createRecordingDraftSender();
    const service = createEmailDeliveryService({
      mode: "provider",
      webAppUrl: "https://babyloop.test",
      sendDraft: recorder.sendDraft
    });

    await service.sendPasswordResetEmail({
      recipientEmail: "parent@example.test",
      resetUrl: "https://babyloop.test/reset-password?token=secret-reset-token",
      expiresInSeconds: 1800
    });

    expect(recorder.drafts).toHaveLength(1);
    expect(recorder.drafts[0]).toMatchObject({
      intent: "password_reset",
      to: "parent@example.test",
      subject: "BabyLoop şifre sıfırlama"
    });
    expect(recorder.drafts[0]!.subject).not.toContain("secret-reset-token");
    expect(recorder.drafts[0]!.text).toContain("https://babyloop.test/reset-password?token=secret-reset-token");
    expect(recorder.drafts[0]!.text).toContain("30 dakika");
  });

  it("sends MFA OTP as a security alert draft without putting the code in the subject", async () => {
    const recorder = createRecordingDraftSender();
    const service = createEmailDeliveryService({
      mode: "provider",
      webAppUrl: "https://babyloop.test",
      sendDraft: recorder.sendDraft
    });

    await service.sendMfaOtpEmail({
      recipientEmail: "parent@example.test",
      code: "123456",
      expiresInSeconds: 300
    });

    expect(recorder.drafts).toHaveLength(1);
    expect(recorder.drafts[0]).toMatchObject({
      intent: "security_alert",
      to: "parent@example.test",
      subject: "BabyLoop güvenlik kodu"
    });
    expect(recorder.drafts[0]!.subject).not.toContain("123456");
    expect(recorder.drafts[0]!.text).toContain("123456");
    expect(recorder.drafts[0]!.text).toContain("5 dakika");
  });
});
