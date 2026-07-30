import { describe, expect, it } from "vitest";

import { resolveTrustedClientIp } from "../src/utils/trusted-client-ip.js";
import { buildAuthRateLimitKey } from "../src/utils/auth-rate-limit.js";

describe("resolveTrustedClientIp", () => {
  it("ignores forwarded headers outside a declared Cloud Run environment", () => {
    expect(resolveTrustedClientIp({
      headers: { "x-forwarded-for": "203.0.113.10, 198.51.100.20" },
      ip: "127.0.0.1",
    }, {})).toBe("127.0.0.1");
  });

  it("uses the Cloud Run client hop without trusting prepended spoof values", () => {
    expect(resolveTrustedClientIp({
      headers: { "x-forwarded-for": "192.0.2.99, 203.0.113.10, 198.51.100.20" },
      ip: "169.254.1.1",
    }, { DEPLOY_ENVIRONMENT: "production" })).toBe("203.0.113.10");
  });

  it("fails closed to the socket address for malformed chains", () => {
    expect(resolveTrustedClientIp({
      headers: { "x-forwarded-for": "spoofed" },
      ip: "169.254.1.1",
    }, { DEPLOY_ENVIRONMENT: "production" })).toBe("169.254.1.1");
  });
});

describe("buildAuthRateLimitKey", () => {
  it("normalizes and hashes identity without exposing the raw email", () => {
    const first = buildAuthRateLimitKey({
      authSecret: "test-auth-secret",
      body: { email: " Parent@Example.Test " },
      clientIp: "203.0.113.10",
      endpoint: "/api/v1/auth/login",
    });
    const normalized = buildAuthRateLimitKey({
      authSecret: "test-auth-secret",
      body: { email: "parent@example.test" },
      clientIp: "203.0.113.10",
      endpoint: "/api/v1/auth/login",
    });

    expect(first).toBe(normalized);
    expect(first).not.toContain("parent@example.test");
  });

  it("keeps endpoint buckets separate", () => {
    const common = {
      authSecret: "test-auth-secret",
      body: { email: "parent@example.test" },
      clientIp: "203.0.113.10",
    };

    expect(buildAuthRateLimitKey({ ...common, endpoint: "/api/v1/auth/login" }))
      .not.toBe(buildAuthRateLimitKey({ ...common, endpoint: "/api/v1/auth/register" }));
  });
});
