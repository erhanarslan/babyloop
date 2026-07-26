import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { loadEnvFile } from "./deployment-lib.mjs";

const DEFAULT_CONTRACT_PATH = "deploy/env/runtime-env.contract.json";
const PLACEHOLDER_PATTERN = /(REPLACE_WITH|replace-me|example\.invalid|babyloop\.example|safe-fixture|change-this|not[-_ ]?configured|placeholder)/iu;
const SECRET_NAME_PATTERN = /(SECRET|TOKEN|PASSWORD|PASS|API_KEY|ACCESS_KEY|DATABASE_URL|REDIS_URL)/u;

export async function loadRuntimeEnvContract(path = DEFAULT_CONTRACT_PATH) {
  const resolvedPath = resolve(path);
  const content = await readFile(resolvedPath, "utf8");
  const contract = JSON.parse(content);
  if (contract.schemaVersion !== 1) throw new Error("Unsupported runtime env contract schemaVersion.");
  if (!Array.isArray(contract.required) || !Array.isArray(contract.secretKeys)) {
    throw new Error("Runtime env contract is incomplete.");
  }
  return {
    contract,
    path: resolvedPath,
    sha256: createHash("sha256").update(content).digest("hex")
  };
}

export async function auditRuntimeEnv(options) {
  const target = normalizeTarget(options.target);
  const loaded = await loadEnvFile(options.envFile);
  const contractResult = await loadRuntimeEnvContract(options.contractPath);
  const values = loaded.values;
  const errors = [];
  const warnings = [];
  const allowExample = options.allowExample === true || loaded.path.endsWith(".example");

  await checkPermissions(loaded.path, allowExample, options.allowInsecurePermissions === true, errors);
  checkRequired(values, contractResult.contract, errors);
  checkConditionals(values, contractResult.contract, errors);
  checkValues(values, contractResult.contract, { allowExample, target }, errors, warnings);
  checkOrigins(values, target, errors, warnings);
  checkProviders(values, errors, warnings);
  checkSecretLeakage(values, contractResult.contract, errors);

  if (errors.length > 0) {
    const error = new Error(`Runtime env audit failed:\n- ${errors.join("\n- ")}`);
    error.auditErrors = errors;
    throw error;
  }

  const configuredProviders = collectConfiguredProviders(values);
  const secretNames = Object.keys(values)
    .filter((key) => isSecretKey(key, contractResult.contract))
    .sort();

  return {
    schemaVersion: 1,
    kind: "runtime_env_audit",
    status: "passed",
    createdAt: new Date().toISOString(),
    environment: target,
    contractSha256: contractResult.sha256,
    sourceEnvFile: basename(loaded.path),
    sourceEnvPath: loaded.path,
    keyCount: Object.keys(values).length,
    secretKeyCount: secretNames.length,
    secretNames,
    configuredProviders,
    publicOrigins: collectPublicOrigins(values),
    warnings,
    values
  };
}

export function redactEnvironment(values, contract) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [
    key,
    isSecretKey(key, contract) ? "[REDACTED]" : value
  ]));
}

export function publicAuditView(audit, gitSha) {
  return {
    schemaVersion: audit.schemaVersion,
    kind: audit.kind,
    status: audit.status,
    createdAt: audit.createdAt,
    gitSha,
    environment: audit.environment,
    contractSha256: audit.contractSha256,
    sourceEnvFile: audit.sourceEnvFile,
    keyCount: audit.keyCount,
    secretKeyCount: audit.secretKeyCount,
    configuredProviders: audit.configuredProviders,
    publicOrigins: audit.publicOrigins,
    warnings: audit.warnings
  };
}

export function isSecretKey(key, contract) {
  return contract.secretKeys.includes(key) || SECRET_NAME_PATTERN.test(key);
}

function normalizeTarget(value) {
  const target = String(value || "").trim().toLowerCase();
  if (!["staging", "production"].includes(target)) {
    throw new Error("Runtime env audit target must be staging or production.");
  }
  return target;
}

async function checkPermissions(path, allowExample, allowInsecurePermissions, errors) {
  if (allowExample || allowInsecurePermissions || process.platform === "win32") return;
  const fileStat = await stat(path);
  if ((fileStat.mode & 0o077) !== 0) {
    errors.push(`Runtime env file must be chmod 600 (group/world bits are set): ${path}`);
  }
}

function checkRequired(values, contract, errors) {
  for (const key of contract.required) {
    if (!String(values[key] || "").trim()) errors.push(`${key} is required.`);
  }
}

function checkConditionals(values, contract, errors) {
  for (const rule of contract.conditional || []) {
    const actual = String(values[rule.when.key] || "").trim().toLowerCase();
    if (actual !== String(rule.when.equals).toLowerCase()) continue;
    for (const key of rule.require || []) {
      if (!String(values[key] || "").trim()) {
        errors.push(`${key} is required when ${rule.when.key}=${rule.when.equals}.`);
      }
    }
  }
}

function checkValues(values, contract, context, errors, warnings) {
  if (values.DEPLOY_ENVIRONMENT && values.DEPLOY_ENVIRONMENT !== context.target) {
    errors.push(`DEPLOY_ENVIRONMENT must equal ${context.target}.`);
  }
  if (values.BACKUP_ENVIRONMENT && values.BACKUP_ENVIRONMENT !== context.target) {
    errors.push(`BACKUP_ENVIRONMENT must equal ${context.target}.`);
  }
  if (values.MIGRATION_ENVIRONMENT && values.MIGRATION_ENVIRONMENT !== context.target) {
    errors.push(`MIGRATION_ENVIRONMENT must equal ${context.target}.`);
  }
  if (values.NODE_ENV !== "production") errors.push("NODE_ENV must be production.");
  if (values.ALLOW_AUTH_UNAVAILABLE !== "false") errors.push("ALLOW_AUTH_UNAVAILABLE must be false.");
  if (String(values.AUTH_SECRET || "").length < 32) errors.push("AUTH_SECRET must be at least 32 characters.");
  if (values.PUSH_TOKEN_ENCRYPTION_KEY && values.PUSH_TOKEN_ENCRYPTION_KEY.length < 32) {
    errors.push("PUSH_TOKEN_ENCRYPTION_KEY must be at least 32 characters.");
  }
  if (values.DATABASE_URL && !/^postgres(ql)?:\/\//u.test(values.DATABASE_URL)) {
    errors.push("DATABASE_URL must be a PostgreSQL URL.");
  }
  if (values.DATABASE_URL && !/[?&]sslmode=(require|verify-ca|verify-full)(?:&|$)/u.test(values.DATABASE_URL)) {
    warnings.push("DATABASE_URL does not declare sslmode=require/verify-ca/verify-full; confirm the managed provider enforces TLS.");
  }
  if (values.RAG_REDIS_ENABLED === "true" && values.RAG_REDIS_URL && !values.RAG_REDIS_URL.startsWith("rediss://")) {
    errors.push("RAG_REDIS_URL must use rediss:// outside local development.");
  }
  if (values.RAG_REDIS_ENABLED === "true") {
    const expectedPrefix = `babyloop:${context.target}:rag`;
    if (values.RAG_REDIS_KEY_PREFIX !== expectedPrefix) {
      errors.push(`RAG_REDIS_KEY_PREFIX must equal ${expectedPrefix}.`);
    }
  }
  if (values.RAG_ENABLED === "true") {
    const collection = String(values.RAG_QDRANT_COLLECTION || "").toLowerCase();
    if (!collection.includes(context.target)) {
      errors.push(`RAG_QDRANT_COLLECTION must include ${context.target} for environment isolation.`);
    }
  }
  if (values.RAG_REQUIRE_SOURCES !== "true" && values.RAG_ENABLED === "true") {
    errors.push("RAG_REQUIRE_SOURCES must be true when RAG is enabled.");
  }
  if (values.HEALTH_REQUIRE_NOTIFICATION_WORKER !== "true") {
    errors.push("HEALTH_REQUIRE_NOTIFICATION_WORKER must be true.");
  }
  if (values.HEALTH_REQUIRE_CHILD_REMINDER_WORKER !== "true") {
    errors.push("HEALTH_REQUIRE_CHILD_REMINDER_WORKER must be true.");
  }
  if (values.HEALTH_FAIL_ON_STALE_NOTIFICATION_CLAIMS !== "true") {
    errors.push("HEALTH_FAIL_ON_STALE_NOTIFICATION_CLAIMS must be true.");
  }
  const requirePublicSurfaces = String(values.DEPLOY_REQUIRE_PUBLIC_SURFACES || "").trim().toLowerCase();
  if (requirePublicSurfaces && !["true", "false"].includes(requirePublicSurfaces)) {
    errors.push("DEPLOY_REQUIRE_PUBLIC_SURFACES must be true or false.");
  }
  if (context.target === "production" && requirePublicSurfaces !== "true") {
    errors.push("DEPLOY_REQUIRE_PUBLIC_SURFACES must be true in production.");
  }

  for (const key of contract.httpsUrlKeys || []) {
    const value = String(values[key] || "").trim();
    if (!value) continue;
    if (!/^https:\/\//u.test(value)) errors.push(`${key} must use HTTPS.`);
  }

  if (!context.allowExample) {
    for (const [key, value] of Object.entries(values)) {
      if (PLACEHOLDER_PATTERN.test(String(value))) errors.push(`${key} still contains a placeholder value.`);
    }
  }

  if (context.target === "production") {
    for (const key of ["WEB_APP_URL", "NEXT_PUBLIC_API_BASE_URL", "NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_BACKOFFICE_BASE_URL"]) {
      if (/staging/iu.test(String(values[key] || ""))) errors.push(`${key} must not point at staging in production.`);
    }
  }
}

function checkOrigins(values, target, errors, warnings) {
  const web = normalizeOrigin(values.NEXT_PUBLIC_SITE_URL || values.WEB_APP_URL, "NEXT_PUBLIC_SITE_URL", errors);
  const api = normalizeOrigin(values.NEXT_PUBLIC_API_BASE_URL, "NEXT_PUBLIC_API_BASE_URL", errors);
  const admin = normalizeOrigin(values.NEXT_PUBLIC_BACKOFFICE_BASE_URL, "NEXT_PUBLIC_BACKOFFICE_BASE_URL", errors);
  const serverWeb = normalizeOrigin(values.WEB_APP_URL, "WEB_APP_URL", errors);
  const serverApi = normalizeOrigin(values.BABYLOOP_API_BASE_URL, "BABYLOOP_API_BASE_URL", errors);
  const serverSite = normalizeOrigin(values.BABYLOOP_SITE_URL, "BABYLOOP_SITE_URL", errors);
  const mobileWeb = normalizeOrigin(values.EXPO_PUBLIC_WEB_BASE_URL, "EXPO_PUBLIC_WEB_BASE_URL", errors);

  const distinct = [web, api, admin].filter(Boolean);
  if (new Set(distinct).size !== distinct.length) errors.push("Web, API and backoffice origins must be distinct.");
  if (web && serverWeb && web !== serverWeb) errors.push("WEB_APP_URL must match NEXT_PUBLIC_SITE_URL.");
  if (api && serverApi && api !== serverApi) errors.push("BABYLOOP_API_BASE_URL must match NEXT_PUBLIC_API_BASE_URL.");
  if (web && serverSite && web !== serverSite) errors.push("BABYLOOP_SITE_URL must match NEXT_PUBLIC_SITE_URL.");
  if (web && mobileWeb && web !== mobileWeb) errors.push("EXPO_PUBLIC_WEB_BASE_URL must match NEXT_PUBLIC_SITE_URL.");

  const cors = String(values.CORS_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean);
  const expected = [web, admin].filter(Boolean);
  for (const origin of expected) if (!cors.includes(origin)) errors.push(`CORS_ORIGINS must include ${origin}.`);
  for (const origin of cors) if (!origin.startsWith("https://")) errors.push(`CORS origin must use HTTPS: ${origin}`);
  if (cors.includes(api)) warnings.push("CORS_ORIGINS contains the API's own origin; remove it unless intentionally required.");

  for (const [key, expectedOrigin] of [
    ["WEB_DOMAIN", web],
    ["API_DOMAIN", api],
    ["BACKOFFICE_DOMAIN", admin]
  ]) {
    if (!values[key] || !expectedOrigin) continue;
    const host = new URL(expectedOrigin).hostname;
    if (values[key] !== host) errors.push(`${key} must match ${host}.`);
  }

  if (target === "staging" && web && !/staging/iu.test(new URL(web).hostname)) {
    warnings.push("Staging public hostname does not contain 'staging'; confirm DNS/environment isolation is intentional.");
  }
}

function checkProviders(values, errors, warnings) {
  if (values.IMAGE_STORAGE_DRIVER !== "s3") errors.push("IMAGE_STORAGE_DRIVER must be s3.");
  if (values.RAG_ENABLED !== "true") warnings.push("RAG is disabled; production differentiation and RAG acceptance will be unavailable.");
  if (values.EMAIL_SEND_ENABLED !== "true") warnings.push("EMAIL_SEND_ENABLED is not true.");
  if (values.NOTIFICATION_EMAIL_ENABLED !== "true") warnings.push("NOTIFICATION_EMAIL_ENABLED is not true.");
  if (values.NOTIFICATION_PUSH_ENABLED !== "true") warnings.push("NOTIFICATION_PUSH_ENABLED is not true.");
  if (values.PUSH_PROVIDER && values.PUSH_PROVIDER !== "expo") errors.push("PUSH_PROVIDER must be expo for the current implementation.");
  if (values.EMAIL_PROVIDER && !["resend", "smtp"].includes(values.EMAIL_PROVIDER)) {
    errors.push("EMAIL_PROVIDER must be resend or smtp when real sending is enabled.");
  }
  if (values.NOTIFICATION_EMAIL_PROVIDER && values.NOTIFICATION_EMAIL_PROVIDER !== "resend") {
    errors.push("NOTIFICATION_EMAIL_PROVIDER must be resend for the current marketplace worker.");
  }
  if (values.CHILD_REMINDER_PROCESSOR_DRY_RUN !== "false") {
    errors.push("CHILD_REMINDER_PROCESSOR_DRY_RUN must be false.");
  }
}

function checkSecretLeakage(values, contract, errors) {
  const publicKeys = Object.keys(values).filter((key) => key.startsWith("NEXT_PUBLIC_") || key.startsWith("EXPO_PUBLIC_"));
  for (const publicKey of publicKeys) {
    const publicValue = String(values[publicKey] || "");
    for (const secretKey of Object.keys(values).filter((key) => isSecretKey(key, contract))) {
      const secret = String(values[secretKey] || "");
      if (secret.length >= 8 && publicValue.includes(secret)) {
        errors.push(`${publicKey} contains the value of secret ${secretKey}.`);
      }
    }
  }
}

function collectConfiguredProviders(values) {
  const providers = [];
  if (values.IMAGE_STORAGE_DRIVER === "s3") providers.push("s3-r2");
  if (values.EMAIL_SEND_ENABLED === "true") providers.push(`email:${values.EMAIL_PROVIDER || "unknown"}`);
  if (values.NOTIFICATION_PUSH_ENABLED === "true") providers.push(`push:${values.PUSH_PROVIDER || "unknown"}`);
  if (values.RAG_ENABLED === "true") providers.push(`rag:${values.RAG_VECTOR_STORE || "unknown"}`);
  if (values.RAG_REDIS_ENABLED === "true") providers.push("redis");
  if (values.ASSISTANT_PROVIDER) providers.push(`assistant:${values.ASSISTANT_PROVIDER}`);
  if (values.GOOGLE_CLIENT_ID) providers.push("google-oauth");
  return [...new Set(providers)].sort();
}

function collectPublicOrigins(values) {
  return [
    values.NEXT_PUBLIC_SITE_URL,
    values.NEXT_PUBLIC_API_BASE_URL,
    values.NEXT_PUBLIC_BACKOFFICE_BASE_URL,
    values.IMAGE_STORAGE_PUBLIC_BASE_URL
  ].filter(Boolean).map((value) => String(value).replace(/\/+$/u, ""));
}

function normalizeOrigin(value, key, errors) {
  const normalized = String(value || "").trim().replace(/\/+$/u, "");
  if (!normalized) return "";
  try {
    const url = new URL(normalized);
    if (url.protocol !== "https:") errors.push(`${key} must use HTTPS.`);
    if (url.pathname !== "/" && url.pathname !== "") errors.push(`${key} must be an origin without a path.`);
    return url.origin;
  } catch {
    errors.push(`${key} must be a valid URL.`);
    return "";
  }
}
