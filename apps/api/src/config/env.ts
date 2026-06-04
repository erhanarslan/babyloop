import type { GoogleOAuthConfig } from "../services/google-oauth.service.js";

export type ApiRuntimeConfig = {
  allowAuthUnavailable: boolean;
  authRateLimitMax: number;
  authRateLimitWindowSeconds: number;
  authSecret?: string;
  authTokenTtlSeconds: number;
  corsOrigins: string[];
  databaseUrl?: string;
  googleOAuth?: GoogleOAuthConfig;
  host: string;
  port: number;
  webAppUrl: string;
};

const DEFAULT_CORS_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

export function readApiRuntimeConfig(env: NodeJS.ProcessEnv = process.env): ApiRuntimeConfig {
  const allowAuthUnavailable = readBoolean(env.ALLOW_AUTH_UNAVAILABLE, false);
  const config: ApiRuntimeConfig = {
    allowAuthUnavailable,
    authRateLimitMax: readPositiveInteger(env.AUTH_RATE_LIMIT_MAX, 10),
    authRateLimitWindowSeconds: readPositiveInteger(env.AUTH_RATE_LIMIT_WINDOW_SECONDS, 60),
    authTokenTtlSeconds: readPositiveInteger(env.AUTH_TOKEN_TTL_SECONDS, 60 * 15),
    corsOrigins: readCorsOrigins(env.CORS_ORIGINS),
    host: env.HOST ?? "127.0.0.1",
    port: readPort(env.PORT),
    webAppUrl: readWebAppUrl(env.WEB_APP_URL)
  };
  const googleOAuth = readGoogleOAuthConfig(env);

  if (googleOAuth) {
    config.googleOAuth = googleOAuth;
  }

  const authSecret = readAuthSecret(env.AUTH_SECRET);

  if (authSecret) {
    config.authSecret = authSecret;
  }

  if (env.DATABASE_URL) {
    config.databaseUrl = env.DATABASE_URL;
  }

  if (config.databaseUrl && !config.authSecret && !config.allowAuthUnavailable) {
    throw new Error(
      "AUTH_SECRET is required when DATABASE_URL is configured. Set ALLOW_AUTH_UNAVAILABLE=true only for local unavailable-mode testing."
    );
  }

  return config;
}

function readGoogleOAuthConfig(env: NodeJS.ProcessEnv): GoogleOAuthConfig | undefined {
  const values = {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI,
    webAppUrl: env.WEB_APP_URL
  };
  const providedValues = Object.values(values).filter(Boolean);

  if (providedValues.length === 0) {
    return undefined;
  }

  if (providedValues.length !== Object.values(values).length) {
    return undefined;
  }

  return {
    clientId: values.clientId!,
    clientSecret: values.clientSecret!,
    redirectUri: values.redirectUri!,
    webAppUrl: values.webAppUrl!.replace(/\/$/, "")
  };
}

function readWebAppUrl(value: string | undefined): string {
  return (value ?? "http://localhost:3000").replace(/\/$/, "");
}

function readAuthSecret(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  if (value.length < 32) {
    throw new Error("AUTH_SECRET must be at least 32 characters.");
  }

  return value;
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  return ["1", "true", "yes"].includes(value.trim().toLowerCase());
}

function readCorsOrigins(value: string | undefined): string[] {
  if (!value) {
    return DEFAULT_CORS_ORIGINS;
  }

  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : DEFAULT_CORS_ORIGINS;
}

function readPort(value: string | undefined): number {
  if (!value) {
    return 4000;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT value: ${value}`);
  }

  return port;
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer value: ${value}`);
  }

  return parsed;
}
