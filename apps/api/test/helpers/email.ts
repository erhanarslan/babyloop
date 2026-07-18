import type {
  EmailDeliveryService,
  SendAccountDeletionOtpEmailParams,
  SendEmailVerificationEmailParams,
  SendMfaOtpEmailParams,
  SendPasswordResetEmailParams
} from "../../src/services/email-delivery.service.js";

export type RecordingEmailDeliveryService = EmailDeliveryService & {
  accountDeletionOtpEmails: SendAccountDeletionOtpEmailParams[];
  emailVerificationEmails: SendEmailVerificationEmailParams[];
  mfaOtpEmails: SendMfaOtpEmailParams[];
  passwordResetEmails: SendPasswordResetEmailParams[];
};

export function createRecordingEmailDeliveryService(): RecordingEmailDeliveryService {
  const accountDeletionOtpEmails: SendAccountDeletionOtpEmailParams[] = [];
  const emailVerificationEmails: SendEmailVerificationEmailParams[] = [];
  const mfaOtpEmails: SendMfaOtpEmailParams[] = [];
  const passwordResetEmails: SendPasswordResetEmailParams[] = [];

  return {
    accountDeletionOtpEmails,
    emailVerificationEmails,
    mfaOtpEmails,
    passwordResetEmails,
    async sendAccountDeletionOtpEmail(params) {
      accountDeletionOtpEmails.push(params);
    },
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
