import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/lib/auth-client.ts"), "utf8");

describe("web auth client runtime guards", () => {
  it("dedupes refresh and current-user requests with shared in-flight promises", () => {
    expect(source).toContain("let refreshSessionPromise");
    expect(source).toContain("let fetchCurrentUserWithoutRefreshPromise");
    expect(source).toContain("refreshSessionPromise = refreshPromise.finally");
    expect(source).toContain("fetchCurrentUserWithoutRefreshPromise = fetchCurrentUserWithoutRefreshOnce");
  });

  it("separates network unavailable from real session rejection", () => {
    expect(source).toContain("apiUnavailableResponse");
    expect(source).toContain("isSessionRejectionStatus");
    expect(source).toContain("status === 401 || status === 403");
    expect(source).toContain("lastRefreshFailureAt = Date.now()");
  });

  it("prevents stale refresh from reopening a manual logout session", () => {
    expect(source).toContain("manuallyLoggedOut");
    expect(source).toContain("markManuallyLoggedOut");
    expect(source).toContain("return unauthorizedResponse()");
  });

  it("uses safe JSON parsing for auth bootstrap responses", () => {
    expect(source).toContain("readApiResponse");
    expect(source).toContain("API_UNAVAILABLE");
    expect(source).not.toContain("console.log");
  });
});
