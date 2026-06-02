import { createHash, randomBytes } from "node:crypto";

export const REFRESH_TOKEN_COOKIE_NAME = "babyloop_refresh_token";
export const REFRESH_TOKEN_COOKIE_PATH = "/api/v1/auth";
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

type RefreshCookieOptions = {
  expiresAt: Date;
};

export function createRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashRefreshToken(refreshToken: string): string {
  return createHash("sha256").update(refreshToken, "utf8").digest("hex");
}

export function createRefreshTokenExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000);
}

export function readRefreshTokenCookie(cookieHeader: string | string[] | undefined): string | null {
  const cookieSource = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader;

  if (!cookieSource) {
    return null;
  }

  for (const cookiePart of cookieSource.split(";")) {
    const [rawName, ...rawValueParts] = cookiePart.trim().split("=");

    if (!rawName || rawName !== REFRESH_TOKEN_COOKIE_NAME) {
      continue;
    }

    const rawValue = rawValueParts.join("=");

    if (!rawValue) {
      return null;
    }

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return null;
    }
  }

  return null;
}

export function serializeRefreshTokenCookie(
  refreshToken: string,
  options: RefreshCookieOptions
): string {
  return [
    `${REFRESH_TOKEN_COOKIE_NAME}=${encodeURIComponent(refreshToken)}`,
    "HttpOnly",
    "SameSite=Lax",
    `Path=${REFRESH_TOKEN_COOKIE_PATH}`,
    `Max-Age=${REFRESH_TOKEN_TTL_SECONDS}`,
    `Expires=${options.expiresAt.toUTCString()}`
  ].join("; ");
}

export function serializeExpiredRefreshTokenCookie(): string {
  return [
    `${REFRESH_TOKEN_COOKIE_NAME}=`,
    "HttpOnly",
    "SameSite=Lax",
    `Path=${REFRESH_TOKEN_COOKIE_PATH}`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT"
  ].join("; ");
}
