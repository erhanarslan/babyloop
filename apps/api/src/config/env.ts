export type ApiRuntimeConfig = {
  authSecret?: string;
  authTokenTtlSeconds: number;
  corsOrigins: string[];
  databaseUrl?: string;
  host: string;
  port: number;
};

const DEFAULT_CORS_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

export function readApiRuntimeConfig(env: NodeJS.ProcessEnv = process.env): ApiRuntimeConfig {
  const config: ApiRuntimeConfig = {
    authTokenTtlSeconds: readPositiveInteger(env.AUTH_TOKEN_TTL_SECONDS, 60 * 60 * 24 * 7),
    corsOrigins: readCorsOrigins(env.CORS_ORIGINS),
    host: env.HOST ?? "127.0.0.1",
    port: readPort(env.PORT)
  };

  const authSecret = readAuthSecret(env.AUTH_SECRET);

  if (authSecret) {
    config.authSecret = authSecret;
  }

  if (env.DATABASE_URL) {
    config.databaseUrl = env.DATABASE_URL;
  }

  return config;
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
