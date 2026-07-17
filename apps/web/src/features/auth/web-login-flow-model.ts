import type { AuthPayload } from "../../lib/auth-client";
import type {
  AuthSubmitPayload,
  LoginApprovalRequiredPayload,
  MfaRequiredPayload
} from "./api";

export type WebLoginFlowStage =
  | { type: "credentials" }
  | { challengeId: string; type: "mfa" }
  | { approval: LoginApprovalRequiredPayload; type: "mobile_approval" }
  | { auth: AuthPayload; type: "authenticated" }
  | { message: string; type: "error" };

export function normalizeWebOtpCode(value: string): string {
  return value.replace(/\D/gu, "").slice(0, 6);
}

export function canSubmitWebOtpCode(value: string): boolean {
  return /^\d{6}$/u.test(value);
}

export function transitionWebLoginFlowFromSubmit(
  payload: AuthSubmitPayload,
  options: { isRegister: boolean }
): WebLoginFlowStage {
  if (isMfaRequiredPayload(payload)) {
    return options.isRegister
      ? {
          type: "error",
          message: "Kayıt sırasında OTP doğrulaması beklenmiyordu. Lütfen tekrar deneyin."
        }
      : {
          type: "mfa",
          challengeId: payload.challengeId
        };
  }

  if (isLoginApprovalRequiredPayload(payload)) {
    return options.isRegister
      ? {
          type: "error",
          message: "Kayıt sırasında mobil onay beklenmiyordu. Lütfen tekrar deneyin."
        }
      : {
          type: "mobile_approval",
          approval: payload
        };
  }

  return {
    type: "authenticated",
    auth: payload
  };
}

export function transitionWebLoginFlowFromMfaVerify(
  payload: AuthPayload | LoginApprovalRequiredPayload
): WebLoginFlowStage {
  if (isLoginApprovalRequiredPayload(payload)) {
    return {
      type: "mobile_approval",
      approval: payload
    };
  }

  return {
    type: "authenticated",
    auth: payload
  };
}

export function isMfaRequiredPayload(value: AuthSubmitPayload): value is MfaRequiredPayload {
  return "mfaRequired" in value && value.mfaRequired === true;
}

export function isLoginApprovalRequiredPayload(
  value: AuthSubmitPayload | AuthPayload | LoginApprovalRequiredPayload
): value is LoginApprovalRequiredPayload {
  return "loginApprovalRequired" in value && value.loginApprovalRequired === true;
}
