import type {
  EmailDeliveryService,
  SendEmailVerificationEmailParams,
  SendMfaOtpEmailParams,
  SendPasswordResetEmailParams
} from "../../src/services/email-delivery.service.js";

export type RecordingEmailDeliveryService = EmailDeliveryService & {
  emailVerificationEmails: SendEmailVerificationEmailParams[];
  mfaOtpEmails: SendMfaOtpEmailParams[];
  passwordResetEmails: SendPasswordResetEmailParams[];
};

export function createRecordingEmailDeliveryService(): RecordingEmailDeliveryService {
  const emailVerificationEmails: SendEmailVerificationEmailParams[] = [];
  const mfaOtpEmails: SendMfaOtpEmailParams[] = [];
  const passwordResetEmails: SendPasswordResetEmailParams[] = [];

  return {
    emailVerificationEmails,
    mfaOtpEmails,
    passwordResetEmails,
    async sendEmailVerificationEmail(params) {
      emailVerificationEmails.push(params);
    },
    async sendMfaOtpEmail(params) {
      mfaOtpEmails.push(params);
    },
    async sendPasswordResetEmail(params) {
      passwordResetEmails.push(params);
    }
  };
}
