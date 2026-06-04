import { createHash, randomInt } from "node:crypto";

export const MFA_OTP_TTL_SECONDS = 60 * 10;

export function createMfaOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashMfaOtpCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export function createMfaOtpExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + MFA_OTP_TTL_SECONDS * 1000);
}
