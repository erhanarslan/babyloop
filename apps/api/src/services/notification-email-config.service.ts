export type NotificationEmailProviderConfig = {
  apiKey: string | undefined;
  enabled: boolean;
  fromEmail: string | undefined;
  fromName: string;
  provider: string;
};

export function getNotificationEmailProviderConfig(
  env: NodeJS.ProcessEnv = process.env
): NotificationEmailProviderConfig {
  const explicitNotificationSwitch = env.NOTIFICATION_EMAIL_ENABLED?.trim();
  const enabledBySwitch = explicitNotificationSwitch
    ? readBoolean(explicitNotificationSwitch)
    : readBoolean(env.EMAIL_SEND_ENABLED);
  const provider = (
    env.NOTIFICATION_EMAIL_PROVIDER ?? env.EMAIL_PROVIDER ?? "resend"
  ).trim().toLowerCase();
  const apiKey = env.RESEND_API_KEY?.trim() || undefined;
  const fromEmail = env.RESEND_FROM_EMAIL?.trim() || extractEmailAddress(env.EMAIL_FROM);

  return {
    apiKey,
    enabled: enabledBySwitch && provider === "resend" && Boolean(apiKey) && Boolean(fromEmail),
    fromEmail,
    fromName: env.RESEND_FROM_NAME?.trim() || "BabyLoop",
    provider
  };
}

export function isNotificationEmailProviderConfigured(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return getNotificationEmailProviderConfig(env).enabled;
}

export function isNotificationPushProviderConfigured(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return (
    readBoolean(env.NOTIFICATION_PUSH_ENABLED) &&
    (env.PUSH_PROVIDER ?? "expo").trim().toLowerCase() === "expo" &&
    Boolean(env.EXPO_ACCESS_TOKEN?.trim())
  );
}

export function isNotificationN8nProviderConfigured(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return readBoolean(env.N8N_NOTIFICATION_WEBHOOK_ENABLED) && Boolean(
    env.N8N_NOTIFICATION_WEBHOOK_URL?.trim()
  );
}

function readBoolean(value: string | undefined): boolean {
  return value === "1" || value?.trim().toLowerCase() === "true";
}

function extractEmailAddress(value: string | undefined): string | undefined {
  const normalized = value?.trim();

  if (!normalized) {
    return undefined;
  }

  const bracketMatch = normalized.match(/<([^<>]+)>$/u);

  return bracketMatch?.[1]?.trim() || normalized;
}
