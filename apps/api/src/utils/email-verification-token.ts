import { createHash, randomBytes } from "node:crypto";

export const EMAIL_VERIFICATION_TOKEN_TTL_SECONDS = 60 * 60 * 24;

export function createEmailVerificationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashEmailVerificationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createEmailVerificationTokenExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + EMAIL_VERIFICATION_TOKEN_TTL_SECONDS * 1000);
}
