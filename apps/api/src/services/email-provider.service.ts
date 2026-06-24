export type EmailProviderDriver = "mock" | "smtp" | "resend";

export type EmailProviderConfig =
  | {
      driver: "mock";
      sendEnabled: false;
      from: string | null;
    }
  | {
      driver: "smtp";
      sendEnabled: false;
      from: string;
      host: string;
      port: number;
      secure: boolean;
      usernameConfigured: boolean;
      passwordConfigured: boolean;
    }
  | {
      driver: "resend";
      sendEnabled: false;
      from: string;
      apiKeyConfigured: boolean;
    };

export type EmailProviderPreview = {
  driver: EmailProviderDriver;
  sendEnabled: false;
  fromConfigured: boolean;
  providerConfigured: boolean;
  sandboxOnly: true;
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

export type EmailSendResult = {
  sent: false;
  provider: EmailProviderDriver;
  sandboxOnly: true;
  reason: "email_delivery_disabled";
};

export function getEmailProviderConfig(env: NodeJS.ProcessEnv = process.env): EmailProviderConfig {
  const driver = normalizeDriver(env.EMAIL_PROVIDER);

  if (driver === "mock") {
    return {
      driver: "mock",
      sendEnabled: false,
      from: optionalEnv(env, "EMAIL_FROM") ?? null
    };
  }

  if (driver === "resend") {
    return {
      driver: "resend",
      sendEnabled: false,
      from: requireEnv(env, "EMAIL_FROM"),
      apiKeyConfigured: Boolean(optionalEnv(env, "RESEND_API_KEY"))
    };
  }

  return {
    driver: "smtp",
    sendEnabled: false,
    from: requireEnv(env, "EMAIL_FROM"),
    host: requireEnv(env, "SMTP_HOST"),
    port: parsePort(requireEnv(env, "SMTP_PORT")),
    secure: parseBoolean(env.SMTP_SECURE, true),
    usernameConfigured: Boolean(optionalEnv(env, "SMTP_USER")),
    passwordConfigured: Boolean(optionalEnv(env, "SMTP_PASS"))
  };
}

export function getEmailProviderPreview(env: NodeJS.ProcessEnv = process.env): EmailProviderPreview {
  const driver = normalizeDriver(env.EMAIL_PROVIDER);
  const missing: string[] = [];
  const fromConfigured = Boolean(optionalEnv(env, "EMAIL_FROM"));

  if (driver === "resend") {
    if (!fromConfigured) missing.push("EMAIL_FROM");
    if (!optionalEnv(env, "RESEND_API_KEY")) missing.push("RESEND_API_KEY");
  }

  if (driver === "smtp") {
    if (!fromConfigured) missing.push("EMAIL_FROM");
    for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"]) {
      if (!optionalEnv(env, key)) missing.push(key);
    }
  }

  return {
    driver,
    sendEnabled: false,
    fromConfigured,
    providerConfigured: missing.length === 0 && driver !== "mock",
    sandboxOnly: true,
    missing,
    warning:
      "Email provider foundation sandbox modundadır. Bu katman gerçek email göndermez; verification/reset/notification email gönderimi ayrı pakette enable edilir."
  };
}

export async function sendEmailDraft(
  draft: EmailDraft,
  env: NodeJS.ProcessEnv = process.env
): Promise<EmailSendResult> {
  const config = getEmailProviderConfig(env);

  void draft;

  return {
    sent: false,
    provider: config.driver,
    sandboxOnly: true,
    reason: "email_delivery_disabled"
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

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}
