export type EmailDeliveryMode = "noop";

export type EmailDeliveryConfig = {
  emailFrom?: string;
  mode: EmailDeliveryMode;
  webAppUrl: string;
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

export function createEmailDeliveryService(_config: EmailDeliveryConfig): EmailDeliveryService {
  return noopEmailDeliveryService;
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

function normalizeWebAppUrl(webAppUrl: string): string {
  return webAppUrl.replace(/\/$/, "");
}

const noopEmailDeliveryService: EmailDeliveryService = {
  async sendEmailVerificationEmail() {
    return;
  },
  async sendMfaOtpEmail() {
    return;
  },
  async sendPasswordResetEmail() {
    return;
  }
};
