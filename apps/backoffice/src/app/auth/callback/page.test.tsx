import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/auth/callback/page.tsx"), "utf8");

describe("backoffice Google callback page contract", () => {
  it("verifies the cookie session through me before navigating to safe next", () => {
    expect(source).toContain("fetchBackofficeMe(getApiBaseUrl())");
    expect(source).toContain("resolveSafeBackofficeNextPath");
    expect(source).toContain('params.get("status") !== "success"');
    expect(source).toContain("session_establishment_failed");
  });

  it("does not read or persist OAuth token material", () => {
    expect(source).not.toMatch(/localStorage|sessionStorage|accessToken|refreshToken|authorizationCode/);
  });
});
