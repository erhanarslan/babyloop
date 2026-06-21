import { fileURLToPath } from "node:url";
import type { GoogleOAuthConfig } from "../services/google-oauth.service.js";

export type AiModerationSummaryRuntimeConfig =
  | { provider: "unavailable" }
  | { provider: "mock" }
  | {
      provider: "openai";
      apiKey: string;
      model: string;
      endpoint?: string;
    }
  | {
      provider: "gemini";
      apiKey: string;
      model: string;
      endpoint?: string;
    };

export type AiListingDraftRuntimeConfig =
  | { provider: "unavailable" }
  | { provider: "mock" }
  | {
      provider: "openai";
      apiKey: string;
      model: string;
      endpoint?: string;
    }
  | {
      provider: "gemini";
      apiKey: string;
      model: string;
      endpoint?: string;
    };

export type AssistantRuntimeConfig =
  | { provider: "unavailable" }
  | { provider: "mock" }
  | {
      provider: "openai";
      apiKey: string;
      model: string;
      endpoint?: string;
    }
  | {
      provider: "gemini";
      apiKey: string;
      model: string;
      endpoint?: string;
    };

export type RagRuntimeConfig =
  | { enabled: false }
  | {
      enabled: true;
      vectorStore: "qdrant";
      qdrantUrl: string;
      qdrantApiKey?: string;
      qdrantCollection: string;
      qdrantVectorSize: number;
      embeddingProvider: "gemini";
      embeddingModel: string;
      chatProvider: "gemini";
      chatModel: string;
      minScore: number;
      maxChunks: number;
      maxSourcesPerDocument: number;
      maxContextChars: number;
      requireSources: boolean;
      hybridEnabled: boolean;
      lexicalScoreWeight: number;
      vectorScoreWeight: number;
      titleMatchBonus: number;
      sectionMatchBonus: number;
      duplicatePenalty: number;
      noSourceMinScore: number;
      minSourceCoverage: number;
      redisEnabled: boolean;
      redisUrl: string;
      redisKeyPrefix: string;
      redisConnectTimeoutMs: number;
      cacheEnabled: boolean;
      cacheBackend: "memory" | "redis";
      cacheTtlSeconds: number;
      cacheMaxEntries: number;
      usageLimitsEnabled: boolean;
      usageLimitsBackend: "memory" | "redis";
      hourlyGuestLimit: number;
      dailyGuestLimit: number;
      hourlyUserLimit: number;
      dailyUserLimit: number;
      adminLimitBypass: boolean;
      metricsEnabled: boolean;
      metricsBackend: "memory" | "redis";
      liveEvalEnabled: boolean;
      topicMatchBonus: number;
      sourceReliabilityBonus: number;
      geminiApiKey: string;
      geminiEndpoint?: string;
    };

export type ApiRuntimeConfig = {
  aiListingDraft: AiListingDraftRuntimeConfig;
  aiModerationSummary: AiModerationSummaryRuntimeConfig;
  assistant: AssistantRuntimeConfig;
  allowAuthUnavailable: boolean;
  authRateLimitMax: number;
  authRateLimitWindowSeconds: number;
  authSecret?: string;
  authTokenTtlSeconds: number;
  corsOrigins: string[];
  databaseUrl?: string;
  emailDeliveryMode: "noop";
  emailFrom?: string;
  googleOAuth?: GoogleOAuthConfig;
  host: string;
  port: number;
  rag: RagRuntimeConfig;
  uploadRoot: string;
  webAppUrl: string;
};

const DEFAULT_CORS_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

export function readApiRuntimeConfig(env: NodeJS.ProcessEnv = process.env): ApiRuntimeConfig {
  const allowAuthUnavailable = readBoolean(env.ALLOW_AUTH_UNAVAILABLE, false);
  const config: ApiRuntimeConfig = {
    aiListingDraft: readAiListingDraftConfig(env),
    aiModerationSummary: readAiModerationSummaryConfig(env),
    assistant: readAssistantConfig(env),
    allowAuthUnavailable,
    authRateLimitMax: readPositiveInteger(env.AUTH_RATE_LIMIT_MAX, 10),
    authRateLimitWindowSeconds: readPositiveInteger(env.AUTH_RATE_LIMIT_WINDOW_SECONDS, 60),
    authTokenTtlSeconds: readPositiveInteger(env.AUTH_TOKEN_TTL_SECONDS, 60 * 15),
    corsOrigins: readCorsOrigins(env.CORS_ORIGINS),
    emailDeliveryMode: readEmailDeliveryMode(env.EMAIL_DELIVERY_MODE),
    host: env.HOST ?? "127.0.0.1",
    port: readPort(env.PORT),
    rag: readRagConfig(env),
    uploadRoot: readUploadRoot(env.UPLOAD_ROOT),
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

  if (env.EMAIL_FROM?.trim()) {
    config.emailFrom = env.EMAIL_FROM.trim();
  }

  if (config.databaseUrl && !config.authSecret && !config.allowAuthUnavailable) {
    throw new Error(
      "AUTH_SECRET is required when DATABASE_URL is configured. Set ALLOW_AUTH_UNAVAILABLE=true only for local unavailable-mode testing."
    );
  }

  return config;
}

function readAssistantConfig(env: NodeJS.ProcessEnv): AssistantRuntimeConfig {
  const provider = (env.ASSISTANT_PROVIDER ?? "unavailable").trim().toLowerCase();

  if (!provider || provider === "unavailable" || provider === "off" || provider === "none") {
    return { provider: "unavailable" };
  }

  if (provider === "mock") {
    return { provider: "mock" };
  }

  if (provider === "gemini") {
    const endpoint = readGeminiEndpoint(env);

    return {
      provider: "gemini",
      apiKey: readGeminiApiKey(env),
      model: env.GEMINI_ASSISTANT_MODEL?.trim() || "gemini-2.5-flash-lite",
      ...(endpoint ? { endpoint } : {})
    };
  }

  if (provider !== "openai") {
    throw new Error("ASSISTANT_PROVIDER must be unavailable, mock, openai, or gemini.");
  }

  const apiKey = env.OPENAI_API_KEY?.trim();
  const model = env.OPENAI_ASSISTANT_MODEL?.trim();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required when ASSISTANT_PROVIDER=openai.");
  }

  if (!model) {
    throw new Error("OPENAI_ASSISTANT_MODEL is required when ASSISTANT_PROVIDER=openai.");
  }

  const endpoint = env.OPENAI_RESPONSES_ENDPOINT?.trim();

  return {
    provider: "openai",
    apiKey,
    model,
    ...(endpoint ? { endpoint } : {})
  };
}

function readAiListingDraftConfig(env: NodeJS.ProcessEnv): AiListingDraftRuntimeConfig {
  const provider = (env.AI_LISTING_DRAFT_PROVIDER ?? "unavailable").trim().toLowerCase();

  if (!provider || provider === "unavailable" || provider === "off" || provider === "none") {
    return { provider: "unavailable" };
  }

  if (provider === "mock") {
    return { provider: "mock" };
  }

  if (provider === "gemini") {
    const endpoint = readGeminiEndpoint(env);

    return {
      provider: "gemini",
      apiKey: readGeminiApiKey(env),
      model: env.GEMINI_LISTING_DRAFT_MODEL?.trim() || "gemini-2.5-flash",
      ...(endpoint ? { endpoint } : {})
    };
  }

  if (provider !== "openai") {
    throw new Error("AI_LISTING_DRAFT_PROVIDER must be unavailable, mock, openai, or gemini.");
  }

  const apiKey = env.OPENAI_API_KEY?.trim();
  const model = env.OPENAI_LISTING_DRAFT_MODEL?.trim();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required when AI_LISTING_DRAFT_PROVIDER=openai.");
  }

  if (!model) {
    throw new Error("OPENAI_LISTING_DRAFT_MODEL is required when AI_LISTING_DRAFT_PROVIDER=openai.");
  }

  const endpoint = env.OPENAI_RESPONSES_ENDPOINT?.trim();

  return {
    provider: "openai",
    apiKey,
    model,
    ...(endpoint ? { endpoint } : {})
  };
}

function readAiModerationSummaryConfig(env: NodeJS.ProcessEnv): AiModerationSummaryRuntimeConfig {
  const provider = (env.AI_MODERATION_SUMMARY_PROVIDER ?? "mock").trim().toLowerCase();

  if (!provider || provider === "unavailable" || provider === "off" || provider === "none") {
    return { provider: "unavailable" };
  }

  if (provider === "mock") {
    return { provider: "mock" };
  }

  if (provider === "gemini") {
    const endpoint = readGeminiEndpoint(env);

    return {
      provider: "gemini",
      apiKey: readGeminiApiKey(env),
      model: env.GEMINI_MODERATION_SUMMARY_MODEL?.trim() || "gemini-2.5-flash-lite",
      ...(endpoint ? { endpoint } : {})
    };
  }

  if (provider !== "openai") {
    throw new Error("AI_MODERATION_SUMMARY_PROVIDER must be unavailable, mock, openai, or gemini.");
  }

  const apiKey = env.OPENAI_API_KEY?.trim();
  const model = env.OPENAI_MODERATION_SUMMARY_MODEL?.trim();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required when AI_MODERATION_SUMMARY_PROVIDER=openai.");
  }

  if (!model) {
    throw new Error("OPENAI_MODERATION_SUMMARY_MODEL is required when AI_MODERATION_SUMMARY_PROVIDER=openai.");
  }

  const endpoint = env.OPENAI_RESPONSES_ENDPOINT?.trim();

  return {
    provider: "openai",
    apiKey,
    model,
    ...(endpoint ? { endpoint } : {})
  };
}

function readRagConfig(env: NodeJS.ProcessEnv): RagRuntimeConfig {
  if (!readBoolean(env.RAG_ENABLED, false)) {
    return { enabled: false };
  }

  const vectorStore = (env.RAG_VECTOR_STORE ?? "qdrant").trim().toLowerCase();
  const embeddingProvider = (env.RAG_EMBEDDING_PROVIDER ?? "gemini").trim().toLowerCase();
  const chatProvider = (env.RAG_CHAT_PROVIDER ?? "gemini").trim().toLowerCase();
  const qdrantApiKey = env.RAG_QDRANT_API_KEY?.trim();
  const geminiEndpoint = readGeminiEndpoint(env);

  if (vectorStore !== "qdrant") {
    throw new Error("RAG_VECTOR_STORE must be qdrant.");
  }

  if (embeddingProvider !== "gemini") {
    throw new Error("RAG_EMBEDDING_PROVIDER must be gemini.");
  }

  if (chatProvider !== "gemini") {
    throw new Error("RAG_CHAT_PROVIDER must be gemini.");
  }

  return {
    enabled: true,
    vectorStore: "qdrant",
    qdrantUrl: env.RAG_QDRANT_URL?.trim() || "http://localhost:6333",
    ...(qdrantApiKey ? { qdrantApiKey } : {}),
    qdrantCollection: env.RAG_QDRANT_COLLECTION?.trim() || "babyloop_rag",
    qdrantVectorSize: readPositiveInteger(env.RAG_QDRANT_VECTOR_SIZE, 3072),
    embeddingProvider: "gemini",
    embeddingModel: env.RAG_EMBEDDING_MODEL?.trim() || "gemini-embedding-001",
    chatProvider: "gemini",
    chatModel: env.RAG_CHAT_MODEL?.trim() || "gemini-2.5-flash",
    minScore: readNumberInRange(env.RAG_MIN_SCORE, 0.72, 0, 1),
    maxChunks: readPositiveInteger(env.RAG_MAX_CHUNKS, 5),
    maxSourcesPerDocument: readPositiveInteger(env.RAG_MAX_SOURCES_PER_DOCUMENT, 2),
    maxContextChars: readPositiveInteger(env.RAG_MAX_CONTEXT_CHARS, 8_000),
    requireSources: readBoolean(env.RAG_REQUIRE_SOURCES, true),
    hybridEnabled: readBoolean(env.RAG_HYBRID_ENABLED, true),
    lexicalScoreWeight: readNumberInRange(env.RAG_LEXICAL_SCORE_WEIGHT, 0.18, 0, 2),
    vectorScoreWeight: readNumberInRange(env.RAG_VECTOR_SCORE_WEIGHT, 1, 0, 2),
    titleMatchBonus: readNumberInRange(env.RAG_TITLE_MATCH_BONUS, 0.04, 0, 1),
    sectionMatchBonus: readNumberInRange(env.RAG_SECTION_MATCH_BONUS, 0.03, 0, 1),
    duplicatePenalty: readNumberInRange(env.RAG_DUPLICATE_PENALTY, 0.05, 0, 1),
    noSourceMinScore: readNumberInRange(env.RAG_NO_SOURCE_MIN_SCORE, 0.68, 0, 1),
    minSourceCoverage: readPositiveInteger(env.RAG_MIN_SOURCE_COVERAGE, 1),
    redisEnabled: readBoolean(env.RAG_REDIS_ENABLED, false),
    redisUrl: env.RAG_REDIS_URL?.trim() || "redis://localhost:6379",
    redisKeyPrefix: env.RAG_REDIS_KEY_PREFIX?.trim() || "babyloop:rag",
    redisConnectTimeoutMs: readPositiveInteger(env.RAG_REDIS_CONNECT_TIMEOUT_MS, 1_000),
    cacheEnabled: readBoolean(env.RAG_CACHE_ENABLED, true),
    cacheBackend: readBackend(env.RAG_CACHE_BACKEND, "memory", "RAG_CACHE_BACKEND"),
    cacheTtlSeconds: readPositiveInteger(env.RAG_CACHE_TTL_SECONDS, 900),
    cacheMaxEntries: readPositiveInteger(env.RAG_CACHE_MAX_ENTRIES, 200),
    usageLimitsEnabled: readBoolean(env.RAG_USAGE_LIMITS_ENABLED, true),
    usageLimitsBackend: readBackend(env.RAG_USAGE_LIMITS_BACKEND, "memory", "RAG_USAGE_LIMITS_BACKEND"),
    hourlyGuestLimit: readPositiveInteger(env.RAG_HOURLY_GUEST_LIMIT, 10),
    dailyGuestLimit: readPositiveInteger(env.RAG_DAILY_GUEST_LIMIT, 20),
    hourlyUserLimit: readPositiveInteger(env.RAG_HOURLY_USER_LIMIT, 50),
    dailyUserLimit: readPositiveInteger(env.RAG_DAILY_USER_LIMIT, 100),
    adminLimitBypass: readBoolean(env.RAG_ADMIN_LIMIT_BYPASS, true),
    metricsEnabled: readBoolean(env.RAG_METRICS_ENABLED, true),
    metricsBackend: readBackend(env.RAG_METRICS_BACKEND, "memory", "RAG_METRICS_BACKEND"),
    liveEvalEnabled: readBoolean(env.RAG_LIVE_EVAL_ENABLED, false),
    topicMatchBonus: readNumberInRange(env.RAG_TOPIC_MATCH_BONUS, 0.03, 0, 1),
    sourceReliabilityBonus: readNumberInRange(env.RAG_SOURCE_RELIABILITY_BONUS, 0.02, 0, 1),
    geminiApiKey: readGeminiApiKey(env),
    ...(geminiEndpoint ? { geminiEndpoint } : {})
  };
}

function readBackend(value: string | undefined, fallback: "memory" | "redis", name: string): "memory" | "redis" {
  const normalized = (value ?? fallback).trim().toLowerCase();

  if (normalized === "memory" || normalized === "redis") {
    return normalized;
  }

  throw new Error(`${name} must be memory or redis.`);
}

function readGeminiApiKey(env: NodeJS.ProcessEnv): string {
  const apiKey = env.GEMINI_API_KEY?.trim() || env.GOOGLE_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required when an AI provider is set to gemini.");
  }

  return apiKey;
}

function readGeminiEndpoint(env: NodeJS.ProcessEnv): string | undefined {
  const endpoint = env.GEMINI_API_ENDPOINT?.trim();

  return endpoint || undefined;
}

function readEmailDeliveryMode(value: string | undefined): "noop" {
  if (!value || value.trim().toLowerCase() === "noop") {
    return "noop";
  }

  throw new Error("EMAIL_DELIVERY_MODE must be noop until a real email provider is implemented.");
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

function readUploadRoot(value: string | undefined): string {
  return value?.trim() || fileURLToPath(new URL("../../../../var/uploads", import.meta.url));
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

function readNumberInRange(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`Invalid number value: ${value}`);
  }

  return parsed;
}
