import { randomBytes } from "node:crypto";

export const GOOGLE_OAUTH_STATE_COOKIE_NAME = "babyloop_google_oauth_state";
export const GOOGLE_OAUTH_STATE_COOKIE_PATH = "/api/v1/auth/google";
export const GOOGLE_OAUTH_STATE_TTL_SECONDS = 60 * 10;

const GOOGLE_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  webAppUrl: string;
};

export type GoogleTokenResponse = {
  accessToken: string;
};

export type GoogleUserInfo = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

export type GoogleOAuthClient = {
  exchangeCodeForTokens(code: string, config: GoogleOAuthConfig): Promise<GoogleTokenResponse>;
  fetchUserInfo(accessToken: string): Promise<GoogleUserInfo>;
};

export const defaultGoogleOAuthClient: GoogleOAuthClient = {
  exchangeCodeForTokens,
  fetchUserInfo
};

export function generateOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export function buildGoogleAuthorizationUrl(
  config: GoogleOAuthConfig,
  state: string
): string {
  const url = new URL(GOOGLE_AUTHORIZATION_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);

  return url.toString();
}

export function isGoogleOAuthConfigured(
  config: GoogleOAuthConfig | undefined
): config is GoogleOAuthConfig {
  return Boolean(config);
}

export async function exchangeCodeForTokens(
  code: string,
  config: GoogleOAuthConfig
): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri
    })
  });

  if (!response.ok) {
    throw new Error("Google token exchange failed.");
  }

  const body = (await response.json()) as { access_token?: unknown };

  if (typeof body.access_token !== "string" || !body.access_token) {
    throw new Error("Google token response is invalid.");
  }

  return {
    accessToken: body.access_token
  };
}

export async function fetchUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error("Google user profile fetch failed.");
  }

  const body = (await response.json()) as GoogleUserInfo;

  if (!body.sub) {
    throw new Error("Google user profile is invalid.");
  }

  return body;
}

export function serializeGoogleOAuthStateCookie(state: string): string {
  const expiresAt = new Date(Date.now() + GOOGLE_OAUTH_STATE_TTL_SECONDS * 1000);

  return [
    `${GOOGLE_OAUTH_STATE_COOKIE_NAME}=${encodeURIComponent(state)}`,
    "HttpOnly",
    "SameSite=Lax",
    `Path=${GOOGLE_OAUTH_STATE_COOKIE_PATH}`,
    `Max-Age=${GOOGLE_OAUTH_STATE_TTL_SECONDS}`,
    `Expires=${expiresAt.toUTCString()}`,
    ...secureCookieFlag()
  ].join("; ");
}

export function serializeExpiredGoogleOAuthStateCookie(): string {
  return [
    `${GOOGLE_OAUTH_STATE_COOKIE_NAME}=`,
    "HttpOnly",
    "SameSite=Lax",
    `Path=${GOOGLE_OAUTH_STATE_COOKIE_PATH}`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ...secureCookieFlag()
  ].join("; ");
}

export function readGoogleOAuthStateCookie(
  cookieHeader: string | string[] | undefined
): string | null {
  return readCookieValue(cookieHeader, GOOGLE_OAUTH_STATE_COOKIE_NAME);
}

export function readCookieValue(
  cookieHeader: string | string[] | undefined,
  cookieName: string
): string | null {
  const cookieSource = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader;

  if (!cookieSource) {
    return null;
  }

  for (const cookiePart of cookieSource.split(";")) {
    const [rawName, ...rawValueParts] = cookiePart.trim().split("=");

    if (!rawName || rawName !== cookieName) {
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


function secureCookieFlag(): string[] {
  return process.env.NODE_ENV === "production" ? ["Secure"] : [];
}
