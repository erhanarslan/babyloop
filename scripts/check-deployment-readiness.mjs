#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const VALID_TARGETS = new Set(["local", "staging", "production"]);
const target = resolveTarget();

const results = [];

checkRepositoryHygiene();
checkRequiredFiles();

if (target !== "local") {
  checkCoreRuntimeEnv();
  checkClientRuntimeEnv();
  checkCorsAndUrls();
  checkAuthRuntimeEnv();
  checkGoogleOAuthEnv();
  checkEmailEnv();
  checkNotificationEmailEnv();
  checkImageStorageEnv();
  checkListingImageAuthenticityEnv();
  checkAiProviderEnv();
  checkRagEnv();
  checkObservabilityEnv();
  checkBackofficePosture();
} else {
  note("local", "Strict staging/production env validation is skipped for local target.");
}

printResultsAndExit();

function resolveTarget() {
  const argTarget = process.argv
    .find((arg) => arg.startsWith("--target="))
    ?.slice("--target=".length)
    .trim();

  const value = argTarget || process.env.DEPLOYMENT_READINESS_TARGET || "local";

  if (!VALID_TARGETS.has(value)) {
    error(
      "target",
      `Invalid deployment readiness target "${value}". Use one of: ${Array.from(VALID_TARGETS).join(", ")}.`
    );
    printResultsAndExit();
  }

  return value;
}

function checkRepositoryHygiene() {
  const trackedFiles = getTrackedFiles();

  const forbiddenTrackedPatterns = [
    {
      pattern: /(^|\/)\.DS_Store$/u,
      message: "Tracked .DS_Store files must be removed."
    },
    {
      pattern: /(^|\/)\.env(\.|$)/u,
      allow: /(^|\/)\.env\.(example|local\.example|development\.example|production\.example|test\.example)$/u,
      message: "Real env files must not be tracked. Only .env.example-style files are allowed."
    },
    {
      pattern: /(^|\/)(playwright-report|test-results|coverage|\.turbo|\.e2e-results)(\/|$)/u,
      message: "Generated report/cache artifacts must not be tracked."
    },
    {
      pattern: /^babyloop-.*-(audit|target)\.txt$/u,
      message: "Generated audit/target text files must not be tracked."
    },
    {
      pattern: /^babyloop-.*\.zip$/u,
      message: "Generated review archives must not be tracked."
    }
  ];

  for (const file of trackedFiles) {
    for (const rule of forbiddenTrackedPatterns) {
      if (rule.pattern.test(file) && !rule.allow?.test(file)) {
        error("repo", `${rule.message} Offending file: ${file}`);
      }
    }
  }

  ok("repo", "Tracked repository hygiene checks completed.");
}

function checkRequiredFiles() {
  const requiredFiles = [
    ".env.example",
    "apps/web/.env.example",
    "apps/backoffice/.env.example",
    "apps/mobile/.env.example",
    "docs/54-production-env-checklist.md",
    "scripts/release-smoke.sh",
    "scripts/check-release-artifacts.mjs",
    "scripts/clean-release-artifacts.mjs"
  ];

  for (const file of requiredFiles) {
    if (!existsSync(file)) {
      error("files", `Required release/deployment file is missing: ${file}`);
    }
  }

  const rootEnvExample = safeRead(".env.example");

  if (rootEnvExample.includes("\\n")) {
    error("files", ".env.example contains literal \\n sequences. Normalize the file before release.");
  }

  ok("files", "Required release/deployment files are present.");
}

function checkCoreRuntimeEnv() {
  requireEnv("DATABASE_URL", "api");
  requireEnv("AUTH_SECRET", "api");
  requireEnv("WEB_APP_URL", "api");
  requireEnv("CORS_ORIGINS", "api");

  if (target === "production") {
    requireEnvValue("NODE_ENV", "production", "api");
  }

  rejectLocalUrlEnv("DATABASE_URL", "api");
  rejectLocalUrlEnv("WEB_APP_URL", "api");

  const databaseUrl = env("DATABASE_URL");

  if (databaseUrl && !databaseUrl.startsWith("postgresql://") && !databaseUrl.startsWith("postgres://")) {
    error("api", "DATABASE_URL must be a PostgreSQL connection string.");
  }

  if (env("TEST_DATABASE_URL") && env("TEST_DATABASE_URL") === env("DATABASE_URL")) {
    error("api", "TEST_DATABASE_URL must not equal DATABASE_URL.");
  }

  ok("api", "Core runtime env checks completed.");
}

function checkClientRuntimeEnv() {
  requireEnv("NEXT_PUBLIC_API_BASE_URL", "web");
  requireEnv("NEXT_PUBLIC_SITE_URL", "web");

  const recommended = [
    "BABYLOOP_API_BASE_URL",
    "BABYLOOP_SITE_URL",
    "NEXT_PUBLIC_BACKOFFICE_BASE_URL"
  ];

  for (const key of recommended) {
    if (!env(key)) {
      warn("web", `${key} is recommended for deployed web/backoffice consistency.`);
    }
  }

  rejectLocalUrlEnv("NEXT_PUBLIC_API_BASE_URL", "web");
  rejectLocalUrlEnv("BABYLOOP_API_BASE_URL", "web");
  rejectLocalUrlEnv("NEXT_PUBLIC_SITE_URL", "web");
  rejectLocalUrlEnv("BABYLOOP_SITE_URL", "web");
  rejectLocalUrlEnv("NEXT_PUBLIC_BACKOFFICE_BASE_URL", "web");

  requireHttpsUrlEnv("NEXT_PUBLIC_API_BASE_URL", "web");
  requireHttpsUrlEnv("NEXT_PUBLIC_SITE_URL", "web");

  ok("web", "Client runtime env checks completed.");
}

function checkCorsAndUrls() {
  const corsOrigins = splitCsvEnv("CORS_ORIGINS");

  if (corsOrigins.length === 0) {
    error("security", "CORS_ORIGINS must include the deployed web/backoffice origins.");
    return;
  }

  for (const origin of corsOrigins) {
    if (isLocalUrl(origin)) {
      error("security", `CORS_ORIGINS must not include local origins for ${target}: ${origin}`);
    }

    if (!isHttpsUrl(origin)) {
      error("security", `CORS_ORIGINS must use HTTPS for ${target}: ${origin}`);
    }
  }

  const publicApiBaseUrl = env("NEXT_PUBLIC_API_BASE_URL");
  const webAppUrl = env("WEB_APP_URL");

  if (publicApiBaseUrl && webAppUrl && stripTrailingSlash(publicApiBaseUrl) === stripTrailingSlash(webAppUrl)) {
    warn("security", "NEXT_PUBLIC_API_BASE_URL and WEB_APP_URL are identical. Confirm API and web origins are intentionally shared.");
  }

  ok("security", "CORS and URL checks completed.");
}

function checkAuthRuntimeEnv() {
  const authSecret = env("AUTH_SECRET");

  if (authSecret && authSecret.length < 32) {
    error("auth", "AUTH_SECRET must be at least 32 characters.");
  }

  if (authSecret && /local|dev|change|example|please/i.test(authSecret)) {
    error("auth", "AUTH_SECRET looks like a local/example placeholder.");
  }

  if (env("ALLOW_AUTH_UNAVAILABLE") === "true") {
    error("auth", "ALLOW_AUTH_UNAVAILABLE must not be true in staging/production.");
  }

  const ttl = numberEnv("AUTH_TOKEN_TTL_SECONDS");

  if (ttl !== null && (ttl < 300 || ttl > 3600)) {
    warn("auth", "AUTH_TOKEN_TTL_SECONDS is outside the recommended 300-3600 second range.");
  }

  ok("auth", "Auth env checks completed.");
}

function checkGoogleOAuthEnv() {
  const keys = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"];
  const configured = keys.filter((key) => Boolean(env(key)));

  if (configured.length > 0 && configured.length < keys.length) {
    error("oauth", `Google OAuth is partially configured. Missing: ${keys.filter((key) => !env(key)).join(", ")}`);
  }

  if (env("GOOGLE_REDIRECT_URI")) {
    rejectLocalUrlEnv("GOOGLE_REDIRECT_URI", "oauth");
    requireHttpsUrlEnv("GOOGLE_REDIRECT_URI", "oauth");
  }

  ok("oauth", "Google OAuth env checks completed.");
}

function checkEmailEnv() {
  const deliveryMode = lowerEnv("EMAIL_DELIVERY_MODE") || "noop";
  const provider = lowerEnv("EMAIL_PROVIDER") || "mock";
  const sendEnabled = lowerEnv("EMAIL_SEND_ENABLED") === "true";

  if (!["noop", "provider"].includes(deliveryMode)) {
    error("email", "EMAIL_DELIVERY_MODE must be noop or provider.");
  }

  if (!["mock", "smtp", "resend"].includes(provider)) {
    error("email", "EMAIL_PROVIDER must be mock, smtp, or resend.");
  }

  if (target === "production" && deliveryMode === "noop") {
    warn("email", "EMAIL_DELIVERY_MODE=noop means verification/reset emails will not be delivered in production.");
  }

  if (sendEnabled) {
    if (deliveryMode !== "provider") {
      error("email", "EMAIL_SEND_ENABLED=true requires EMAIL_DELIVERY_MODE=provider.");
    }

    requireEnv("EMAIL_FROM", "email");

    if (provider === "mock") {
      error("email", "EMAIL_SEND_ENABLED=true must not use EMAIL_PROVIDER=mock.");
    }

    if (provider === "resend") {
      requireEnv("RESEND_API_KEY", "email");
    }

    if (provider === "smtp") {
      for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"]) {
        requireEnv(key, "email");
      }
    }
  }

  ok("email", "Email env checks completed.");
}

function checkNotificationEmailEnv() {
  const enabled = lowerEnv("NOTIFICATION_EMAIL_ENABLED") === "true";
  const provider = lowerEnv("NOTIFICATION_EMAIL_PROVIDER") || "resend";

  if (target === "production" && !enabled) {
    error("notification-email", "NOTIFICATION_EMAIL_ENABLED must be true for marketplace email notifications in production.");
  }

  if (!enabled) {
    warn("notification-email", "Marketplace message/favorite email delivery is disabled.");
    ok("notification-email", "Disabled notification email configuration checked.");
    return;
  }

  if (provider !== "resend") {
    error("notification-email", "NOTIFICATION_EMAIL_PROVIDER must be resend.");
  }

  requireEnv("RESEND_API_KEY", "notification-email");
  requireEnv("RESEND_FROM_EMAIL", "notification-email");

  if (env("RESEND_FROM_EMAIL")?.endsWith(".local")) {
    error("notification-email", "RESEND_FROM_EMAIL must use a verified production sender domain.");
  }

  if (env("RESEND_API_BASE_URL")) {
    requireHttpsUrlEnv("RESEND_API_BASE_URL", "notification-email");
  }

  ok("notification-email", "Marketplace notification email env checks completed.");
}

function checkImageStorageEnv() {
  const driver = lowerEnv("IMAGE_STORAGE_DRIVER") || "local";

  if (!["local", "s3"].includes(driver)) {
    error("storage", "IMAGE_STORAGE_DRIVER must be local or s3.");
    return;
  }

  if (target === "production" && driver === "local") {
    error("storage", "IMAGE_STORAGE_DRIVER=local is not acceptable for production user uploads.");
  }

  if (target === "staging" && driver === "local") {
    warn("storage", "IMAGE_STORAGE_DRIVER=local is acceptable for local only. Prefer s3/R2 for staging.");
  }

  if (driver === "s3") {
    for (const key of [
      "IMAGE_STORAGE_PUBLIC_BASE_URL",
      "S3_BUCKET",
      "S3_REGION",
      "S3_ACCESS_KEY_ID",
      "S3_SECRET_ACCESS_KEY"
    ]) {
      requireEnv(key, "storage");
    }

    requireHttpsUrlEnv("IMAGE_STORAGE_PUBLIC_BASE_URL", "storage");

    if (env("S3_ENDPOINT")) {
      requireHttpsUrlEnv("S3_ENDPOINT", "storage");
    }

    if (lowerEnv("S3_REGION") === "auto" && !env("S3_ENDPOINT")) {
      error("storage", "S3_ENDPOINT is required when S3_REGION=auto (Cloudflare R2 mode).");
    }

    if (env("S3_ENDPOINT") && env("IMAGE_STORAGE_PUBLIC_BASE_URL")) {
      try {
        const endpointHost = new URL(env("S3_ENDPOINT")).hostname;
        const publicHost = new URL(env("IMAGE_STORAGE_PUBLIC_BASE_URL")).hostname;

        if (endpointHost === publicHost && endpointHost.endsWith("r2.cloudflarestorage.com")) {
          warn("storage", "IMAGE_STORAGE_PUBLIC_BASE_URL should use an R2 public/custom domain, not the authenticated R2 S3 endpoint.");
        }
      } catch {
        // URL shape errors are reported by requireHttpsUrlEnv above.
      }
    }
  }

  ok("storage", "Image storage env checks completed.");
}

function checkListingImageAuthenticityEnv() {
  const provider = lowerEnv("LISTING_IMAGE_AUTHENTICITY_PROVIDER");

  if (target === "production") {
    if (!provider || provider === "mock" || provider === "unavailable") {
      error("image-authenticity", "LISTING_IMAGE_AUTHENTICITY_PROVIDER must be gemini for production.");
    }
  }

  if (provider && !["mock", "gemini", "unavailable"].includes(provider)) {
    error("image-authenticity", "LISTING_IMAGE_AUTHENTICITY_PROVIDER must be mock, gemini, or unavailable.");
  }

  if (provider === "gemini") {
    requireAnyEnv(["GEMINI_API_KEY", "GOOGLE_API_KEY"], "image-authenticity");
  }

  ok("image-authenticity", "Listing image authenticity env checks completed.");
}

function checkAiProviderEnv() {
  checkProviderConfig({
    category: "assistant",
    providerKey: "ASSISTANT_PROVIDER",
    openAiModelKey: "OPENAI_ASSISTANT_MODEL",
    geminiModelKey: "GEMINI_ASSISTANT_MODEL"
  });

  checkProviderConfig({
    category: "listing-ai",
    providerKey: "AI_LISTING_DRAFT_PROVIDER",
    openAiModelKey: "OPENAI_LISTING_DRAFT_MODEL",
    geminiModelKey: "GEMINI_LISTING_DRAFT_MODEL"
  });

  checkProviderConfig({
    category: "moderation-ai",
    providerKey: "AI_MODERATION_SUMMARY_PROVIDER",
    openAiModelKey: "OPENAI_MODERATION_SUMMARY_MODEL",
    geminiModelKey: "GEMINI_MODERATION_SUMMARY_MODEL"
  });

  ok("ai", "AI provider env checks completed.");
}

function checkProviderConfig({ category, providerKey, openAiModelKey, geminiModelKey }) {
  const provider = lowerEnv(providerKey) || "unavailable";

  if (!["unavailable", "mock", "openai", "gemini"].includes(provider)) {
    error(category, `${providerKey} must be unavailable, mock, openai, or gemini.`);
    return;
  }

  if (target === "production" && provider === "mock") {
    warn(category, `${providerKey}=mock is useful for demos but should not be considered production AI.`);
  }

  if (provider === "openai") {
    requireEnv("OPENAI_API_KEY", category);
    requireEnv(openAiModelKey, category);
  }

  if (provider === "gemini") {
    requireAnyEnv(["GEMINI_API_KEY", "GOOGLE_API_KEY"], category);
    requireEnv(geminiModelKey, category);
  }
}

function checkRagEnv() {
  const enabled = lowerEnv("RAG_ENABLED") === "true";

  if (!enabled) {
    if (target === "production") {
      warn("rag", "RAG_ENABLED is not true. Assistant may run without grounded knowledge retrieval.");
    }
    ok("rag", "RAG disabled; strict RAG env checks skipped.");
    return;
  }

  requireEnvValue("RAG_VECTOR_STORE", "qdrant", "rag");
  requireEnv("RAG_QDRANT_URL", "rag");
  requireEnv("RAG_QDRANT_COLLECTION", "rag");
  requireEnv("RAG_QDRANT_VECTOR_SIZE", "rag");
  requireEnv("RAG_EMBEDDING_PROVIDER", "rag");
  requireEnv("RAG_EMBEDDING_MODEL", "rag");
  requireEnv("RAG_CHAT_PROVIDER", "rag");
  requireEnv("RAG_CHAT_MODEL", "rag");

  rejectLocalUrlEnv("RAG_QDRANT_URL", "rag");

  if (lowerEnv("RAG_REQUIRE_SOURCES") !== "true") {
    error("rag", "RAG_REQUIRE_SOURCES must be true for staging/production.");
  }

  if (lowerEnv("RAG_EMBEDDING_PROVIDER") === "gemini" || lowerEnv("RAG_CHAT_PROVIDER") === "gemini") {
    requireAnyEnv(["GEMINI_API_KEY", "GOOGLE_API_KEY"], "rag");
  }

  for (const backendKey of ["RAG_CACHE_BACKEND", "RAG_USAGE_LIMITS_BACKEND", "RAG_METRICS_BACKEND"]) {
    const backend = lowerEnv(backendKey);

    if (backend === "redis") {
      requireEnv("RAG_REDIS_URL", "rag");
      rejectLocalUrlEnv("RAG_REDIS_URL", "rag");
    }
  }

  if (target === "production" && lowerEnv("RAG_LIVE_EVAL_ENABLED") === "true") {
    warn("rag", "RAG_LIVE_EVAL_ENABLED=true can consume model quota in production.");
  }

  if (target === "production" && lowerEnv("RAG_REINDEX_ACTION_ENABLED") === "true") {
    warn("rag", "RAG_REINDEX_ACTION_ENABLED=true should stay disabled unless a production job runner exists.");
  }

  ok("rag", "RAG env checks completed.");
}

function checkObservabilityEnv() {
  const metricsEnabled = lowerEnv("OBSERVABILITY_METRICS_ENABLED") === "true";
  const metricsToken = env("OBSERVABILITY_METRICS_TOKEN");
  const errorWebhookUrl = env("OBSERVABILITY_ERROR_WEBHOOK_URL");

  if (target === "production" && !metricsEnabled) {
    error("observability", "OBSERVABILITY_METRICS_ENABLED must be true in production.");
  }

  if (metricsEnabled) {
    requireEnv("OBSERVABILITY_METRICS_TOKEN", "observability");

    if (metricsToken && metricsToken.length < 32) {
      error("observability", "OBSERVABILITY_METRICS_TOKEN must be at least 32 characters.");
    }

    if (metricsToken && /change|example|replace|local|dev/i.test(metricsToken)) {
      error("observability", "OBSERVABILITY_METRICS_TOKEN looks like a placeholder.");
    }
  }

  if (target === "production") {
    requireEnv("OBSERVABILITY_ERROR_WEBHOOK_URL", "observability");
    requireEnvValue("HEALTH_REQUIRE_NOTIFICATION_WORKER", "true", "observability");
    requireEnvValue("HEALTH_REQUIRE_CHILD_REMINDER_WORKER", "true", "observability");
    requireEnvValue("HEALTH_FAIL_ON_STALE_NOTIFICATION_CLAIMS", "true", "observability");
  }

  if (errorWebhookUrl) {
    requireHttpsUrlEnv("OBSERVABILITY_ERROR_WEBHOOK_URL", "observability");
  }

  const readinessTimeout = numberEnv("HEALTH_READINESS_TIMEOUT_MS");
  if (readinessTimeout !== null && (readinessTimeout < 500 || readinessTimeout > 10000)) {
    error("observability", "HEALTH_READINESS_TIMEOUT_MS must be between 500 and 10000 milliseconds.");
  }

  for (const key of [
    "NOTIFICATION_WORKER_MAX_STALENESS_SECONDS",
    "CHILD_REMINDER_WORKER_MAX_STALENESS_SECONDS"
  ]) {
    const value = numberEnv(key);
    if (value !== null && (value < 60 || value > 86400)) {
      error("observability", `${key} must be between 60 and 86400 seconds.`);
    }
  }

  ok("observability", "Runtime readiness and observability env checks completed.");
}

function checkBackofficePosture() {
  if (!env("NEXT_PUBLIC_BACKOFFICE_BASE_URL")) {
    warn("backoffice", "NEXT_PUBLIC_BACKOFFICE_BASE_URL is recommended for deployed web/backoffice navigation.");
  }

  ok("backoffice", "Backoffice deployment posture checks completed.");
}

function requireEnv(key, category) {
  if (!env(key)) {
    error(category, `${key} is required for ${target}.`);
  }
}

function requireAnyEnv(keys, category) {
  if (!keys.some((key) => Boolean(env(key)))) {
    error(category, `One of these env variables is required for ${target}: ${keys.join(", ")}`);
  }
}

function requireEnvValue(key, expected, category) {
  const value = env(key);

  if (!value) {
    error(category, `${key} is required for ${target}.`);
    return;
  }

  if (value !== expected) {
    error(category, `${key} must be "${expected}" for ${target}. Current value: "${value}".`);
  }
}

function rejectLocalUrlEnv(key, category) {
  const value = env(key);

  if (!value) {
    return;
  }

  if (isLocalUrl(value)) {
    error(category, `${key} must not point to localhost/local/private dev services for ${target}. Current value: ${value}`);
  }
}

function requireHttpsUrlEnv(key, category) {
  const value = env(key);

  if (!value) {
    return;
  }

  if (!isHttpsUrl(value)) {
    error(category, `${key} must use HTTPS for ${target}. Current value: ${value}`);
  }
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isLocalUrl(value) {
  const text = String(value).toLowerCase();

  if (
    text.includes("localhost") ||
    text.includes("127.0.0.1") ||
    text.includes("0.0.0.0") ||
    text.includes("host.docker.internal")
  ) {
    return true;
  }

  try {
    const parsed = new URL(value);
    return ["localhost", "127.0.0.1", "0.0.0.0"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function env(key) {
  const value = process.env[key];

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function lowerEnv(key) {
  return env(key).toLowerCase();
}

function numberEnv(key) {
  const value = env(key);

  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitCsvEnv(key) {
  return env(key)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/u, "");
}

function getTrackedFiles() {
  const result = spawnSync("git", ["ls-files"], {
    encoding: "utf-8"
  });

  if (result.status !== 0) {
    warn("repo", "Could not read tracked files with git ls-files.");
    return [];
  }

  return result.stdout
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean);
}

function safeRead(path) {
  if (!existsSync(path)) {
    return "";
  }

  return readFileSync(path, "utf-8");
}

function ok(category, message) {
  results.push({ level: "ok", category, message });
}

function note(category, message) {
  results.push({ level: "note", category, message });
}

function warn(category, message) {
  results.push({ level: "warn", category, message });
}

function error(category, message) {
  results.push({ level: "error", category, message });
}

function printResultsAndExit() {
  const errors = results.filter((result) => result.level === "error");
  const warnings = results.filter((result) => result.level === "warn");

  console.log(`\nBabyLoop deployment readiness check`);
  console.log(`Target: ${target}`);
  console.log("");

  for (const result of results) {
    const prefix = {
      ok: "✅",
      note: "ℹ️ ",
      warn: "⚠️ ",
      error: "❌"
    }[result.level];

    console.log(`${prefix} [${result.category}] ${result.message}`);
  }

  console.log("");
  console.log(`Summary: ${errors.length} error(s), ${warnings.length} warning(s).`);

  if (target === "local") {
    console.log("Tip: run `pnpm deploy:check:staging` or `pnpm deploy:check:production` with real deployment env to validate release readiness.");
  }

  if (errors.length > 0) {
    process.exit(1);
  }
}
