import { describe, expect, it } from "vitest";
import { readApiRuntimeConfig } from "../src/config/env.js";
import { createAssistantMessageProvider } from "../src/services/assistant-ai-provider.service.js";
import { createListingDraftAiProvider } from "../src/services/listing-draft-ai-provider.service.js";
import { createAdminModerationAiSummaryProvider } from "../src/services/admin-moderation-ai-provider.service.js";

const validSecret = "babyloop-test-auth-secret-change-me-32chars";

describe("auth runtime config", () => {
  it("requires AUTH_SECRET when DATABASE_URL is configured", () => {
    expect(() =>
      readApiRuntimeConfig({
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test"
      })
    ).toThrow("AUTH_SECRET is required when DATABASE_URL is configured");
  });

  it("rejects a short AUTH_SECRET", () => {
    expect(() =>
      readApiRuntimeConfig({
        AUTH_SECRET: "too-short",
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test"
      })
    ).toThrow("AUTH_SECRET must be at least 32 characters.");
  });

  it("uses a 15 minute default access token TTL", () => {
    const config = readApiRuntimeConfig({
      AUTH_SECRET: validSecret,
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test"
    });

    expect(config.authTokenTtlSeconds).toBe(60 * 15);
  });

  it("allows auth unavailable mode only when explicitly configured", () => {
    const config = readApiRuntimeConfig({
      ALLOW_AUTH_UNAVAILABLE: "true",
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test"
    });

    expect(config.allowAuthUnavailable).toBe(true);
    expect(config.authSecret).toBeUndefined();
  });

  it("does not require partial Google OAuth config for normal startup", () => {
    const config = readApiRuntimeConfig({
      AUTH_SECRET: validSecret,
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test",
      GOOGLE_CLIENT_ID: "local-client-id"
    });

    expect(config.googleOAuth).toBeUndefined();
  });

  it("uses the mock AI moderation summary provider by default", () => {
    const config = readApiRuntimeConfig({
      AUTH_SECRET: validSecret,
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test"
    });

    expect(config.aiModerationSummary).toEqual({ provider: "mock" });
  });

  it("requires OpenAI key and model when OpenAI moderation summaries are enabled", () => {
    expect(() =>
      readApiRuntimeConfig({
        AI_MODERATION_SUMMARY_PROVIDER: "openai",
        AUTH_SECRET: validSecret,
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test"
      })
    ).toThrow("OPENAI_API_KEY is required");

    expect(() =>
      readApiRuntimeConfig({
        AI_MODERATION_SUMMARY_PROVIDER: "openai",
        AUTH_SECRET: validSecret,
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test",
        OPENAI_API_KEY: "sk-test"
      })
    ).toThrow("OPENAI_MODERATION_SUMMARY_MODEL is required");
  });

  it("accepts OpenAI moderation summary provider configuration", () => {
    const config = readApiRuntimeConfig({
      AI_MODERATION_SUMMARY_PROVIDER: "openai",
      AUTH_SECRET: validSecret,
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test",
      OPENAI_API_KEY: "sk-test",
      OPENAI_MODERATION_SUMMARY_MODEL: "configured-model",
      OPENAI_RESPONSES_ENDPOINT: "https://example.test/responses"
    });

    expect(config.aiModerationSummary).toEqual({
      provider: "openai",
      apiKey: "sk-test",
      model: "configured-model",
      endpoint: "https://example.test/responses"
    });
  });

  it("accepts Gemini provider configuration without OpenAI keys", () => {
    const config = readApiRuntimeConfig({
      AI_LISTING_DRAFT_PROVIDER: "gemini",
      AI_MODERATION_SUMMARY_PROVIDER: "gemini",
      ASSISTANT_PROVIDER: "gemini",
      AUTH_SECRET: validSecret,
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test",
      GEMINI_API_ENDPOINT: "https://generativelanguage.googleapis.com",
      GEMINI_API_KEY: "gemini-test-key"
    });

    expect(config.assistant).toEqual({
      provider: "gemini",
      apiKey: "gemini-test-key",
      model: "gemini-2.5-flash-lite",
      endpoint: "https://generativelanguage.googleapis.com"
    });
    expect(config.aiListingDraft).toEqual({
      provider: "gemini",
      apiKey: "gemini-test-key",
      model: "gemini-2.5-flash",
      endpoint: "https://generativelanguage.googleapis.com"
    });
    expect(config.aiModerationSummary).toEqual({
      provider: "gemini",
      apiKey: "gemini-test-key",
      model: "gemini-2.5-flash-lite",
      endpoint: "https://generativelanguage.googleapis.com"
    });
  });

  it("prefers GEMINI_API_KEY over GOOGLE_API_KEY", () => {
    const config = readApiRuntimeConfig({
      ASSISTANT_PROVIDER: "gemini",
      AUTH_SECRET: validSecret,
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test",
      GEMINI_API_KEY: "preferred-gemini-key",
      GOOGLE_API_KEY: "fallback-google-key"
    });

    expect(config.assistant).toMatchObject({
      provider: "gemini",
      apiKey: "preferred-gemini-key"
    });
  });

  it("uses GOOGLE_API_KEY as the Gemini fallback key", () => {
    const config = readApiRuntimeConfig({
      ASSISTANT_PROVIDER: "gemini",
      AUTH_SECRET: validSecret,
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test",
      GOOGLE_API_KEY: "fallback-google-key"
    });

    expect(config.assistant).toMatchObject({
      provider: "gemini",
      apiKey: "fallback-google-key"
    });
  });

  it("requires a Gemini key when Gemini providers are enabled", () => {
    expect(() =>
      readApiRuntimeConfig({
        ASSISTANT_PROVIDER: "gemini",
        AUTH_SECRET: validSecret,
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test"
      })
    ).toThrow("GEMINI_API_KEY is required");
  });

  it("keeps RAG disabled by default", () => {
    const config = readApiRuntimeConfig({
      AUTH_SECRET: validSecret,
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test"
    });

    expect(config.rag).toEqual({ enabled: false });
  });

  it("accepts RAG Gemini configuration without OpenAI keys", () => {
    const config = readApiRuntimeConfig({
      AUTH_SECRET: validSecret,
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test",
      GEMINI_API_KEY: "gemini-test-key",
      RAG_ENABLED: "true",
      RAG_QDRANT_URL: "http://localhost:6333",
      RAG_QDRANT_COLLECTION: "babyloop_rag_test"
    });

    expect(config.rag).toMatchObject({
      enabled: true,
      vectorStore: "qdrant",
      qdrantUrl: "http://localhost:6333",
      qdrantCollection: "babyloop_rag_test",
      qdrantVectorSize: 3072,
      embeddingProvider: "gemini",
      embeddingModel: "gemini-embedding-001",
      chatProvider: "gemini",
      chatModel: "gemini-2.5-flash",
      maxSourcesPerDocument: 2,
      geminiApiKey: "gemini-test-key"
    });
  });

  it("requires a Gemini key when RAG is enabled", () => {
    expect(() =>
      readApiRuntimeConfig({
        AUTH_SECRET: validSecret,
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test",
        RAG_ENABLED: "true"
      })
    ).toThrow("GEMINI_API_KEY is required");
  });

  it("allows moderation summaries to be explicitly unavailable", () => {
    const config = readApiRuntimeConfig({
      AI_MODERATION_SUMMARY_PROVIDER: "unavailable",
      AUTH_SECRET: validSecret,
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test"
    });

    expect(config.aiModerationSummary).toEqual({ provider: "unavailable" });
    expect(createAdminModerationAiSummaryProvider(config.aiModerationSummary).providerName).toBe(
      "unavailable-moderation-summary"
    );
  });

  it("creates Gemini providers for assistant, listing draft, and moderation summary", () => {
    const config = readApiRuntimeConfig({
      AI_LISTING_DRAFT_PROVIDER: "gemini",
      AI_MODERATION_SUMMARY_PROVIDER: "gemini",
      ASSISTANT_PROVIDER: "gemini",
      AUTH_SECRET: validSecret,
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test",
      GEMINI_API_KEY: "gemini-test-key"
    });

    expect(createAssistantMessageProvider(config.assistant)?.providerName).toBe("gemini-generate-content");
    expect(createListingDraftAiProvider(config.aiListingDraft)?.providerName).toBe("gemini-generate-content");
    expect(createAdminModerationAiSummaryProvider(config.aiModerationSummary).providerName).toBe("gemini-generate-content");
  });
});
