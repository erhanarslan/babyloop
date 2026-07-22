import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CURRENT_TERMS_VERSION, LEGAL_DOCUMENT_VERSIONS } from "@babyloop/shared";
import { LEGAL_DOCUMENTS, LEGAL_DOCUMENT_SLUGS } from "./legal-documents";

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("legal, KVKK and consent public trust contract", () => {
  it("publishes every versioned legal document and public contact surface", () => {
    expect(Object.keys(LEGAL_DOCUMENTS).sort()).toEqual([...LEGAL_DOCUMENT_SLUGS].sort());
    expect(CURRENT_TERMS_VERSION).toBe(LEGAL_DOCUMENT_VERSIONS.terms);

    for (const document of Object.values(LEGAL_DOCUMENTS)) {
      expect(document.version).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
      expect(document.sections.length).toBeGreaterThanOrEqual(3);
    }

    expect(read("src/app/sitemap.ts")).toContain('"/support/contact"');
    expect(read("src/components/site-footer.tsx")).toContain("Çerez tercihleri");
  });

  it("keeps KVKK notice separate from required terms acceptance", () => {
    const authForm = read("src/features/auth/auth-form.tsx");

    expect(authForm).toContain("Bu bilgilendirme açık rıza talebi değildir.");
    expect(authForm).toContain('name="termsAccepted"');
    expect(authForm).toContain("CURRENT_TERMS_VERSION");
    expect(authForm).toContain("buildAuthPayload(new FormData(event.currentTarget), isRegister, termsAccepted)");
    expect(authForm).toContain("!displayName || !termsAccepted");
    expect(authForm).not.toMatch(/KVKK[^\n]{0,120}(kabul|onay)/iu);
  });

  it("keeps optional analytics off until active consent and erases identifiers on rejection", () => {
    const consent = read("src/features/legal/legal-consent.tsx");
    const analytics = read("src/features/analytics/analytics-provider.tsx");

    expect(consent).toContain('useState<AnalyticsConsent>("unset")');
    expect(consent).toContain('analyticsConsent === "accepted"');
    expect(consent).toContain("İsteğe bağlıları reddet");
    expect(consent).toContain("Analitiğe izin ver");
    expect(analytics).toContain("if (!analyticsEnabled)");
    expect(analytics).toContain("window.localStorage.removeItem(ANONYMOUS_ID_KEY)");
    expect(analytics).toContain("window.sessionStorage.removeItem(SESSION_STATE_KEY)");
  });

  it("blocks production placeholders for the public legal operator identity", () => {
    const config = read("src/features/legal/legal-config.ts");
    const deployment = read("../../scripts/check-deployment-readiness.mjs");

    expect(config).toContain("NEXT_PUBLIC_LEGAL_OPERATOR_NAME");
    expect(config).toContain("NEXT_PUBLIC_LEGAL_CONTACT_EMAIL");
    expect(config).toContain("NEXT_PUBLIC_LEGAL_RELEASE_MODE");
    expect(config).toContain("NEXT_PUBLIC_LEGAL_COMMERCIAL_ACTIVITY_ENABLED");
    expect(config).toContain("NEXT_PUBLIC_LEGAL_PUBLIC_LOCATION");
    expect(config).toContain("NEXT_PUBLIC_LEGAL_CONTACT_ADDRESS");
    expect(deployment).toContain("checkLegalPublicTrustEnv");
    expect(deployment).toContain("EXPO_PUBLIC_WEB_BASE_URL");
  });
});
