import { randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { PUBLIC_ACCESS_TOKEN_COOKIE_NAME } from "./public-access-token-cookie.js";

export const PUBLIC_CSRF_COOKIE_NAME = "babyloop_public_csrf_token";
export const PUBLIC_CSRF_HEADER_NAME = "x-babyloop-csrf-token";
export const PUBLIC_CSRF_COOKIE_PATH = "/";
export const PUBLIC_CSRF_MAX_AGE_SECONDS = 8 * 60 * 60;

const SAFE_HTTP_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const PUBLIC_CSRF_PROTECTED_PATHS = [
  "/auth/password/change",
  "/child-profiles",
  "/conversations",
  "/favorites",
  "/listings",
  "/notifications",
  "/profiles",
  "/saved-searches",
  "/seller"
];

const PUBLIC_CSRF_EXEMPT_PATHS = [
  "/auth/backoffice",
  "/auth/csrf",
  "/auth/google",
  "/auth/login",
  "/auth/logout",
  "/auth/mfa/verify",
  "/auth/password-reset",
  "/auth/refresh",
  "/auth/register",
  "/auth/email-verification"
];

export function createPublicCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

export function serializePublicCsrfCookie(token: string): string {
  return [
    `${PUBLIC_CSRF_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "SameSite=Lax",
    `Path=${PUBLIC_CSRF_COOKIE_PATH}`,
    `Max-Age=${PUBLIC_CSRF_MAX_AGE_SECONDS}`,
    ...secureCookieFlag()
  ].join("; ");
}

export function serializeExpiredPublicCsrfCookie(): string {
  return [
    `${PUBLIC_CSRF_COOKIE_NAME}=`,
    "SameSite=Lax",
    `Path=${PUBLIC_CSRF_COOKIE_PATH}`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ...secureCookieFlag()
  ].join("; ");
}

export function readPublicCsrfCookie(cookieHeader: string | string[] | undefined): string | null {
  return readCookieValue(cookieHeader, PUBLIC_CSRF_COOKIE_NAME);
}

export function shouldEnforcePublicCsrf(
  request: FastifyRequest,
  options: { apiPrefix: string }
): boolean {
  if (SAFE_HTTP_METHODS.has(request.method.toUpperCase())) {
    return false;
  }

  if (!readCookieValue(request.headers.cookie, PUBLIC_ACCESS_TOKEN_COOKIE_NAME)) {
    return false;
  }

  const path = request.url.split("?")[0] ?? request.url;

  if (!path.startsWith(options.apiPrefix)) {
    return false;
  }

  const pathWithoutPrefix = path.slice(options.apiPrefix.length);

  if (pathWithoutPrefix.startsWith("/admin/")) {
    return false;
  }

  if (PUBLIC_CSRF_EXEMPT_PATHS.some((exemptPath) => pathWithoutPrefix.startsWith(exemptPath))) {
    return false;
  }

  return PUBLIC_CSRF_PROTECTED_PATHS.some((protectedPath) =>
    pathWithoutPrefix === protectedPath || pathWithoutPrefix.startsWith(`${protectedPath}/`)
  );
}

export function isPublicCsrfRequestValid(request: FastifyRequest): boolean {
  const cookieToken = readPublicCsrfCookie(request.headers.cookie);
  const headerToken = readCsrfHeader(request.headers[PUBLIC_CSRF_HEADER_NAME]);

  if (!cookieToken || !headerToken) {
    return false;
  }

  return timingSafeTokenEqual(cookieToken, headerToken);
}

function readCookieValue(cookieHeader: string | string[] | undefined, cookieName: string): string | null {
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

function readCsrfHeader(headerValue: string | string[] | undefined): string | null {
  if (Array.isArray(headerValue)) {
    return headerValue[0] ?? null;
  }

  return headerValue ?? null;
}

function timingSafeTokenEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function secureCookieFlag(): string[] {
  return process.env.NODE_ENV === "production" ? ["Secure"] : [];
}
