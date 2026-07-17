import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchBackofficeMe,
  loginBackoffice,
  resetBackofficeAuthClientForTests
} from "./auth-client";

const API_BASE_URL = "http://localhost:4000";

const adminAuth = {
  user: {
    id: "admin-1",
    email: "admin@babyloop.test",
    role: "admin",
    emailVerified: true
  }
};

describe("backoffice auth client bootstrap", () => {
  beforeEach(() => {
    resetBackofficeAuthClientForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetBackofficeAuthClientForTests();
  });

  it("deduplicates concurrent me checks and shared refresh attempts", async () => {
    const calls: string[] = [];

    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request) => {
      calls.push(String(url));

      if (String(url).endsWith("/api/v1/auth/backoffice/me")) {
        return jsonResponse({
          ok: false,
          error: {
            code: "UNAUTHENTICATED",
            message: "Backoffice authentication is required."
          }
        }, 401);
      }

      if (String(url).endsWith("/api/v1/auth/backoffice/refresh")) {
        return jsonResponse({
          ok: false,
          error: {
            code: "UNAUTHENTICATED",
            message: "Backoffice refresh session is required."
          }
        }, 401);
      }

      throw new Error(`Unexpected URL ${String(url)}`);
    }));

    const results = await Promise.all([
      fetchBackofficeMe(API_BASE_URL),
      fetchBackofficeMe(API_BASE_URL),
      fetchBackofficeMe(API_BASE_URL)
    ]);

    expect(results).toEqual([null, null, null]);
    expect(calls.filter((url) => url.endsWith("/api/v1/auth/backoffice/me"))).toHaveLength(1);
    expect(calls.filter((url) => url.endsWith("/api/v1/auth/backoffice/refresh"))).toHaveLength(1);
    expect(calls.some((url) => url.endsWith("/api/v1/auth/backoffice/csrf"))).toBe(false);
  });

  it("caches only real unauthenticated results for a short cooldown", async () => {
    const calls: string[] = [];

    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request) => {
      calls.push(String(url));

      if (String(url).endsWith("/api/v1/auth/backoffice/me")) {
        return jsonResponse({
          ok: false,
          error: {
            code: "UNAUTHENTICATED",
            message: "Backoffice authentication is required."
          }
        }, 401);
      }

      if (String(url).endsWith("/api/v1/auth/backoffice/refresh")) {
        return jsonResponse({
          ok: false,
          error: {
            code: "UNAUTHENTICATED",
            message: "Backoffice refresh session is required."
          }
        }, 401);
      }

      throw new Error(`Unexpected URL ${String(url)}`);
    }));

    await expect(fetchBackofficeMe(API_BASE_URL)).resolves.toBeNull();
    await expect(fetchBackofficeMe(API_BASE_URL)).resolves.toBeNull();

    expect(calls.filter((url) => url.endsWith("/api/v1/auth/backoffice/me"))).toHaveLength(1);
    expect(calls.filter((url) => url.endsWith("/api/v1/auth/backoffice/refresh"))).toHaveLength(1);
  });

  it("does not cache network errors as unauthenticated", async () => {
    const calls: string[] = [];

    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request) => {
      calls.push(String(url));

      if (calls.length === 1) {
        throw new Error("Network failed");
      }

      return jsonResponse({
        ok: true,
        data: adminAuth
      });
    }));

    await expect(fetchBackofficeMe(API_BASE_URL)).rejects.toThrow("Network failed");
    await expect(fetchBackofficeMe(API_BASE_URL)).resolves.toEqual(adminAuth);
    expect(calls.filter((url) => url.endsWith("/api/v1/auth/backoffice/me"))).toHaveLength(2);
  });

  it("clears unauthenticated cooldown after successful login", async () => {
    const calls: string[] = [];

    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request) => {
      const urlString = String(url);
      calls.push(urlString);

      if (urlString.endsWith("/api/v1/auth/backoffice/me") && calls.length < 4) {
        return jsonResponse({
          ok: false,
          error: {
            code: "UNAUTHENTICATED",
            message: "Backoffice authentication is required."
          }
        }, 401);
      }

      if (urlString.endsWith("/api/v1/auth/backoffice/refresh")) {
        return jsonResponse({
          ok: false,
          error: {
            code: "UNAUTHENTICATED",
            message: "Backoffice refresh session is required."
          }
        }, 401);
      }

      if (urlString.endsWith("/api/v1/auth/backoffice/login")) {
        return jsonResponse({
          ok: true,
          data: adminAuth
        });
      }

      if (urlString.endsWith("/api/v1/auth/backoffice/csrf")) {
        return jsonResponse({
          ok: true,
          data: {
            csrfToken: "csrf-after-login"
          }
        });
      }

      if (urlString.endsWith("/api/v1/auth/backoffice/me")) {
        return jsonResponse({
          ok: true,
          data: adminAuth
        });
      }

      throw new Error(`Unexpected URL ${urlString}`);
    }));

    await expect(fetchBackofficeMe(API_BASE_URL)).resolves.toBeNull();

    await expect(loginBackoffice(API_BASE_URL, {
      email: "admin@babyloop.test",
      password: "Password123!"
    })).resolves.toEqual({
      ok: true,
      auth: adminAuth
    });

    await expect(fetchBackofficeMe(API_BASE_URL)).resolves.toEqual(adminAuth);
    expect(calls.filter((url) => url.endsWith("/api/v1/auth/backoffice/csrf"))).toHaveLength(1);
    expect(calls.filter((url) => url.endsWith("/api/v1/auth/backoffice/me"))).toHaveLength(2);
  });
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}
