import { describe, expect, it } from "vitest";
import { readApiRuntimeConfig } from "../src/config/env.js";

const completeGoogleConfig = {
  GOOGLE_CLIENT_ID: "1234567890-example.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "safe-test-client-secret",
  GOOGLE_REDIRECT_URI: "https://api.example.test/api/v1/auth/google/callback",
  WEB_APP_URL: "https://example.test"
};

describe("Google OAuth environment activation", () => {
  it("keeps Google OAuth disabled when WEB_APP_URL is the only related value", () => {
    expect(readApiRuntimeConfig({ WEB_APP_URL: "http://localhost:3000" }).googleOAuth).toBeUndefined();
  });

  it("fails closed when any GOOGLE_* activation value is partial", () => {
    expect(() => readApiRuntimeConfig({
      GOOGLE_CLIENT_ID: completeGoogleConfig.GOOGLE_CLIENT_ID,
      WEB_APP_URL: completeGoogleConfig.WEB_APP_URL
    })).toThrow("Google OAuth configuration is partial. Missing: clientSecret, redirectUri.");
  });

  it("accepts the complete Google OAuth configuration", () => {
    expect(readApiRuntimeConfig(completeGoogleConfig).googleOAuth).toEqual({
      clientId: completeGoogleConfig.GOOGLE_CLIENT_ID,
      clientSecret: completeGoogleConfig.GOOGLE_CLIENT_SECRET,
      redirectUri: completeGoogleConfig.GOOGLE_REDIRECT_URI,
      webAppUrl: completeGoogleConfig.WEB_APP_URL
    });
  });

  it("rejects HTTP OAuth URLs in production", () => {
    expect(() => readApiRuntimeConfig({
      ...completeGoogleConfig,
      GEMINI_API_KEY: "test-gemini-key",
      GOOGLE_REDIRECT_URI: "http://api.example.test/api/v1/auth/google/callback",
      LISTING_IMAGE_AUTHENTICITY_PROVIDER: "gemini",
      NODE_ENV: "production"
    })).toThrow("GOOGLE_REDIRECT_URI must use HTTPS in production.");
  });
});
