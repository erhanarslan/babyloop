import * as nodemailer from "nodemailer";

const RESEND_EMAILS_ENDPOINT = "https://api.resend.com/emails";

export type EmailProviderDriver = "mock" | "smtp" | "resend";

export type EmailProviderConfig =
  | {
      driver: "mock";
      sendEnabled: false;
      from: string | null;
    }
  | {
      driver: "smtp";
      sendEnabled: boolean;
      from: string;
      host: string;
      port: number;
      secure: boolean;
      username?: string;
      password?: string;
      usernameConfigured: boolean;
      passwordConfigured: boolean;
    }
  | {
      driver: "resend";
      sendEnabled: boolean;
      from: string;
      apiKey?: string;
      apiKeyConfigured: boolean;
    };

export type SmtpEmailProviderConfig = Extract<EmailProviderConfig, { driver: "smtp" }>;
export type ResendEmailProviderConfig = Extract<EmailProviderConfig, { driver: "resend" }>;

export type EmailProviderPreview = {
  driver: EmailProviderDriver;
  sendEnabled: boolean;
  fromConfigured: boolean;
  providerConfigured: boolean;
  sandboxOnly: boolean;
  missing: string[];
  warning: string;
};

export type EmailIntent =
  | "email_verification"
  | "password_reset"
  | "notification_digest"
  | "security_alert";

export type EmailDraft = {
  to: string;
  subject: string;
  text: string;
  intent: EmailIntent;
};

export type EmailSendResult =
  | {
      sent: false;
      provider: EmailProviderDriver;
      sandboxOnly: true;
      reason: "email_delivery_disabled";
    }
  | {
      sent: true;
      provider: "smtp" | "resend";
      sandboxOnly: false;
      messageId: string | null;
    };

type SmtpMailMessage = {
  from: string;
  to: string;
  subject: string;
  text: string;
};

type SmtpTransporter = {
  sendMail(message: SmtpMailMessage): Promise<{ messageId?: string }>;
};

type SmtpTransportFactory = (config: SmtpEmailProviderConfig) => SmtpTransporter;

type ResendEmailResponse = {
  id?: unknown;
};

export function getEmailProviderConfig(env: NodeJS.ProcessEnv = process.env): EmailProviderConfig {
  const driver = normalizeDriver(env.EMAIL_PROVIDER);
  const sendEnabled = readSendEnabled(env.EMAIL_SEND_ENABLED);

  if (sendEnabled && driver === "mock") {
    throw new Error("EMAIL_SEND_ENABLED=true requires EMAIL_PROVIDER=smtp or EMAIL_PROVIDER=resend.");
  }

  if (driver === "mock") {
    return {
      driver: "mock",
      sendEnabled: false,
      from: optionalEnv(env, "EMAIL_FROM") ?? null
    };
  }

  if (driver === "resend") {
    const apiKey = optionalEnv(env, "RESEND_API_KEY");

    if (sendEnabled && !apiKey) {
      throw new Error("RESEND_API_KEY is required when EMAIL_PROVIDER=resend and EMAIL_SEND_ENABLED=true.");
    }

    return {
      driver: "resend",
      sendEnabled,
      from: requireEnv(env, "EMAIL_FROM"),
      ...(apiKey ? { apiKey } : {}),
      apiKeyConfigured: Boolean(apiKey)
    };
  }

  const username = optionalEnv(env, "SMTP_USER");
  const password = optionalEnv(env, "SMTP_PASS");

  if (sendEnabled && (!username || !password)) {
    throw new Error("SMTP_USER and SMTP_PASS are required when EMAIL_PROVIDER=smtp and EMAIL_SEND_ENABLED=true.");
  }

  return {
    driver: "smtp",
    sendEnabled,
    from: requireEnv(env, "EMAIL_FROM"),
    host: requireEnv(env, "SMTP_HOST"),
    port: parsePort(requireEnv(env, "SMTP_PORT")),
    secure: parseBoolean(env.SMTP_SECURE, true),
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
    usernameConfigured: Boolean(username),
    passwordConfigured: Boolean(password)
  };
}

export function getEmailProviderPreview(env: NodeJS.ProcessEnv = process.env): EmailProviderPreview {
  const driver = normalizeDriver(env.EMAIL_PROVIDER);
  const sendEnabled = readSendEnabled(env.EMAIL_SEND_ENABLED);
  const missing: string[] = [];
  const fromConfigured = Boolean(optionalEnv(env, "EMAIL_FROM"));

  if (sendEnabled && driver === "mock") {
    missing.push("EMAIL_PROVIDER=smtp|resend");
  }

  if (driver === "resend") {
    if (!fromConfigured) missing.push("EMAIL_FROM");
    if (!optionalEnv(env, "RESEND_API_KEY")) missing.push("RESEND_API_KEY");
  }

  if (driver === "smtp") {
    if (!fromConfigured) missing.push("EMAIL_FROM");
    for (const key of ["SMTP_HOST", "SMTP_PORT"]) {
      if (!optionalEnv(env, key)) missing.push(key);
    }

    if (sendEnabled) {
      for (const key of ["SMTP_USER", "SMTP_PASS"]) {
        if (!optionalEnv(env, key)) missing.push(key);
      }
    }
  }

  return {
    driver,
    sendEnabled,
    fromConfigured,
    providerConfigured: missing.length === 0 && driver !== "mock",
    sandboxOnly: !sendEnabled,
    missing,
    warning: sendEnabled
      ? "Email gerçek gönderim modu aktiftir. Secret değerleri preview/log çıktılarında gösterilmez."
      : "Email provider sandbox modundadır. EMAIL_SEND_ENABLED=true yapılmadıkça gerçek email gönderilmez."
  };
}

export async function sendEmailDraft(
  draft: EmailDraft,
  env: NodeJS.ProcessEnv = process.env,
  createTransport: SmtpTransportFactory = createSmtpTransport
): Promise<EmailSendResult> {
  const config = getEmailProviderConfig(env);

  if (!config.sendEnabled) {
    void draft;

    return {
      sent: false,
      provider: config.driver,
      sandboxOnly: true,
      reason: "email_delivery_disabled"
    };
  }

  if (config.driver === "smtp") {
    const transporter = createTransport(config);
    const result = await transporter.sendMail({
      from: config.from,
      to: draft.to,
      subject: draft.subject,
      text: draft.text
    });

    return {
      sent: true,
      provider: "smtp",
      sandboxOnly: false,
      messageId: result.messageId ?? null
    };
  }

  if (config.driver === "resend") {
    return sendResendEmailDraft(config, draft);
  }

  throw new Error("Unsupported email provider configuration.");
}

function createSmtpTransport(config: SmtpEmailProviderConfig): SmtpTransporter {
  const transportOptions: {
    host: string;
    port: number;
    secure: boolean;
    auth?: {
      user: string;
      pass: string;
    };
  } = {
    host: config.host,
    port: config.port,
    secure: config.secure
  };

  if (config.username && config.password) {
    transportOptions.auth = {
      user: config.username,
      pass: config.password
    };
  }

  return nodemailer.createTransport(transportOptions);
}

async function sendResendEmailDraft(
  config: ResendEmailProviderConfig,
  draft: EmailDraft
): Promise<EmailSendResult> {
  if (!config.apiKey) {
    throw new Error("RESEND_API_KEY is required when EMAIL_PROVIDER=resend and EMAIL_SEND_ENABLED=true.");
  }

  const response = await fetch(RESEND_EMAILS_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: config.from,
      to: [draft.to],
      subject: draft.subject,
      text: draft.text
    })
  });

  if (!response.ok) {
    throw new Error("Resend email delivery failed.");
  }

  const body = (await response.json()) as ResendEmailResponse;

  return {
    sent: true,
    provider: "resend",
    sandboxOnly: false,
    messageId: typeof body.id === "string" && body.id.length > 0 ? body.id : null
  };
}

function normalizeDriver(value: string | undefined): EmailProviderDriver {
  const normalized = value?.trim().toLowerCase();

  if (!normalized || normalized === "mock") {
    return "mock";
  }

  if (normalized === "smtp" || normalized === "resend") {
    return normalized;
  }

  throw new Error("EMAIL_PROVIDER must be mock, smtp, or resend.");
}

function optionalEnv(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key]?.trim();

  return value && value.length > 0 ? value : undefined;
}

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = optionalEnv(env, key);

  if (!value) {
    throw new Error(`${key} is required when EMAIL_PROVIDER is configured.`);
  }

  return value;
}

function parsePort(value: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error("SMTP_PORT must be a valid TCP port.");
  }

  return parsed;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  throw new Error("Boolean env values must be true or false.");
}

function readSendEnabled(value: string | undefined): boolean {
  if (value === undefined || value.trim().length === 0) {
    return false;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  throw new Error("EMAIL_SEND_ENABLED must be true or false.");
}
