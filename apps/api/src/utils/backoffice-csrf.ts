import { randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { BACKOFFICE_ACCESS_TOKEN_COOKIE_NAME } from "./backoffice-access-token-cookie.js";

export const BACKOFFICE_CSRF_COOKIE_NAME = "babyloop_backoffice_csrf_token";
export const BACKOFFICE_CSRF_HEADER_NAME = "x-babyloop-csrf-token";
export const BACKOFFICE_CSRF_COOKIE_PATH = "/";
export const BACKOFFICE_CSRF_MAX_AGE_SECONDS = 8 * 60 * 60;

const SAFE_HTTP_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function createBackofficeCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

export function serializeBackofficeCsrfCookie(token: string): string {
  return [
    `${BACKOFFICE_CSRF_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "SameSite=Lax",
    `Path=${BACKOFFICE_CSRF_COOKIE_PATH}`,
    `Max-Age=${BACKOFFICE_CSRF_MAX_AGE_SECONDS}`,
    ...secureCookieFlag()
  ].join("; ");
}

export function serializeExpiredBackofficeCsrfCookie(): string {
  return [
    `${BACKOFFICE_CSRF_COOKIE_NAME}=`,
    "SameSite=Lax",
    `Path=${BACKOFFICE_CSRF_COOKIE_PATH}`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ...secureCookieFlag()
  ].join("; ");
}

export function readBackofficeCsrfCookie(cookieHeader: string | string[] | undefined): string | null {
  return readCookieValue(cookieHeader, BACKOFFICE_CSRF_COOKIE_NAME);
}

export function shouldEnforceBackofficeCsrf(
  request: FastifyRequest,
  options: { apiPrefix: string }
): boolean {
  if (SAFE_HTTP_METHODS.has(request.method.toUpperCase())) {
    return false;
  }

  if (request.headers.authorization) {
    return false;
  }

  if (!readCookieValue(request.headers.cookie, BACKOFFICE_ACCESS_TOKEN_COOKIE_NAME)) {
    return false;
  }

  const path = request.url.split("?")[0] ?? request.url;

  return (
    path.startsWith(`${options.apiPrefix}/admin/`) ||
    path === `${options.apiPrefix}/auth/backoffice/logout`
  );
}

export function isBackofficeCsrfRequestValid(request: FastifyRequest): boolean {
  const cookieToken = readBackofficeCsrfCookie(request.headers.cookie);
  const headerToken = readCsrfHeader(request.headers[BACKOFFICE_CSRF_HEADER_NAME]);

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
