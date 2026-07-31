import { CURRENT_TERMS_VERSION } from "@babyloop/shared";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const GOOGLE_OAUTH_STATE_COOKIE_NAME = "babyloop_google_oauth_state";
export const GOOGLE_OAUTH_TERMS_COOKIE_NAME = "babyloop_google_oauth_terms";
export const GOOGLE_OAUTH_STATE_COOKIE_PATH = "/api/v1/auth/google";
export const GOOGLE_OAUTH_STATE_TTL_SECONDS = 60 * 10;
export const GOOGLE_OAUTH_PROVIDER_TIMEOUT_MS = 10_000;

const GOOGLE_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  webAppUrl: string;
};

export type GoogleOAuthAudience = "public_web" | "backoffice";

export type GoogleOAuthState = {
  audience: GoogleOAuthAudience;
  issuedAt: number;
  next: string | null;
  nonce: string;
};

type CreateGoogleOAuthStateOptions = {
  audience: GoogleOAuthAudience;
  authSecret: string;
  next?: string | null;
  now?: Date;
};

const consumedOAuthStateDigests = new Map<string, number>();

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


export type GoogleOAuthTermsAcceptance = {
  state: string;
  termsVersion: string;
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

export function createGoogleOAuthState(options: CreateGoogleOAuthStateOptions): string {
  const payload: GoogleOAuthState = {
    audience: options.audience,
    issuedAt: Math.floor((options.now ?? new Date()).getTime() / 1000),
    next: options.audience === "backoffice"
      ? resolveSafeBackofficeOAuthNext(options.next)
      : null,
    nonce: generateOAuthState()
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signOAuthState(encodedPayload, options.authSecret);
  return `${encodedPayload}.${signature}`;
}

export function verifyGoogleOAuthState(
  state: string,
  authSecret: string,
  options: { now?: Date; consume?: boolean; allowConsumed?: boolean } = {}
): GoogleOAuthState | null {
  const [encodedPayload, signature, ...extra] = state.split(".");
  if (!encodedPayload || !signature || extra.length > 0) return null;

  const expectedSignature = signOAuthState(encodedPayload, authSecret);
  const actualBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!isGoogleOAuthState(payload)) return null;

  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000);
  if (
    payload.issuedAt > nowSeconds + 30 ||
    nowSeconds - payload.issuedAt > GOOGLE_OAUTH_STATE_TTL_SECONDS
  ) {
    return null;
  }

  cleanupConsumedOAuthStates(nowSeconds);
  const digest = createHash("sha256").update(state, "utf8").digest("hex");
  if (consumedOAuthStateDigests.has(digest) && !options.allowConsumed) return null;
  if (options.consume) {
    consumedOAuthStateDigests.set(digest, payload.issuedAt + GOOGLE_OAUTH_STATE_TTL_SECONDS);
  }

  return payload;
}

export function resolveSafeBackofficeOAuthNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/";
  }

  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\")) {
      return "/";
    }

    const parsed = new URL(decoded, "https://admin.babyloop.invalid");
    if (parsed.origin !== "https://admin.babyloop.invalid") return "/";
    if (parsed.pathname === "/login" || parsed.pathname === "/auth/callback") return "/";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

export function resetGoogleOAuthReplayGuardForTests(): void {
  consumedOAuthStateDigests.clear();
}

function signOAuthState(encodedPayload: string, authSecret: string): string {
  return createHmac("sha256", authSecret).update(encodedPayload, "utf8").digest("base64url");
}

function isGoogleOAuthState(value: unknown): value is GoogleOAuthState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GoogleOAuthState>;
  return (
    (candidate.audience === "public_web" || candidate.audience === "backoffice") &&
    Number.isInteger(candidate.issuedAt) &&
    typeof candidate.nonce === "string" && candidate.nonce.length >= 32 &&
    (candidate.next === null || typeof candidate.next === "string")
  );
}

function cleanupConsumedOAuthStates(nowSeconds: number): void {
  for (const [digest, expiresAt] of consumedOAuthStateDigests) {
    if (expiresAt < nowSeconds) consumedOAuthStateDigests.delete(digest);
  }
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
      "cache-control": "no-store",
      "content-type": "application/x-www-form-urlencoded",
      pragma: "no-cache"
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri
    }),
    signal: AbortSignal.timeout(GOOGLE_OAUTH_PROVIDER_TIMEOUT_MS)
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
      accept: "application/json",
      authorization: `Bearer ${accessToken}`,
      "cache-control": "no-store",
      pragma: "no-cache"
    },
    signal: AbortSignal.timeout(GOOGLE_OAUTH_PROVIDER_TIMEOUT_MS)
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

export function serializeGoogleOAuthTermsCookie(state: string, termsVersion: string): string {
  if (termsVersion !== CURRENT_TERMS_VERSION) {
    throw new Error("Unsupported Google OAuth terms version.");
  }

  const expiresAt = new Date(Date.now() + GOOGLE_OAUTH_STATE_TTL_SECONDS * 1000);
  const value = `${state}.${termsVersion}`;

  return [
    `${GOOGLE_OAUTH_TERMS_COOKIE_NAME}=${encodeURIComponent(value)}`,
    "HttpOnly",
    "SameSite=Lax",
    `Path=${GOOGLE_OAUTH_STATE_COOKIE_PATH}`,
    `Max-Age=${GOOGLE_OAUTH_STATE_TTL_SECONDS}`,
    `Expires=${expiresAt.toUTCString()}`,
    ...secureCookieFlag()
  ].join("; ");
}

export function serializeExpiredGoogleOAuthTermsCookie(): string {
  return [
    `${GOOGLE_OAUTH_TERMS_COOKIE_NAME}=`,
    "HttpOnly",
    "SameSite=Lax",
    `Path=${GOOGLE_OAUTH_STATE_COOKIE_PATH}`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ...secureCookieFlag()
  ].join("; ");
}

export function readGoogleOAuthTermsCookie(
  cookieHeader: string | string[] | undefined,
  expectedState: string
): GoogleOAuthTermsAcceptance | null {
  const raw = readCookieValue(cookieHeader, GOOGLE_OAUTH_TERMS_COOKIE_NAME);

  if (!raw) {
    return null;
  }

  const separatorIndex = raw.lastIndexOf(".");

  if (separatorIndex < 1) {
    return null;
  }

  const state = raw.slice(0, separatorIndex);
  const termsVersion = raw.slice(separatorIndex + 1);

  if (state !== expectedState || termsVersion !== CURRENT_TERMS_VERSION) {
    return null;
  }

  return { state, termsVersion };
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
