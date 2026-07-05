export type MobileOtpMfaStep =
  | "not_required"
  | "required"
  | "submitted"
  | "verified"
  | "invalid"
  | "expired"
  | "rate_limited"
  | "network_error"
  | "blocked";

export type MobileOtpMfaChannel = "email" | "sms_deferred" | "authenticator_deferred" | "security_notification";

export type MobileOtpMfaHardeningInput = {
  mfaRequired: boolean;
  codeSubmitted: boolean;
  codeAccepted?: boolean;
  codeExpired?: boolean;
  attemptsRemaining?: number;
  networkAvailable?: boolean;
  userBlocked?: boolean;
};

export type MobileOtpMfaHardeningDecision = {
  step: MobileOtpMfaStep;
  canContinue: boolean;
  canResend: boolean;
  requiresSecureStorage: true;
  requiresRateLimit: true;
  requiresNoSecretLogging: true;
  requiresSessionRefreshAfterVerify: true;
  requiresLogoutCleanup: true;
  piiSafe: true;
  reasonCode:
    | "mfa_not_required"
    | "mfa_required"
    | "mfa_verified"
    | "code_invalid"
    | "code_expired"
    | "rate_limited"
    | "network_unavailable"
    | "user_blocked";
};

export type MobileOtpMfaHardeningPreview = {
  status: "readiness_only";
  runtimeAuthChanged: false;
  otpProviderEnabled: false;
  smsEnabled: false;
  authenticatorEnabled: false;
  emailOtpRequired: true;
  secureStorageRequired: true;
  rateLimitRequired: true;
  noSecretLoggingRequired: true;
  sessionRefreshRequiredAfterVerify: true;
  logoutCleanupRequired: true;
  realDeviceQaRequired: true;
  requiredFlows: string[];
  blockedUntilImplemented: string[];
  warning: string;
};

export function evaluateMobileOtpMfaHardening(input: MobileOtpMfaHardeningInput): MobileOtpMfaHardeningDecision {
  if (input.userBlocked) {
    return decision("blocked", false, false, "user_blocked");
  }

  if (input.networkAvailable === false) {
    return decision("network_error", false, false, "network_unavailable");
  }

  if (!input.mfaRequired) {
    return decision("not_required", true, false, "mfa_not_required");
  }

  if (!input.codeSubmitted) {
    return decision("required", false, true, "mfa_required");
  }

  if (typeof input.attemptsRemaining === "number" && input.attemptsRemaining <= 0) {
    return decision("rate_limited", false, false, "rate_limited");
  }

  if (input.codeExpired) {
    return decision("expired", false, true, "code_expired");
  }

  if (input.codeAccepted) {
    return decision("verified", true, false, "mfa_verified");
  }

  return decision("invalid", false, true, "code_invalid");
}

export function getMobileOtpMfaHardeningPreview(): MobileOtpMfaHardeningPreview {
  return {
    status: "readiness_only",
    runtimeAuthChanged: false,
    otpProviderEnabled: false,
    smsEnabled: false,
    authenticatorEnabled: false,
    emailOtpRequired: true,
    secureStorageRequired: true,
    rateLimitRequired: true,
    noSecretLoggingRequired: true,
    sessionRefreshRequiredAfterVerify: true,
    logoutCleanupRequired: true,
    realDeviceQaRequired: true,
    requiredFlows: [
      "login without MFA",
      "login with MFA required",
      "valid OTP verification",
      "invalid OTP error",
      "expired OTP error",
      "rate-limited OTP error",
      "resend OTP",
      "network failure recovery",
      "session refresh after verify",
      "logout cleanup",
      "protected route return",
      "real Galaxy S22 QA"
    ],
    blockedUntilImplemented: [
      "SMS OTP",
      "authenticator app MFA",
      "push security notification",
      "production OTP provider",
      "mobile runtime auth migration"
    ],
    warning:
      "Mobile OTP/MFA hardening is readiness-only; it does not change runtime auth behavior, enable SMS, enable authenticator MFA, enable push security notification, or expose OTP/token/cookie values."
  };
}

export function assertMobileOtpMfaHardeningReadinessOnly(): {
  runtimeAuthChanged: false;
  otpProviderEnabled: false;
  smsEnabled: false;
  authenticatorEnabled: false;
  secureStorageRequired: true;
  noSecretLoggingRequired: true;
} {
  const preview = getMobileOtpMfaHardeningPreview();

  return {
    runtimeAuthChanged: preview.runtimeAuthChanged,
    otpProviderEnabled: preview.otpProviderEnabled,
    smsEnabled: preview.smsEnabled,
    authenticatorEnabled: preview.authenticatorEnabled,
    secureStorageRequired: preview.secureStorageRequired,
    noSecretLoggingRequired: preview.noSecretLoggingRequired
  };
}

function decision(
  step: MobileOtpMfaStep,
  canContinue: boolean,
  canResend: boolean,
  reasonCode: MobileOtpMfaHardeningDecision["reasonCode"]
): MobileOtpMfaHardeningDecision {
  return {
    step,
    canContinue,
    canResend,
    requiresSecureStorage: true,
    requiresRateLimit: true,
    requiresNoSecretLogging: true,
    requiresSessionRefreshAfterVerify: true,
    requiresLogoutCleanup: true,
    piiSafe: true,
    reasonCode
  };
}
