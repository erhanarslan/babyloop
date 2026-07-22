import { afterEach, describe, expect, it, vi } from "vitest";
import { getLegalOperatorConfig } from "./legal-config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("legal operator configuration", () => {
  it("accepts a non-commercial beta without publishing a residence address", () => {
    vi.stubEnv("NEXT_PUBLIC_LEGAL_OPERATOR_NAME", "Erhan Arslan");
    vi.stubEnv("NEXT_PUBLIC_LEGAL_CONTACT_EMAIL", "legal@babyloop.test");
    vi.stubEnv("NEXT_PUBLIC_LEGAL_RELEASE_MODE", "non_commercial_beta");
    vi.stubEnv("NEXT_PUBLIC_LEGAL_COMMERCIAL_ACTIVITY_ENABLED", "false");
    vi.stubEnv("NEXT_PUBLIC_LEGAL_PUBLIC_LOCATION", "İstanbul, Türkiye");
    vi.stubEnv("NEXT_PUBLIC_LEGAL_CONTACT_ADDRESS", "");

    expect(getLegalOperatorConfig()).toMatchObject({
      address: "İstanbul, Türkiye",
      commercialActivityEnabled: false,
      configured: true,
      operatorName: "Erhan Arslan",
      publicLocation: "İstanbul, Türkiye",
      releaseMode: "non_commercial_beta"
    });
  });

  it("requires a usable address before commercial public mode can be configured", () => {
    vi.stubEnv("NEXT_PUBLIC_LEGAL_OPERATOR_NAME", "Erhan Arslan");
    vi.stubEnv("NEXT_PUBLIC_LEGAL_CONTACT_EMAIL", "legal@babyloop.test");
    vi.stubEnv("NEXT_PUBLIC_LEGAL_RELEASE_MODE", "commercial_public");
    vi.stubEnv("NEXT_PUBLIC_LEGAL_COMMERCIAL_ACTIVITY_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_LEGAL_PUBLIC_LOCATION", "İstanbul, Türkiye");
    vi.stubEnv("NEXT_PUBLIC_LEGAL_CONTACT_ADDRESS", "");

    expect(getLegalOperatorConfig().configured).toBe(false);
  });

  it("accepts commercial public mode only with a usable contact address", () => {
    vi.stubEnv("NEXT_PUBLIC_LEGAL_OPERATOR_NAME", "BabyLoop Teknoloji AŞ");
    vi.stubEnv("NEXT_PUBLIC_LEGAL_CONTACT_EMAIL", "legal@babyloop.test");
    vi.stubEnv("NEXT_PUBLIC_LEGAL_RELEASE_MODE", "commercial_public");
    vi.stubEnv("NEXT_PUBLIC_LEGAL_COMMERCIAL_ACTIVITY_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_LEGAL_PUBLIC_LOCATION", "İstanbul, Türkiye");
    vi.stubEnv("NEXT_PUBLIC_LEGAL_CONTACT_ADDRESS", "Örnek Mahallesi No: 1 Ataşehir İstanbul Türkiye");

    expect(getLegalOperatorConfig()).toMatchObject({
      commercialActivityEnabled: true,
      configured: true,
      releaseMode: "commercial_public"
    });
  });
});
