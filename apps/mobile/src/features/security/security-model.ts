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

export const MOBILE_ACCOUNT_DELETION_CONFIRMATION = "HESABIMI SİL" as const;

export function normalizeMobileAccountDeletionCode(value: string): string {
  return value.replace(/\D/gu, "").slice(0, 6);
}

export function validateMobileAccountDeletionConfirmation(input: {
  code: string;
  confirmation: string;
}): string | null {
  if (!/^\d{6}$/u.test(input.code)) {
    return "E-postana gönderilen 6 haneli güvenlik kodunu gir.";
  }

  if (input.confirmation !== MOBILE_ACCOUNT_DELETION_CONFIRMATION) {
    return `Onay alanına tam olarak ${MOBILE_ACCOUNT_DELETION_CONFIRMATION} yaz.`;
  }

  return null;
}

export function getMobileAccountDeletionErrorMessage(
  code: string,
  fallback: string
): string {
  switch (code) {
    case "CURRENT_PASSWORD_REQUIRED":
      return "Bu hesap için mevcut şifreni girmen gerekiyor.";
    case "INVALID_CURRENT_PASSWORD":
      return "Mevcut şifre doğru değil.";
    case "ACCOUNT_DELETION_CHALLENGE_INVALID":
      return "Güvenlik kodu geçersiz, süresi dolmuş veya daha önce kullanılmış.";
    case "ACCOUNT_DELETION_FORBIDDEN":
      return "Bu hesap mobil hesap silme akışını kullanamaz.";
    case "PUBLIC_CSRF_TOKEN_REQUIRED":
      return "Güvenli oturum doğrulanamadı. Ekranı yenileyip tekrar dene.";
    case "API_UNAVAILABLE":
      return "BabyLoop API bağlantısı kurulamadı.";
    default:
      return fallback || "Hesap silme işlemi tamamlanamadı.";
  }
}
