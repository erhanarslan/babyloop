import { afterEach, describe, expect, it, vi } from "vitest";
import { readApiRuntimeConfig } from "../src/config/env.js";
import {
  exchangeCodeForTokens,
  fetchUserInfo,
  GOOGLE_OAUTH_PROVIDER_TIMEOUT_MS,
  type GoogleOAuthConfig
} from "../src/services/google-oauth.service.js";

const config: GoogleOAuthConfig = {
  clientId: "1234567890-example.apps.googleusercontent.com",
  clientSecret: "safe-test-google-client-secret",
  redirectUri: "https://api.example.test/api/v1/auth/google/callback",
  webAppUrl: "https://example.test"
};

describe("Google OAuth production hardening", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("rejects callback paths other than the exact API OAuth callback", () => {
    expect(() =>
      readApiRuntimeConfig({
        GOOGLE_CLIENT_ID: config.clientId,
        GOOGLE_CLIENT_SECRET: config.clientSecret,
        GOOGLE_REDIRECT_URI: "https://api.example.test/auth/google/callback",
        WEB_APP_URL: config.webAppUrl
      })
    ).toThrow(
      "GOOGLE_REDIRECT_URI must end exactly with /api/v1/auth/google/callback"
    );
  });

  it("requires HTTPS for Google OAuth URLs in production", () => {
    expect(() =>
      readApiRuntimeConfig({
        GEMINI_API_KEY: "gemini-test-key",
        GOOGLE_CLIENT_ID: config.clientId,
        GOOGLE_CLIENT_SECRET: config.clientSecret,
        GOOGLE_REDIRECT_URI: "http://api.example.test/api/v1/auth/google/callback",
        LISTING_IMAGE_AUTHENTICITY_PROVIDER: "gemini",
        NODE_ENV: "production",
        WEB_APP_URL: config.webAppUrl
      })
    ).toThrow("GOOGLE_REDIRECT_URI must use HTTPS in production");
  });

  it("bounds token exchange and requests no-store provider handling", async () => {
    const fetchMock = vi.fn(async (
      _input: string | URL | Request,
      init?: RequestInit
    ) => {
      const headers = new Headers(init?.headers);

      expect(headers.get("cache-control")).toBe("no-store");
      expect(headers.get("pragma")).toBe("no-cache");
      expect(init?.signal).toBeInstanceOf(AbortSignal);

      return new Response(
        JSON.stringify({
          access_token: "google-access-token"
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      exchangeCodeForTokens("authorization-code", config)
    ).resolves.toEqual({
      accessToken: "google-access-token"
    });

    expect(GOOGLE_OAUTH_PROVIDER_TIMEOUT_MS).toBe(10_000);
  });

  it("bounds userinfo fetch and keeps access tokens out of errors", async () => {
    const fetchMock = vi.fn(async (
      _input: string | URL | Request,
      init?: RequestInit
    ) => {
      const headers = new Headers(init?.headers);

      expect(headers.get("cache-control")).toBe("no-store");
      expect(headers.get("pragma")).toBe("no-cache");
      expect(init?.signal).toBeInstanceOf(AbortSignal);

      return new Response("provider unavailable", {
        status: 503
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const accessToken = "must-not-appear-in-error";

    await expect(fetchUserInfo(accessToken)).rejects.toThrow(
      "Google user profile fetch failed."
    );

    try {
      await fetchUserInfo(accessToken);
    } catch (error) {
      expect(String(error)).not.toContain(accessToken);
    }
  });
});
