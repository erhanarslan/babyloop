export type MobileSecurityRowTone = "neutral" | "success" | "pending";

export type MobileSecurityRow = {
  title: string;
  value: string;
  tone: MobileSecurityRowTone;
  badge: string;
};

export type MobileSecuritySettings = {
  mfaEnabled?: boolean | null;
};

export function getMobileSecurityRows(settings: MobileSecuritySettings = {}): MobileSecurityRow[] {
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
    buildMfaRow(settings.mfaEnabled ?? null),
    {
      title: "Mobil onay",
      value: "Cihaz onayı ve push güvenlik bildirimi ayrı P1 paketinde tamamlanacak",
      tone: "pending",
      badge: "P1"
    }
  ];
}

function buildMfaRow(mfaEnabled: boolean | null): MobileSecurityRow {
  if (mfaEnabled === true) {
    return {
      title: "OTP / MFA",
      value: "E-posta OTP doğrulaması aktif",
      tone: "success",
      badge: "Aktif"
    };
  }

  if (mfaEnabled === false) {
    return {
      title: "OTP / MFA",
      value: "E-posta OTP doğrulaması kapalı",
      tone: "neutral",
      badge: "Kapalı"
    };
  }

  return {
    title: "OTP / MFA",
    value: "Hesap MFA durumu kontrol ediliyor",
    tone: "neutral",
    badge: "Kontrol"
  };
}
