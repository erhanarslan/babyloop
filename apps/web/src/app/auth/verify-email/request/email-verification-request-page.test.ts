import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(
  join(process.cwd(), "src/app/auth/verify-email/request/page.tsx"),
  "utf8"
);
const content = readFileSync(
  join(process.cwd(), "src/features/auth/email-verification-request-page-content.tsx"),
  "utf8"
);

describe("email verification request page", () => {
  it("uses one focused verification surface without duplicated auth guidance", () => {
    expect(page).toContain("EmailVerificationRequestPageContent");
    expect(content).toContain("email-verification-request-card");
    expect(content).toContain("requestVerifyTitle");
    expect(content).toContain("RequestEmailVerificationForm");
    expect(page).not.toContain("AuthSurfaceGuide");
    expect(page).not.toContain("AuthPageShell");
    expect(page).not.toContain("AuthLinkNote");
  });

  it("does not show an irrelevant login action to an already signed-in visitor", () => {
    expect(content).not.toContain('href="/login"');
    expect(content).not.toContain("Giriş yap");
  });
});
