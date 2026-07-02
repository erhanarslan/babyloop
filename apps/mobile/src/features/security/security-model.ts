export type MobileSecurityRowTone = "neutral" | "success" | "pending";

export type MobileSecurityRow = {
  title: string;
  value: string;
  tone: MobileSecurityRowTone;
  badge: string;
};

export function getMobileSecurityRows(): MobileSecurityRow[] {
  return [
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
  ];
}
