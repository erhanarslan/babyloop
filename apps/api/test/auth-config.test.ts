import { describe, expect, it } from "vitest";
import { readApiRuntimeConfig } from "../src/config/env.js";

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
});
