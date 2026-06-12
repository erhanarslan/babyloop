export const BACKOFFICE_ACCESS_TOKEN_COOKIE_NAME = "babyloop_backoffice_access_token";
export const BACKOFFICE_ACCESS_TOKEN_COOKIE_PATH = "/";

type BackofficeAccessTokenCookieOptions = {
  maxAgeSeconds: number;
};

export function readBackofficeAccessTokenCookie(
  cookieHeader: string | string[] | undefined
): string | null {
  const cookieSource = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader;

  if (!cookieSource) {
    return null;
  }

  for (const cookiePart of cookieSource.split(";")) {
    const [rawName, ...rawValueParts] = cookiePart.trim().split("=");

    if (!rawName || rawName !== BACKOFFICE_ACCESS_TOKEN_COOKIE_NAME) {
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

export function serializeBackofficeAccessTokenCookie(
  accessToken: string,
  options: BackofficeAccessTokenCookieOptions
): string {
  return [
    `${BACKOFFICE_ACCESS_TOKEN_COOKIE_NAME}=${encodeURIComponent(accessToken)}`,
    "HttpOnly",
    "SameSite=Lax",
    `Path=${BACKOFFICE_ACCESS_TOKEN_COOKIE_PATH}`,
    `Max-Age=${options.maxAgeSeconds}`,
    ...secureCookieFlag()
  ].join("; ");
}

export function serializeExpiredBackofficeAccessTokenCookie(): string {
  return [
    `${BACKOFFICE_ACCESS_TOKEN_COOKIE_NAME}=`,
    "HttpOnly",
    "SameSite=Lax",
    `Path=${BACKOFFICE_ACCESS_TOKEN_COOKIE_PATH}`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ...secureCookieFlag()
  ].join("; ");
}

function secureCookieFlag(): string[] {
  return process.env.NODE_ENV === "production" ? ["Secure"] : [];
}
