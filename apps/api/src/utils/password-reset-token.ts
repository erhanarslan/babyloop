import { createHash, randomBytes } from "node:crypto";

export const PASSWORD_RESET_TOKEN_TTL_SECONDS = 60 * 30;

export function createPasswordResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createPasswordResetTokenExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + PASSWORD_RESET_TOKEN_TTL_SECONDS * 1000);
}
