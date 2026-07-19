import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("account user-facing contract", () => {
  it("opens direct login URLs through the shared auth popup", () => {
    const loginRoute = read("src/app/login/page.tsx");

    expect(loginRoute).toContain('auth: "login"');
    expect(loginRoute).toContain("redirect(`/?${params.toString()}`)");
    expect(loginRoute).not.toContain("<AuthPageShell");
  });

  it("keeps security controls in profile and removes security-center links", () => {
    const profile = read("src/features/account/account-profile-page-content.tsx");
    const accountMenu = read("src/components/navigation/public-navigation-model.ts");
    const legacyRoute = read("src/app/account/security/page.tsx");

    expect(profile).toContain("<MfaSettingsPanel");
    expect(profile).toContain("<SessionManagementPanel");
    expect(profile).toContain("<AccountDeletionPanel");
    expect(profile).not.toContain('href="/account/security"');
    expect(accountMenu).not.toContain('{ href: "/account/security"');
    expect(legacyRoute).toContain('redirect("/account/profile?section=security")');
  });

  it("does not expose provider or audit terminology in notification settings", () => {
    const preferences = read(
      "src/features/notification-preferences/notification-preferences-page-content.tsx"
    );

    expect(preferences).toContain("Bildirim ayarları");
    expect(preferences).toContain('role="switch"');
    expect(preferences).not.toMatch(/audit|sağlayıcısı|supportedSources/iu);
    expect(preferences).not.toContain("fetchChildProfiles");
    expect(preferences).not.toContain("fetchSavedSearches");
  });
});
