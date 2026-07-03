import {
  fetchMobileNotifications,
  fetchMobileUnreadNotificationCount,
  generateMobileChildLifecycleNotifications,
  markAllMobileNotificationsRead,
  markMobileNotificationRead
} from "./notifications-api";
import { mobileAuthFetch } from "../auth/auth-api";

jest.mock("../auth/auth-api", () => ({
  mobileAuthFetch: jest.fn()
}));

const mobileAuthFetchMock = mobileAuthFetch as jest.MockedFunction<typeof mobileAuthFetch>;

describe("mobile notifications API", () => {
  beforeEach(() => {
    mobileAuthFetchMock.mockReset();
  });

  it("fetches notifications through authenticated mobile fetch", async () => {
    mobileAuthFetchMock.mockResolvedValueOnce(apiResponse({
      ok: true,
      data: {
        notifications: []
      }
    }));

    const result = await fetchMobileNotifications();

    expect(result).toEqual({
      ok: true,
      data: {
        notifications: []
      }
    });
    expect(mobileAuthFetchMock).toHaveBeenCalledWith("/api/v1/notifications", {});
  });

  it("fetches unread count", async () => {
    mobileAuthFetchMock.mockResolvedValueOnce(apiResponse({
      ok: true,
      data: {
        count: 3
      }
    }));

    const result = await fetchMobileUnreadNotificationCount();

    expect(result).toEqual({
      ok: true,
      data: {
        count: 3
      }
    });
    expect(mobileAuthFetchMock).toHaveBeenCalledWith("/api/v1/notifications/unread-count", {});
  });

  it("marks one notification read without leaking tokens", async () => {
    mobileAuthFetchMock.mockResolvedValueOnce(apiResponse({
      ok: true,
      data: {
        notification: {
          id: "99999999-9999-4999-8999-999999999999",
          recipientProfileId: "profile-1",
          actorProfile: null,
          type: "system",
          title: "Sistem",
          body: "Bildirim",
          entityType: null,
          entityId: null,
          metadata: {},
          readAt: "2030-01-01T00:00:00.000Z",
          createdAt: "2030-01-01T00:00:00.000Z"
        }
      }
    }));

    const result = await markMobileNotificationRead("99999999-9999-4999-8999-999999999999");

    const [, init] = mobileAuthFetchMock.mock.calls[0]!;

    expect(result.ok).toBe(true);
    expect(init?.method).toBe("PATCH");
    expect(JSON.stringify({ result, init })).not.toMatch(/accessToken|refreshToken|passwordHash/iu);
  });

  it("marks all notifications read", async () => {
    mobileAuthFetchMock.mockResolvedValueOnce(apiResponse({
      ok: true,
      data: {
        updatedCount: 2
      }
    }));

    const result = await markAllMobileNotificationsRead();

    expect(result).toEqual({
      ok: true,
      data: {
        updatedCount: 2
      }
    });
    expect(mobileAuthFetchMock).toHaveBeenCalledWith("/api/v1/notifications/read-all", {
      method: "PATCH"
    });
  });

  it("generates child lifecycle in-app notifications without claiming push delivery", async () => {
    mobileAuthFetchMock.mockResolvedValueOnce(apiResponse({
      ok: true,
      data: {
        createdCount: 1,
        skippedCount: 0,
        notifications: [],
        deliveryChannel: "in_app",
        draftOnly: false,
        note: "Bu endpoint yalnızca uygulama içi BabyLoop bildirimleri üretir."
      }
    }));

    const result = await generateMobileChildLifecycleNotifications();

    expect(result.ok).toBe(true);
    expect(result.ok ? result.data.deliveryChannel : null).toBe("in_app");
    expect(JSON.stringify(result)).not.toMatch(/push gönderildi|email gönderildi|n8n çalıştı/iu);
    expect(mobileAuthFetchMock).toHaveBeenCalledWith("/api/v1/notifications/child-lifecycle/generate", {
      method: "POST"
    });
  });

  it("returns a safe unavailable response when mobile fetch fails", async () => {
    mobileAuthFetchMock.mockRejectedValueOnce(new Error("network down"));

    const result = await fetchMobileNotifications();

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "API_UNAVAILABLE"
      }
    });
  });
});

function apiResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body)
  } as unknown as Response;
}
