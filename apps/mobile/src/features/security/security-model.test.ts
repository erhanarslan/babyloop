import { getMobileSecurityRows } from "./security-model";

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
