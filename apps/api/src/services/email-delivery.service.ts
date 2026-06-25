import {
  sendEmailDraft,
  type EmailDraft,
  type EmailSendResult
} from "./email-provider.service.js";

export type EmailDeliveryMode = "noop";

export type EmailDeliveryConfig = {
  emailFrom?: string;
  mode: EmailDeliveryMode;
  webAppUrl: string;
  sendDraft?: (draft: EmailDraft) => Promise<EmailSendResult>;
};

export type SendEmailVerificationEmailParams = {
  recipientEmail: string;
  verificationUrl: string;
  displayName?: string;
  expiresInSeconds?: number;
};

export type SendPasswordResetEmailParams = {
  recipientEmail: string;
  resetUrl: string;
  displayName?: string;
  expiresInSeconds?: number;
};

export type SendMfaOtpEmailParams = {
  recipientEmail: string;
  code: string;
  displayName?: string;
  expiresInSeconds?: number;
};

export type EmailDeliveryService = {
  sendEmailVerificationEmail(params: SendEmailVerificationEmailParams): Promise<void>;
  sendMfaOtpEmail(params: SendMfaOtpEmailParams): Promise<void>;
  sendPasswordResetEmail(params: SendPasswordResetEmailParams): Promise<void>;
};

export function createEmailDeliveryService(config: EmailDeliveryConfig): EmailDeliveryService {
  const deliverDraft = config.sendDraft ?? sendEmailDraft;

  return {
    async sendEmailVerificationEmail(params) {
      await deliverDraft(buildEmailVerificationDraft(params));
    },
    async sendMfaOtpEmail(params) {
      await deliverDraft(buildMfaOtpDraft(params));
    },
    async sendPasswordResetEmail(params) {
      await deliverDraft(buildPasswordResetDraft(params));
    }
  };
}

export function buildEmailVerificationUrl(webAppUrl: string, token: string): string {
  const url = new URL("/auth/verify-email", normalizeWebAppUrl(webAppUrl));
  url.searchParams.set("token", token);

  return url.toString();
}

export function buildPasswordResetUrl(webAppUrl: string, token: string): string {
  const url = new URL("/reset-password", normalizeWebAppUrl(webAppUrl));
  url.searchParams.set("token", token);

  return url.toString();
}

function buildEmailVerificationDraft(params: SendEmailVerificationEmailParams): EmailDraft {
  const displayName = normalizeDisplayName(params.displayName);
  const expiryText = formatExpiry(params.expiresInSeconds);

  return {
    intent: "email_verification",
    to: params.recipientEmail,
    subject: "BabyLoop e-posta doğrulama",
    text: [
      `Merhaba ${displayName},`,
      "",
      "BabyLoop hesabındaki e-posta adresini doğrulamak için aşağıdaki bağlantıyı aç:",
      params.verificationUrl,
      "",
      expiryText ? `Bu bağlantı ${expiryText} geçerlidir.` : "Bu bağlantı sınırlı süre geçerlidir.",
      "Bu isteği sen başlatmadıysan bu mesajı yok sayabilirsin.",
      "",
      "BabyLoop"
    ].join("\n")
  };
}

function buildPasswordResetDraft(params: SendPasswordResetEmailParams): EmailDraft {
  const displayName = normalizeDisplayName(params.displayName);
  const expiryText = formatExpiry(params.expiresInSeconds);

  return {
    intent: "password_reset",
    to: params.recipientEmail,
    subject: "BabyLoop şifre sıfırlama",
    text: [
      `Merhaba ${displayName},`,
      "",
      "BabyLoop hesabın için şifre sıfırlama bağlantısı hazırlandı:",
      params.resetUrl,
      "",
      expiryText ? `Bu bağlantı ${expiryText} geçerlidir.` : "Bu bağlantı sınırlı süre geçerlidir.",
      "Bu isteği sen başlatmadıysan şifren değişmez; bu mesajı yok sayabilirsin.",
      "",
      "BabyLoop"
    ].join("\n")
  };
}

function buildMfaOtpDraft(params: SendMfaOtpEmailParams): EmailDraft {
  const displayName = normalizeDisplayName(params.displayName);
  const expiryText = formatExpiry(params.expiresInSeconds);

  return {
    intent: "security_alert",
    to: params.recipientEmail,
    subject: "BabyLoop güvenlik kodu",
    text: [
      `Merhaba ${displayName},`,
      "",
      "BabyLoop hesabına giriş yapmak için güvenlik kodun:",
      params.code,
      "",
      expiryText ? `Bu kod ${expiryText} geçerlidir.` : "Bu kod kısa süre geçerlidir.",
      "Bu giriş denemesini sen başlatmadıysan hesabının şifresini değiştirmeni öneririz.",
      "",
      "BabyLoop"
    ].join("\n")
  };
}

function normalizeWebAppUrl(webAppUrl: string): string {
  return webAppUrl.replace(/\/$/, "");
}

function normalizeDisplayName(displayName: string | undefined): string {
  const normalized = displayName
    ?.replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized && normalized.length > 0 ? normalized.slice(0, 80) : "BabyLoop kullanıcısı";
}

function formatExpiry(expiresInSeconds: number | undefined): string | null {
  if (!expiresInSeconds || expiresInSeconds <= 0) {
    return null;
  }

  if (expiresInSeconds % 86400 === 0) {
    const days = expiresInSeconds / 86400;
    return `${days} gün`;
  }

  if (expiresInSeconds % 3600 === 0) {
    const hours = expiresInSeconds / 3600;
    return `${hours} saat`;
  }

  const minutes = Math.max(Math.ceil(expiresInSeconds / 60), 1);
  return `${minutes} dakika`;
}
