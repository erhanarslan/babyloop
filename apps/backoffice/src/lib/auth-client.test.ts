import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchBackofficeMe,
  buildBackofficeGoogleStartUrl,
  getBackofficeAuthLifecycleStateForTests,
  loginBackoffice,
  resolveBackofficeOAuthErrorMessage,
  resetBackofficeAuthClientForTests
} from "./auth-client";

const API_BASE_URL = "http://localhost:4000";

const adminAuth = {
  accessMode: "staff" as const,
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
    expect(getBackofficeAuthLifecycleStateForTests()).toBe("anonymous");
    expect(calls.filter((url) => url.endsWith("/api/v1/auth/backoffice/me"))).toHaveLength(1);
    expect(calls.filter((url) => url.endsWith("/api/v1/auth/backoffice/refresh"))).toHaveLength(1);
    expect(calls.some((url) => url.endsWith("/api/v1/auth/backoffice/csrf"))).toBe(false);
  });

  it("keeps a refresh 401 in the terminal anonymous state without another request loop", async () => {
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
    expect(getBackofficeAuthLifecycleStateForTests()).toBe("anonymous");

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
    expect(getBackofficeAuthLifecycleStateForTests()).toBe("authenticated");
    expect(calls.filter((url) => url.endsWith("/api/v1/auth/backoffice/me"))).toHaveLength(2);
  });

  it("moves an anonymous client back to authenticated after successful login", async () => {
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

  it("deduplicates the same in-flight backoffice login across remounts", async () => {
    let releaseLogin!: () => void;
    const loginGate = new Promise<void>((resolve) => {
      releaseLogin = resolve;
    });
    const calls: string[] = [];

    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request) => {
      const urlString = String(url);
      calls.push(urlString);

      if (urlString.endsWith("/api/v1/auth/backoffice/login")) {
        await loginGate;
        return jsonResponse({ ok: true, data: adminAuth });
      }

      if (urlString.endsWith("/api/v1/auth/backoffice/csrf")) {
        return jsonResponse({ ok: true, data: { csrfToken: "csrf-after-login" } });
      }

      throw new Error(`Unexpected URL ${urlString}`);
    }));

    const credentials = { email: "admin@babyloop.test", password: "Password123!" };
    const first = loginBackoffice(API_BASE_URL, credentials);
    const remountedDuplicate = loginBackoffice(API_BASE_URL, credentials);
    await vi.waitFor(() => {
      expect(calls.filter((url) => url.endsWith("/api/v1/auth/backoffice/login"))).toHaveLength(1);
    });

    releaseLogin();
    await expect(Promise.all([first, remountedDuplicate])).resolves.toEqual([
      { ok: true, auth: adminAuth },
      { ok: true, auth: adminAuth },
    ]);
    expect(calls.filter((url) => url.endsWith("/api/v1/auth/backoffice/csrf"))).toHaveLength(1);
  });

  it("keeps different concurrent backoffice login payloads and results isolated", async () => {
    const pending = new Map([
      ["first-admin@babyloop.test", deferred<Response>()],
      ["second-admin@babyloop.test", deferred<Response>()],
    ]);
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { email: string };
      return pending.get(body.email)!.promise;
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = loginBackoffice(API_BASE_URL, {
      email: "first-admin@babyloop.test",
      password: "FirstPassword123!",
    });
    const second = loginBackoffice(API_BASE_URL, {
      email: "second-admin@babyloop.test",
      password: "SecondPassword123!",
    });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    pending.get("second-admin@babyloop.test")!.resolve(jsonResponse({
      ok: false,
      error: { code: "SECOND_LOGIN", message: "second login result" },
    }, 403));
    pending.get("first-admin@babyloop.test")!.resolve(jsonResponse({
      ok: false,
      error: { code: "FIRST_LOGIN", message: "first login result" },
    }, 401));

    await expect(Promise.all([first, second])).resolves.toEqual([
      { ok: false, message: "first login result", retryAfterSeconds: null },
      { ok: false, message: "second login result", retryAfterSeconds: null },
    ]);
  });
});

describe("backoffice Google OAuth client contract", () => {
  it("builds the dedicated start endpoint without token material", () => {
    const url = buildBackofficeGoogleStartUrl(API_BASE_URL, "/listings?status=active");
    expect(url).toBe(
      "http://localhost:4000/api/v1/auth/backoffice/google/start?next=%2Flistings%3Fstatus%3Dactive"
    );
    expect(url).not.toMatch(/token|code|state/iu);
  });

  it("maps only allowlisted errors and never echoes an unknown provider value", () => {
    expect(resolveBackofficeOAuthErrorMessage("google_account_not_found")).toContain(
      "BabyLoop’ta kayıtlı değil"
    );
    expect(resolveBackofficeOAuthErrorMessage("raw-secret-provider-error")).toBeNull();
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}
