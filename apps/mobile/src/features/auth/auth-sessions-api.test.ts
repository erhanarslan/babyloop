jest.mock("../../config/api", () => ({
  getApiBaseUrl: () => "https://api.babyloop.test"
}));

jest.mock("./auth-token-storage", () => ({
  clearStoredMobileAuthToken: jest.fn(async () => undefined),
  getStoredMobileAuthToken: jest.fn(async () => null),
  setStoredMobileAuthToken: jest.fn(async () => undefined)
}));

import {
  clearMobileAuthToken,
  fetchMobileAuthSessions,
  revokeAllMobileAuthSessions,
  revokeMobileAuthSession,
  setMobileAuthToken
} from "./auth-api";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

describe("mobile auth session API", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    globalThis.fetch = jest.fn() as unknown as typeof fetch;
    clearMobileAuthToken();
    setMobileAuthToken("mobile-access-token");
  });

  it("lists auth sessions without exposing secret fields", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true,
      data: {
        currentSessionId: "session-current",
        sessions: [
          {
            id: "session-current",
            current: true,
            deviceLabel: "Android cihaz",
            userAgent: "BabyLoopMobile Android",
            ipAddress: null,
            createdAt: "2030-01-01T10:00:00.000Z",
            updatedAt: "2030-01-01T10:10:00.000Z",
            expiresAt: "2030-02-01T10:00:00.000Z"
          }
        ]
      }
    }));

    const result = await fetchMobileAuthSessions();

    expect(result).toMatchObject({
      ok: true,
      data: {
        currentSessionId: "session-current"
      }
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.babyloop.test/api/v1/auth/sessions");

    const headers = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Headers;

    expect(headers.get("authorization")).toBe("Bearer mobile-access-token");
    expect(JSON.stringify(result)).not.toMatch(/refreshToken|refreshTokenHash|passwordHash|accessToken/iu);
  });

  it("revokes one session with CSRF and without returning tokens", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        data: {
          csrfToken: "csrf-token"
        }
      }))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        data: {
          currentSessionRevoked: false,
          revoked: true,
          sessionId: "session-mobile"
        }
      }));

    const result = await revokeMobileAuthSession("session-mobile");

    expect(result).toMatchObject({
      ok: true,
      data: {
        revoked: true,
        sessionId: "session-mobile"
      }
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.babyloop.test/api/v1/auth/csrf");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.babyloop.test/api/v1/auth/sessions/session-mobile/revoke");
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe("POST");

    const headers = (fetchMock.mock.calls[1]?.[1] as RequestInit).headers as Headers;

    expect(headers.get("authorization")).toBe("Bearer mobile-access-token");
    expect(headers.get("x-babyloop-csrf-token")).toBe("csrf-token");
    expect(JSON.stringify(result)).not.toMatch(/refreshToken|refreshTokenHash|passwordHash|accessToken/iu);
  });

  it("revokes all sessions with CSRF and safe response shape", async () => {
    const fetchMock = globalThis.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        data: {
          csrfToken: "csrf-token"
        }
      }))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        data: {
          revokedCount: 2
        }
      }));

    const result = await revokeAllMobileAuthSessions();

    expect(result).toEqual({
      ok: true,
      data: {
        revokedCount: 2
      }
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.babyloop.test/api/v1/auth/csrf");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.babyloop.test/api/v1/auth/sessions/revoke-all");
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe("POST");

    const headers = (fetchMock.mock.calls[1]?.[1] as RequestInit).headers as Headers;

    expect(headers.get("authorization")).toBe("Bearer mobile-access-token");
    expect(headers.get("x-babyloop-csrf-token")).toBe("csrf-token");
    expect(JSON.stringify(result)).not.toMatch(/refreshToken|refreshTokenHash|passwordHash|accessToken/iu);
  });
});
