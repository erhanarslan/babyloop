import { getMobileSecurityRows } from "./security-model";

describe("mobile security model", () => {
  it("shows the active session row and keeps MFA/mobile approval as pending work", () => {
    expect(getMobileSecurityRows()).toEqual([
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
        value: "Bağlanacak",
        tone: "pending",
        badge: "P1"
      },
      {
        title: "Mobil onay",
        value: "Bağlanacak",
        tone: "pending",
        badge: "P1"
      }
    ]);
  });

  it("does not imply that unfinished security features are already enabled", () => {
    const pendingRows = getMobileSecurityRows().filter((row) => row.tone === "pending");

    expect(pendingRows).toHaveLength(2);
    expect(pendingRows.every((row) => row.value === "Bağlanacak")).toBe(true);
    expect(pendingRows.every((row) => row.badge === "P1")).toBe(true);
  });
});
