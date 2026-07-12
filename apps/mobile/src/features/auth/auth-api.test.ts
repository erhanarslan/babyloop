import {
  approveMobileLoginApproval,
  changeMobilePassword,
  clearMobileAuthToken,
  completeMobileLoginApproval,
  denyMobileLoginApproval,
  disableMobileLoginApproval,
  disableMobileMfa,
  enableMobileLoginApproval,
  enableMobileMfa,
  fetchMobileLoginApprovals,
  fetchMobileLoginApprovalStatus,
  fetchMobileMfaStatus,
  getMobileAuthToken,
  submitMobileAuthRequest,
  verifyMobileMfaLogin
} from "./auth-api";

jest.mock("../../config/api", () => ({
  getApiBaseUrl: () => "https://api.babyloop.test"
}));

const storedTokens: string[] = [];

jest.mock("./auth-token-storage", () => ({
  clearStoredMobileAuthToken: jest.fn(async () => {
    storedTokens.length = 0;
  }),
  getStoredMobileAuthToken: jest.fn(async () => storedTokens.at(-1) ?? null),
  setStoredMobileAuthToken: jest.fn(async (token: string) => {
    storedTokens.push(token);
  })
}));

function mockApiResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as Response;
}

describe("mobile auth API MFA flow", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    storedTokens.length = 0;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    clearMobileAuthToken();
  });

  it("keeps MFA challenge unauthenticated until OTP is verified", async () => {
    fetchMock.mockResolvedValueOnce(
      mockApiResponse(200, {
        ok: true,
        data: {
          challengeId: "00000000-0000-4000-8000-000000000001",
          mfaRequired: true
        }
      })
    );

    const result = await submitMobileAuthRequest("login", {
      email: "mfa@example.com",
      password: "Password123!"
    });

    expect(result).toEqual({
      ok: true,
      data: {
        challengeId: "00000000-0000-4000-8000-000000000001",
        mfaRequired: true
      }
    });
    expect(getMobileAuthToken()).toBeNull();
    expect(JSON.stringify(result)).not.toMatch(/accessToken|refreshToken|passwordHash|currentPassword/iu);
  });

  it("stores the access token after successful MFA verify", async () => {
    fetchMock.mockResolvedValueOnce(
      mockApiResponse(200, {
        ok: true,
        data: {
          accessToken: "mobile-access-token",
          user: {
            id: "user-1",
            email: "parent@example.com",
            role: "user"
          },
          profile: {
            id: "profile-1",
            displayName: "Parent",
            locationCity: "İstanbul"
          }
        }
      })
    );

    const result = await verifyMobileMfaLogin({
      challengeId: "00000000-0000-4000-8000-000000000001",
      code: "123456"
    });

    expect(result.ok).toBe(true);
    expect(getMobileAuthToken()).toBe("mobile-access-token");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.babyloop.test/api/v1/auth/mfa/verify",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          challengeId: "00000000-0000-4000-8000-000000000001",
          code: "123456"
        })
      })
    );

    const [, init] = fetchMock.mock.calls[0]!;
    const headers = new Headers(init?.headers as HeadersInit);

    expect(headers.get("x-babyloop-client")).toBe("mobile");
    expect(JSON.stringify(result)).not.toMatch(/refreshToken|passwordHash|currentPassword/iu);
  });

  it("does not authenticate when MFA verify rejects the code", async () => {
    fetchMock.mockResolvedValueOnce(
      mockApiResponse(400, {
        ok: false,
        error: {
          code: "MFA_CODE_INVALID",
          message: "MFA code is invalid or expired."
        }
      })
    );

    const result = await verifyMobileMfaLogin({
      challengeId: "00000000-0000-4000-8000-000000000001",
      code: "000000"
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "MFA_CODE_INVALID"
      }
    });
    expect(getMobileAuthToken()).toBeNull();
  });

  it("keeps unexpected mobile login approval challenge unauthenticated", async () => {
    fetchMock.mockResolvedValueOnce(
      mockApiResponse(200, {
        ok: true,
        data: {
          approvalId: "00000000-0000-4000-8000-000000000021",
          approvalToken: "login-approval-token",
          deviceLabel: "iPhone",
          expiresAt: "2026-07-04T01:01:30.000Z",
          loginApprovalRequired: true
        }
      })
    );

    const result = await submitMobileAuthRequest("login", {
      email: "approval@example.com",
      password: "Password123!"
    });

    expect(result).toEqual({
      ok: true,
      data: {
        approvalId: "00000000-0000-4000-8000-000000000021",
        approvalToken: "login-approval-token",
        deviceLabel: "iPhone",
        expiresAt: "2026-07-04T01:01:30.000Z",
        loginApprovalRequired: true
      }
    });
    expect(getMobileAuthToken()).toBeNull();
    expect(JSON.stringify(result)).not.toMatch(/refreshToken|passwordHash|currentPassword/iu);
  });

  it("stores the access token after mobile login approval completion", async () => {
    fetchMock.mockResolvedValueOnce(
      mockApiResponse(200, {
        ok: true,
        data: {
          accessToken: "approved-mobile-access-token",
          user: {
            id: "user-approval",
            email: "approval@example.com",
            role: "user"
          },
          profile: {
            id: "profile-approval",
            displayName: "Approval Parent",
            locationCity: "İstanbul"
          }
        }
      })
    );

    const result = await completeMobileLoginApproval("login-approval-token");

    expect(result.ok).toBe(true);
    expect(getMobileAuthToken()).toBe("approved-mobile-access-token");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.babyloop.test/api/v1/auth/login-approval/complete",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          approvalToken: "login-approval-token"
        })
      })
    );
    expect(JSON.stringify(result)).not.toMatch(/refreshToken|passwordHash|currentPassword/iu);
  });

  it("keeps unexpected MFA approval challenge unauthenticated", async () => {
    fetchMock.mockResolvedValueOnce(
      mockApiResponse(200, {
        ok: true,
        data: {
          approvalId: "00000000-0000-4000-8000-000000000022",
          approvalToken: "mfa-login-approval-token",
          deviceLabel: "Android",
          expiresAt: "2026-07-04T01:01:30.000Z",
          loginApprovalRequired: true
        }
      })
    );

    const result = await verifyMobileMfaLogin({
      challengeId: "00000000-0000-4000-8000-000000000001",
      code: "123456"
    });

    expect(result).toEqual({
      ok: true,
      data: {
        approvalId: "00000000-0000-4000-8000-000000000022",
        approvalToken: "mfa-login-approval-token",
        deviceLabel: "Android",
        expiresAt: "2026-07-04T01:01:30.000Z",
        loginApprovalRequired: true
      }
    });
    expect(getMobileAuthToken()).toBeNull();
    expect(JSON.stringify(result)).not.toMatch(/accessToken|refreshToken|passwordHash|currentPassword/iu);
  });

  it("reads and updates mobile login approval preferences through authenticated mobile requests", async () => {
    fetchMock
      .mockResolvedValueOnce(
        mockApiResponse(200, {
          ok: true,
          data: {
            delivery: "in_app",
            method: "mobile_approval",
            mobileLoginApprovalEnabled: false
          }
        })
      )
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
            delivery: "in_app",
            method: "mobile_approval",
            mobileLoginApprovalEnabled: true,
            updated: true
          }
        })
      )
      .mockResolvedValueOnce(
        mockApiResponse(200, {
          ok: true,
          data: {
            delivery: "in_app",
            method: "mobile_approval",
            mobileLoginApprovalEnabled: false,
            updated: true
          }
        })
      );

    const status = await fetchMobileLoginApprovalStatus();
    const enabled = await enableMobileLoginApproval({ currentPassword: "Password123!" });
    const disabled = await disableMobileLoginApproval({ currentPassword: "Password123!" });

    expect(status).toEqual({
      ok: true,
      data: {
        delivery: "in_app",
        method: "mobile_approval",
        mobileLoginApprovalEnabled: false
      }
    });
    expect(enabled).toEqual({
      ok: true,
      data: {
        delivery: "in_app",
        method: "mobile_approval",
        mobileLoginApprovalEnabled: true,
        updated: true
      }
    });
    expect(disabled).toEqual({
      ok: true,
      data: {
        delivery: "in_app",
        method: "mobile_approval",
        mobileLoginApprovalEnabled: false,
        updated: true
      }
    });

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "https://api.babyloop.test/api/v1/auth/login-approval/status",
      "https://api.babyloop.test/api/v1/auth/csrf",
      "https://api.babyloop.test/api/v1/auth/login-approval/enable",
      "https://api.babyloop.test/api/v1/auth/login-approval/disable"
    ]);

    const serialized = JSON.stringify({ status, enabled, disabled });

    expect(serialized).not.toMatch(/passwordHash|refreshToken|accessToken|currentPassword/iu);
  });

  it("changes the mobile password through an authenticated CSRF-protected request", async () => {
    fetchMock
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
            passwordChanged: true
          }
        })
      );

    const result = await changeMobilePassword({
      currentPassword: "OldPassword123!",
      newPassword: "NewPassword123!"
    });

    expect(result).toEqual({
      ok: true,
      data: {
        passwordChanged: true
      }
    });
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "https://api.babyloop.test/api/v1/auth/csrf",
      "https://api.babyloop.test/api/v1/auth/password/change"
    ]);

    const mutationInit = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined;

    expect(mutationInit?.method).toBe("POST");
    expect(mutationInit?.body).toBe(JSON.stringify({
      currentPassword: "OldPassword123!",
      newPassword: "NewPassword123!"
    }));
    expect(JSON.stringify(result)).not.toMatch(/passwordHash|refreshToken|accessToken|currentPassword/iu);
  });

  it("lists and resolves pending mobile login approval requests without exposing secrets", async () => {
    fetchMock
      .mockResolvedValueOnce(
        mockApiResponse(200, {
          ok: true,
          data: {
            approvals: [
              {
                id: "00000000-0000-4000-8000-000000000011",
                status: "pending",
                deviceLabel: "Mac tarayıcı",
                requestUserAgent: "Mozilla BabyLoopWeb",
                requestIpAddress: "10.0.0.10",
                createdAt: "2026-07-04T01:00:00.000Z",
                expiresAt: "2026-07-04T01:10:00.000Z",
                resolvedAt: null
              }
            ]
          }
        })
      )
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
            approvalId: "00000000-0000-4000-8000-000000000011",
            resolved: true,
            status: "approved"
          }
        })
      )
      .mockResolvedValueOnce(
        mockApiResponse(200, {
          ok: true,
          data: {
            approvalId: "00000000-0000-4000-8000-000000000012",
            resolved: true,
            status: "denied"
          }
        })
      );

    const list = await fetchMobileLoginApprovals();
    const approve = await approveMobileLoginApproval("00000000-0000-4000-8000-000000000011");
    const deny = await denyMobileLoginApproval("00000000-0000-4000-8000-000000000012");

    expect(list).toEqual({
      ok: true,
      data: {
        approvals: [
          {
            id: "00000000-0000-4000-8000-000000000011",
            status: "pending",
            deviceLabel: "Mac tarayıcı",
            requestUserAgent: "Mozilla BabyLoopWeb",
            requestIpAddress: "10.0.0.10",
            createdAt: "2026-07-04T01:00:00.000Z",
            expiresAt: "2026-07-04T01:10:00.000Z",
            resolvedAt: null
          }
        ]
      }
    });
    expect(approve).toEqual({
      ok: true,
      data: {
        approvalId: "00000000-0000-4000-8000-000000000011",
        resolved: true,
        status: "approved"
      }
    });
    expect(deny).toEqual({
      ok: true,
      data: {
        approvalId: "00000000-0000-4000-8000-000000000012",
        resolved: true,
        status: "denied"
      }
    });

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "https://api.babyloop.test/api/v1/auth/login-approvals",
      "https://api.babyloop.test/api/v1/auth/csrf",
      "https://api.babyloop.test/api/v1/auth/login-approvals/00000000-0000-4000-8000-000000000011/approve",
      "https://api.babyloop.test/api/v1/auth/login-approvals/00000000-0000-4000-8000-000000000012/deny"
    ]);

    const serialized = JSON.stringify({ list, approve, deny });

    expect(serialized).not.toMatch(/approvalToken|approvalTokenHash|refreshToken|passwordHash|accessToken/iu);
  });

  it("reads and updates MFA preferences through authenticated mobile requests", async () => {
    fetchMock
      // fetchMobileMfaStatus(): safe GET, no CSRF bootstrap.
      .mockResolvedValueOnce(
        mockApiResponse(200, {
          ok: true,
          data: {
            delivery: "email",
            method: "email_otp",
            mfaEnabled: false
          }
        })
      )
      // enableMobileMfa(): POST first asks for public CSRF.
      .mockResolvedValueOnce(
        mockApiResponse(200, {
          ok: true,
          data: {
            csrfToken: "csrf-token"
          }
        })
      )
      // enableMobileMfa(): actual mutation response.
      .mockResolvedValueOnce(
        mockApiResponse(200, {
          ok: true,
          data: {
            delivery: "email",
            method: "email_otp",
            mfaEnabled: true,
            updated: true
          }
        })
      )
      // disableMobileMfa(): reuses cached CSRF, so only mutation response is needed.
      .mockResolvedValueOnce(
        mockApiResponse(200, {
          ok: true,
          data: {
            delivery: "email",
            method: "email_otp",
            mfaEnabled: false,
            updated: true
          }
        })
      );

    const status = await fetchMobileMfaStatus();
    const enabled = await enableMobileMfa({ currentPassword: "Password123!" });
    const disabled = await disableMobileMfa({ currentPassword: "Password123!" });

    expect(status).toEqual({
      ok: true,
      data: {
        delivery: "email",
        method: "email_otp",
        mfaEnabled: false
      }
    });

    expect(enabled).toEqual({
      ok: true,
      data: {
        delivery: "email",
        method: "email_otp",
        mfaEnabled: true,
        updated: true
      }
    });

    expect(disabled).toEqual({
      ok: true,
      data: {
        delivery: "email",
        method: "email_otp",
        mfaEnabled: false,
        updated: true
      }
    });

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "https://api.babyloop.test/api/v1/auth/mfa/status",
      "https://api.babyloop.test/api/v1/auth/csrf",
      "https://api.babyloop.test/api/v1/auth/mfa/enable",
      "https://api.babyloop.test/api/v1/auth/mfa/disable"
    ]);

    const serialized = JSON.stringify({ status, enabled, disabled });

    expect(serialized).not.toMatch(/passwordHash|refreshToken|accessToken/iu);
  });

  it("sends the mobile client channel on login requests", async () => {
    fetchMock.mockResolvedValueOnce(
      mockApiResponse(200, {
        ok: true,
        data: {
          accessToken: "mobile-access-token",
          user: {
            id: "user-mobile-channel",
            email: "parent@babyloop.test",
            emailVerifiedAt: new Date().toISOString()
          },
          profile: {
            id: "profile-mobile-channel",
            displayName: "Parent",
            locationCity: "İstanbul"
          }
        }
      })
    );

    await submitMobileAuthRequest("login", {
      email: "parent@babyloop.test",
      password: "Password123!"
    });

    const [, init] = fetchMock.mock.calls[0]!;
    const headers = new Headers(init?.headers as HeadersInit);

    expect(headers.get("x-babyloop-client")).toBe("mobile");
    expect(String(init?.body)).toContain('"clientType":"mobile"');
    expect(String(init?.body)).not.toMatch(/approvalToken|refreshTokenHash|passwordHash/iu);
  });

});
