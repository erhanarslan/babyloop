import { beforeEach, describe, expect, it, vi } from "vitest";

import { authFetch } from "../../lib/auth-client";
import {
  confirmAccountDeletion,
  requestAccountDeletion
} from "./account-deletion-api";

vi.mock("../../lib/auth-client", () => ({
  authFetch: vi.fn()
}));

function mockResponse(status: number, body: unknown): Response {
  return {
    json: vi.fn().mockResolvedValue(body),
    ok: status >= 200 && status < 300,
    status
  } as unknown as Response;
}

describe("account deletion API", () => {
  beforeEach(() => {
    vi.mocked(authFetch).mockReset();
  });

  it("requests a deletion challenge without sending an empty password field", async () => {
    vi.mocked(authFetch).mockResolvedValueOnce(
      mockResponse(200, {
        ok: true,
        data: {
          challengeId: "00000000-0000-4000-8000-000000000001",
          expiresAt: "2026-07-18T20:00:00.000Z",
          passwordRequired: false,
          requested: true
        }
      })
    );

    const result = await requestAccountDeletion("http://api.test", "");

    expect(result.ok).toBe(true);
    expect(authFetch).toHaveBeenCalledWith(
      "http://api.test",
      "/api/v1/auth/account-deletion/request",
      expect.objectContaining({
        body: "{}",
        method: "POST"
      })
    );
  });

  it("confirms deletion only with the exact server contract", async () => {
    vi.mocked(authFetch).mockResolvedValueOnce(
      mockResponse(200, {
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

    const result = await confirmAccountDeletion("http://api.test", {
      challengeId: "00000000-0000-4000-8000-000000000001",
      code: "123456",
      confirmation: "HESABIMI SİL"
    });

    expect(result.ok).toBe(true);
    expect(authFetch).toHaveBeenCalledWith(
      "http://api.test",
      "/api/v1/auth/account-deletion/confirm",
      expect.objectContaining({
        body: JSON.stringify({
          challengeId: "00000000-0000-4000-8000-000000000001",
          code: "123456",
          confirmation: "HESABIMI SİL"
        }),
        method: "POST"
      })
    );
  });
});
