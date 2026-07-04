export type MobileSecurityRowTone = "neutral" | "success" | "pending";

export type MobileSecurityRow = {
  title: string;
  value: string;
  tone: MobileSecurityRowTone;
  badge: string;
};

export type MobileSecuritySettings = {
  mfaEnabled?: boolean | null;
  mobileLoginApprovalEnabled?: boolean | null;
  pendingLoginApprovalCount?: number;
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
    buildMobileLoginApprovalRow(
      settings.mobileLoginApprovalEnabled ?? null,
      settings.pendingLoginApprovalCount ?? 0
    )
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


function buildMobileLoginApprovalRow(
  enabled: boolean | null,
  pendingCount: number
): MobileSecurityRow {
  if (enabled === true && pendingCount > 0) {
    return {
      title: "Mobil onay",
      value: `${pendingCount} giriş isteği uygulamadan onay bekliyor`,
      tone: "pending",
      badge: "Onay"
    };
  }

  if (enabled === true) {
    return {
      title: "Mobil onay",
      value: "Yeni cihaz girişleri uygulama içinden onaylanabilir",
      tone: "success",
      badge: "Aktif"
    };
  }

  if (enabled === false) {
    return {
      title: "Mobil onay",
      value: "Mobil giriş onayı kapalı",
      tone: "neutral",
      badge: "Kapalı"
    };
  }

  return {
    title: "Mobil onay",
    value: "Mobil giriş onayı durumu kontrol ediliyor",
    tone: "neutral",
    badge: "Kontrol"
  };
}
