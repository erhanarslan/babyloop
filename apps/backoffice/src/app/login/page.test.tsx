import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/login/page.tsx"), "utf8");

describe("backoffice login UI contract", () => {
  it("keeps Google before the Turkish password form with accessible bounded navigation", () => {
    expect(source.indexOf("Google ile devam et")).toBeLessThan(source.indexOf("<form"));
    expect(source).toContain('aria-label="Google ile devam et"');
    expect(source).toContain('type="button"');
    expect(source).toContain("googleRedirectInFlightRef.current");
    expect(source).toContain("Google’a yönlendiriliyor…");
    expect(source).toContain("Şifreyle giriş yap");
    expect(source).toContain("loginBackoffice");
  });

  it("does not introduce token storage or provider error echoing", () => {
    expect(source).not.toMatch(/localStorage|sessionStorage|accessToken|refreshToken/);
    expect(source).toContain("resolveBackofficeOAuthErrorMessage");
  });
});
