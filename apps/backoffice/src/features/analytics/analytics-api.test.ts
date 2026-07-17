import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getBackofficeAnalyticsOverview,
  getBackofficeAnalyticsPages
} from "./analytics-api";

const authFetchMock = vi.fn();

vi.mock("../../lib/api", () => ({
  getApiBaseUrl: () => "http://api.test"
}));

vi.mock("../../lib/auth-client", () => ({
  authFetch: (...args: unknown[]) => authFetchMock(...args)
}));

describe("backoffice analytics api", () => {
  beforeEach(() => {
    authFetchMock.mockReset();
  });

  it("loads aggregate overview endpoint", async () => {
    authFetchMock.mockResolvedValueOnce({
      json: async () => ({
        ok: true,
        data: {
          overview: {
            activeUsers: 1
          }
        }
      })
    });

    const response = await getBackofficeAnalyticsOverview();

    expect(response.ok).toBe(true);
    expect(authFetchMock).toHaveBeenCalledWith("http://api.test", "/api/v1/admin/analytics/overview");
  });

  it("loads pages aggregate endpoint", async () => {
    authFetchMock.mockResolvedValueOnce({
      json: async () => ({
        ok: true,
        data: {
          pages: []
        }
      })
    });

    const response = await getBackofficeAnalyticsPages();

    expect(response.ok).toBe(true);
    expect(authFetchMock).toHaveBeenCalledWith("http://api.test", "/api/v1/admin/analytics/pages");
  });

  it("returns safe failure on network error", async () => {
    authFetchMock.mockRejectedValueOnce(new Error("offline"));

    const response = await getBackofficeAnalyticsOverview();

    expect(response).toMatchObject({
      ok: false,
      error: {
        code: "BACKOFFICE_REQUEST_FAILED"
      }
    });
  });
});
