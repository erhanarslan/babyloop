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
});
