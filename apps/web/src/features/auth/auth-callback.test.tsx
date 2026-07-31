import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../lib/i18n/i18n-provider";
import { clearAuthToken, getAuthToken, refreshSession } from "../../lib/auth-client";
import { storeAuthReturnTo } from "./auth-return-to";
import { AuthCallback } from "./auth-callback";

const { navigationState, router } = vi.hoisted(() => ({
  navigationState: { search: "status=success" },
  router: {
    refresh: vi.fn(),
    replace: vi.fn()
  }
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(navigationState.search)
}));

vi.mock("../../lib/auth-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/auth-client")>();

  return {
    ...actual,
    clearAuthToken: vi.fn(),
    getAuthToken: vi.fn(),
    refreshSession: vi.fn()
  };
});

function renderCallback() {
  return render(
    <I18nProvider>
      <AuthCallback apiBaseUrl="http://api.test" />
    </I18nProvider>
  );
}

describe("AuthCallback", () => {
  beforeEach(() => {
    navigationState.search = "status=success";
    router.refresh.mockReset();
    router.replace.mockReset();
    vi.mocked(clearAuthToken).mockReset();
    vi.mocked(getAuthToken).mockReset();
    vi.mocked(refreshSession).mockReset();
    sessionStorage.clear();
    window.history.replaceState({}, "", "/auth/callback?status=success");
  });

  it("preserves and consumes the safe OAuth returnTo after a successful callback", async () => {
    storeAuthReturnTo("/account/orders?filter=active");
    vi.mocked(refreshSession).mockResolvedValueOnce({
      data: {
        accessToken: "test-access-token",
        profile: {
          displayName: "Test Parent",
          id: "profile-id",
          locationCity: "İstanbul"
        },
        user: {
          email: "parent@example.test",
          id: "user-id",
          role: "user"
        }
      },
      ok: true
    });

    renderCallback();

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/account/orders?filter=active");
    });
    expect(refreshSession).toHaveBeenCalledWith("http://api.test", { force: true });
    expect(sessionStorage.getItem("babyloop_auth_return_to")).toBeNull();
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("routes a failed callback back to the home login modal", async () => {
    navigationState.search = "status=failed&providerError=secret-provider-detail";

    renderCallback();

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith(
        "/?auth=login&authError=google_auth_failed"
      );
    });
    expect(clearAuthToken).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalledWith(expect.stringContaining("secret-provider-detail"));
  });
});
