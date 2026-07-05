import type { MobileMfaChallenge } from "./auth-api";

export type MobileLoginScreenMode = "credentials" | "mfa";

export type MobileLoginScreenState = {
  status: string;
  mfaChallenge: MobileMfaChallenge | null;
};

export type MobileLoginScreenCopy = {
  title: string;
  subtitle: string;
  helperText: string;
};

export function getMobileLoginScreenMode(state: MobileLoginScreenState): MobileLoginScreenMode {
  return state.status === "mfa_required" && state.mfaChallenge ? "mfa" : "credentials";
}

export function sanitizeMobileOtpInput(value: string): string {
  return value.replace(/\D/gu, "").slice(0, 6);
}

export function canSubmitMobileOtpCode(code: string): boolean {
  return /^\d{6}$/u.test(code);
}

export function getMobileLoginScreenCopy(mode: MobileLoginScreenMode): MobileLoginScreenCopy {
  if (mode === "mfa") {
    return {
      title: "OTP doğrulaması",
      subtitle: "Hesabın için e-posta OTP doğrulaması gerekiyor.",
      helperText: "OTP kodu kısa süre geçerlidir. Kod hatalıysa yeniden giriş deneyerek yeni kod isteyebilirsin."
    };
  }

  return {
    title: "Hesabına giriş yap",
    subtitle: "Favoriler, mesajlar ve ilan yönetimi için BabyLoop hesabını kullan.",
    helperText: "Oturum tokenı cihazda SecureStore ile saklanır; düz AsyncStorage kullanılmaz."
  };
}

export function getMobileMfaCancelReset(): { otpCode: ""; nextStatus: "guest" } {
  return {
    otpCode: "",
    nextStatus: "guest"
  };
}
