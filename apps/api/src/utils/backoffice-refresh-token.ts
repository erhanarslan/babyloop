import { REFRESH_TOKEN_TTL_SECONDS } from "./refresh-token.js";

export const BACKOFFICE_REFRESH_TOKEN_COOKIE_NAME = "babyloop_backoffice_refresh_token";
export const BACKOFFICE_REFRESH_TOKEN_COOKIE_PATH = "/api/v1/auth/backoffice";

type BackofficeRefreshCookieOptions = {
  expiresAt: Date;
};

export function readBackofficeRefreshTokenCookie(
  cookieHeader: string | string[] | undefined
): string | null {
  const cookieSource = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader;

  if (!cookieSource) return null;

  for (const cookiePart of cookieSource.split(";")) {
    const [rawName, ...rawValueParts] = cookiePart.trim().split("=");
    if (rawName !== BACKOFFICE_REFRESH_TOKEN_COOKIE_NAME) continue;

    const rawValue = rawValueParts.join("=");
    if (!rawValue) return null;

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return null;
    }
  }

  return null;
}

export function serializeBackofficeRefreshTokenCookie(
  refreshToken: string,
  options: BackofficeRefreshCookieOptions
): string {
  return [
    `${BACKOFFICE_REFRESH_TOKEN_COOKIE_NAME}=${encodeURIComponent(refreshToken)}`,
    "HttpOnly",
    "SameSite=Lax",
    `Path=${BACKOFFICE_REFRESH_TOKEN_COOKIE_PATH}`,
    `Max-Age=${REFRESH_TOKEN_TTL_SECONDS}`,
    `Expires=${options.expiresAt.toUTCString()}`,
    ...secureCookieFlag()
  ].join("; ");
}

export function serializeExpiredBackofficeRefreshTokenCookie(): string {
  return [
    `${BACKOFFICE_REFRESH_TOKEN_COOKIE_NAME}=`,
    "HttpOnly",
    "SameSite=Lax",
    `Path=${BACKOFFICE_REFRESH_TOKEN_COOKIE_PATH}`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ...secureCookieFlag()
  ].join("; ");
}

function secureCookieFlag(): string[] {
  return process.env.NODE_ENV === "production" ? ["Secure"] : [];
}
