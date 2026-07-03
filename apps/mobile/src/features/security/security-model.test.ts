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
        value: "Cihaz onayı ve push güvenlik bildirimi ayrı P1 paketinde tamamlanacak",
        tone: "pending",
        badge: "P1"
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

  it("keeps only mobile approval as pending work after OTP/MFA is wired", () => {
    const pendingRows = getMobileSecurityRows({ mfaEnabled: false }).filter((row) => row.tone === "pending");

    expect(pendingRows).toEqual([
      {
        title: "Mobil onay",
        value: "Cihaz onayı ve push güvenlik bildirimi ayrı P1 paketinde tamamlanacak",
        tone: "pending",
        badge: "P1"
      }
    ]);
  });
});
