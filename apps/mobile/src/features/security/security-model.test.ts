import {
  buildMobileSensitiveToggleDescription,
  buildMobileSensitiveToggleTitle,
  canSubmitMobileSensitiveTogglePassword,
  getMobileSecurityRows
} from "./security-model";

describe("mobile security model", () => {
  it("shows MFA as active when email OTP is enabled", () => {
    const rows = getMobileSecurityRows({ mfaEnabled: true });

    expect(rows).toEqual([
      {
        title: "Oturum",
        value: "Açık",
        tone: "success",
        badge: "Aktif"
      },
      {
        title: "Şifre",
        value: "Hesap şifresiyle giriş yapıldı",
        tone: "neutral",
        badge: "Bilgi"
      },
      {
        title: "OTP / MFA",
        value: "E-posta OTP doğrulaması aktif",
        tone: "success",
        badge: "Aktif"
      },
      {
        title: "Mobil onay",
        value: "Mobil giriş onayı durumu kontrol ediliyor",
        tone: "neutral",
        badge: "Kontrol"
      }
    ]);
  });

  it("shows MFA as disabled without implying pending implementation", () => {
    const mfaRow = getMobileSecurityRows({ mfaEnabled: false }).find((row) => row.title === "OTP / MFA");

    expect(mfaRow).toEqual({
      title: "OTP / MFA",
      value: "E-posta OTP doğrulaması kapalı",
      tone: "neutral",
      badge: "Kapalı"
    });
  });

  it("shows mobile login approval as checking while status is unknown", () => {
    const mobileApprovalRow = getMobileSecurityRows({ mfaEnabled: false }).find(
      (row) => row.title === "Mobil onay"
    );

    expect(mobileApprovalRow).toEqual({
      title: "Mobil onay",
      value: "Mobil giriş onayı durumu kontrol ediliyor",
      tone: "neutral",
      badge: "Kontrol"
    });
  });

});


describe("mobile sensitive security toggle modal helpers", () => {
  it("builds current password modal copy for email OTP changes", () => {
    expect(buildMobileSensitiveToggleTitle("mfa_email_otp")).toBe("E-posta OTP ayarını değiştir");
    expect(buildMobileSensitiveToggleDescription("mfa_email_otp", true)).toContain("mevcut şifreni gir");
    expect(buildMobileSensitiveToggleDescription("mfa_email_otp", false)).toContain("kapatmak");
  });

  it("builds current password modal copy for mobile approval changes", () => {
    expect(buildMobileSensitiveToggleTitle("mobile_login_approval")).toBe("Mobil onay ayarını değiştir");
    expect(buildMobileSensitiveToggleDescription("mobile_login_approval", true)).toContain("Web girişleri");
    expect(buildMobileSensitiveToggleDescription("mobile_login_approval", false)).toContain("kapatmak");
  });

  it("requires a strong enough current password before submitting sensitive toggles", () => {
    expect(canSubmitMobileSensitiveTogglePassword("")).toBe(false);
    expect(canSubmitMobileSensitiveTogglePassword("short")).toBe(false);
    expect(canSubmitMobileSensitiveTogglePassword("Password123!")).toBe(true);
  });
});
