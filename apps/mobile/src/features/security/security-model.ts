export type MobileSecurityRowTone = "neutral" | "success" | "pending";

export type MobileSecurityRow = {
  title: string;
  value: string;
  tone: MobileSecurityRowTone;
  badge?: string;
};

export type MobileSecuritySettings = {
  mfaEnabled?: boolean | null;
  mobileLoginApprovalEnabled?: boolean | null;
};

export function getMobileSecurityRows(settings: MobileSecuritySettings = {}): MobileSecurityRow[] {
  return [
    {
      title: "Şifre",
      value: "Hesap şifresiyle giriş yapıldı",
      tone: "neutral"
    },
    buildMfaRow(settings.mfaEnabled ?? null),
    buildMobileLoginApprovalRow(settings.mobileLoginApprovalEnabled ?? null)
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


function buildMobileLoginApprovalRow(enabled: boolean | null): MobileSecurityRow {
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


export type MobileSensitiveSecurityToggleTarget = "mfa_email_otp" | "mobile_login_approval";

export type MobileSensitiveSecurityToggleState = {
  target: MobileSensitiveSecurityToggleTarget;
  nextEnabled: boolean;
};

export function buildMobileSensitiveToggleTitle(target: MobileSensitiveSecurityToggleTarget): string {
  switch (target) {
    case "mfa_email_otp":
      return "E-posta OTP ayarını değiştir";
    case "mobile_login_approval":
      return "Mobil onay ayarını değiştir";
  }
}

export function buildMobileSensitiveToggleDescription(
  target: MobileSensitiveSecurityToggleTarget,
  nextEnabled: boolean
): string {
  const action = nextEnabled ? "açmak" : "kapatmak";

  switch (target) {
    case "mfa_email_otp":
      return `E-posta OTP doğrulamasını ${action} için mevcut şifreni gir.`;
    case "mobile_login_approval":
      return `Web girişleri için mobil onayı ${action} için mevcut şifreni gir.`;
  }
}

export function canSubmitMobileSensitiveTogglePassword(password: string): boolean {
  return password.trim().length >= 8;
}

export type MobilePasswordChangeForm = {
  confirmPassword: string;
  currentPassword: string;
  newPassword: string;
};

export function validateMobilePasswordChangeForm(form: MobilePasswordChangeForm): string | null {
  if (!canSubmitMobileSensitiveTogglePassword(form.currentPassword)) {
    return "Mevcut şifren en az 8 karakter olmalı.";
  }

  if (form.newPassword.trim().length < 8) {
    return "Yeni şifre en az 8 karakter olmalı.";
  }

  if (form.newPassword !== form.confirmPassword) {
    return "Yeni şifreler eşleşmiyor.";
  }

  return null;
}
