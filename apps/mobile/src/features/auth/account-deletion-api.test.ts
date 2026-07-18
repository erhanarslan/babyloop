import {
  clearMobileAuthToken,
  confirmMobileAccountDeletion,
  getMobileAuthToken,
  requestMobileAccountDeletion,
  setMobileAuthToken
} from "./auth-api";

jest.mock("../../config/api", () => ({
  getApiBaseUrl: () => "https://api.babyloop.test"
}));

jest.mock("./auth-token-storage", () => ({
  clearStoredMobileAuthToken: jest.fn().mockResolvedValue(undefined),
  getStoredMobileAuthToken: jest.fn().mockResolvedValue(null),
  setStoredMobileAuthToken: jest.fn().mockResolvedValue(undefined)
}));

function mockApiResponse(status: number, body: unknown): Response {
  return {
    json: jest.fn().mockResolvedValue(body),
    ok: status >= 200 && status < 300,
    status
  } as unknown as Response;
}

describe("mobile account deletion API", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    clearMobileAuthToken();
    setMobileAuthToken("mobile-access-token");
  });

  it("requests a challenge with authenticated mobile and CSRF headers", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        mockApiResponse(200, {
          ok: true,
          data: {
            csrfToken: "csrf-token"
          }
        })
      )
      .mockResolvedValueOnce(
        mockApiResponse(200, {
          ok: true,
          data: {
            challengeId: "00000000-0000-4000-8000-000000000001",
            expiresAt: "2026-07-18T20:00:00.000Z",
            passwordRequired: true,
            requested: true
          }
        })
      );

    const result = await requestMobileAccountDeletion({
      currentPassword: "Password123!"
    });

    expect(result.ok).toBe(true);
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      "https://api.babyloop.test/api/v1/auth/account-deletion/request",
      expect.objectContaining({
        method: "POST"
      })
    );

    const requestInit = (globalThis.fetch as jest.Mock).mock.calls[1]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers);

    expect(headers.get("authorization")).toBe("Bearer mobile-access-token");
    expect(headers.get("x-babyloop-client")).toBe("mobile");
    expect(headers.get("x-babyloop-csrf-token")).toBe("csrf-token");
    expect(String(requestInit.body)).toBe(
      JSON.stringify({ currentPassword: "Password123!" })
    );
  });

  it("clears the stored auth token after confirmed deletion", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        mockApiResponse(200, {
          ok: true,
          data: {
            csrfToken: "csrf-token"
          }
        })
      )
      .mockResolvedValueOnce(
        mockApiResponse(200, {
          ok: true,
          data: {
            accountDeleted: true,
            profileId: "00000000-0000-4000-8000-000000000002",
            storageCleanup: {
              completedCount: 0,
              failedCount: 0,
              pendingCount: 0
            }
          }
        })
      );

    const result = await confirmMobileAccountDeletion({
      challengeId: "00000000-0000-4000-8000-000000000001",
      code: "123456",
      confirmation: "HESABIMI SİL"
    });

    expect(result.ok).toBe(true);
    expect(getMobileAuthToken()).toBeNull();

    const requestInit = (globalThis.fetch as jest.Mock).mock.calls[1]?.[1] as RequestInit;
    expect(String(requestInit.body)).toBe(
      JSON.stringify({
        challengeId: "00000000-0000-4000-8000-000000000001",
        code: "123456",
        confirmation: "HESABIMI SİL"
      })
    );
  });
});
