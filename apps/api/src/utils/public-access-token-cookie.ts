export const PUBLIC_ACCESS_TOKEN_COOKIE_NAME = "babyloop_public_access_token";

const PUBLIC_ACCESS_TOKEN_COOKIE_PATH = "/";

export function readPublicAccessTokenCookie(
  cookieHeader: string | string[] | undefined
): string | null {
  const cookieSource = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader;

  if (!cookieSource) {
    return null;
  }

  for (const cookiePart of cookieSource.split(";")) {
    const [rawName, ...rawValueParts] = cookiePart.trim().split("=");

    if (!rawName || rawName !== PUBLIC_ACCESS_TOKEN_COOKIE_NAME) {
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

export function serializePublicAccessTokenCookie(
  accessToken: string,
  options: { maxAgeSeconds: number }
): string {
  return [
    `${PUBLIC_ACCESS_TOKEN_COOKIE_NAME}=${encodeURIComponent(accessToken)}`,
    `Path=${PUBLIC_ACCESS_TOKEN_COOKIE_PATH}`,
    `Max-Age=${options.maxAgeSeconds}`,
    "HttpOnly",
    "SameSite=Lax",
    ...secureCookieFlag()
  ].join("; ");
}

export function serializeExpiredPublicAccessTokenCookie(): string {
  return [
    `${PUBLIC_ACCESS_TOKEN_COOKIE_NAME}=`,
    `Path=${PUBLIC_ACCESS_TOKEN_COOKIE_PATH}`,
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Lax",
    ...secureCookieFlag()
  ].join("; ");
}

function secureCookieFlag(): string[] {
  return process.env.NODE_ENV === "production" ? ["Secure"] : [];
}
