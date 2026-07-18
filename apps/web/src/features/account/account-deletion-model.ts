export const ACCOUNT_DELETION_CONFIRMATION = "HESABIMI SİL" as const;

export function normalizeAccountDeletionCode(value: string): string {
  return value.replace(/\D/gu, "").slice(0, 6);
}

export function validateAccountDeletionConfirmation(input: {
  code: string;
  confirmation: string;
}): string | null {
  if (!/^\d{6}$/u.test(input.code)) {
    return "E-postana gönderilen 6 haneli güvenlik kodunu gir.";
  }

  if (input.confirmation !== ACCOUNT_DELETION_CONFIRMATION) {
    return `Onay alanına tam olarak ${ACCOUNT_DELETION_CONFIRMATION} yaz.`;
  }

  return null;
}

export function getAccountDeletionErrorMessage(
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
      return "Bu hesap genel hesap silme akışını kullanamaz.";
    case "PUBLIC_CSRF_TOKEN_REQUIRED":
      return "Güvenli oturum doğrulanamadı. Sayfayı yenileyip tekrar dene.";
    case "API_UNAVAILABLE":
      return "BabyLoop API bağlantısı kurulamadı.";
    default:
      return fallback || "Hesap silme işlemi tamamlanamadı.";
  }
}
