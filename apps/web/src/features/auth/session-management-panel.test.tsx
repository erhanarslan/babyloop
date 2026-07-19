import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../lib/i18n/i18n-provider";
import {
  fetchAuthSessions,
  revokeAllAuthSessionsRequest,
  revokeAuthSessionRequest
} from "./api";
import { SessionManagementPanel } from "./session-management-panel";

const requireAuthMock = vi.fn();

vi.mock("../../lib/use-protected-route", () => ({
  useProtectedRoute: () => ({
    isCheckingAuth: false,
    requireAuth: requireAuthMock
  })
}));

vi.mock("./api", () => ({
  fetchAuthSessions: vi.fn(),
  revokeAllAuthSessionsRequest: vi.fn(),
  revokeAuthSessionRequest: vi.fn()
}));

function renderPanel() {
  return render(
    <I18nProvider>
      <SessionManagementPanel apiBaseUrl="http://api.test" />
    </I18nProvider>
  );
}

describe("SessionManagementPanel", () => {
  beforeEach(() => {
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue(true);
    vi.mocked(fetchAuthSessions).mockReset();
    vi.mocked(revokeAllAuthSessionsRequest).mockReset();
    vi.mocked(revokeAuthSessionRequest).mockReset();
  });

  it("lists active sessions without rendering secrets", async () => {
    vi.mocked(fetchAuthSessions).mockResolvedValueOnce({
      ok: true,
      data: {
        currentSessionId: "session-current",
        sessions: [
          {
            id: "session-current",
            current: true,
            deviceLabel: "Mac tarayıcı",
            userAgent: "Mozilla/5.0 Macintosh",
            ipAddress: "127.0.0.1",
            createdAt: "2030-01-01T10:00:00.000Z",
            updatedAt: "2030-01-01T10:10:00.000Z",
            expiresAt: "2030-02-01T10:00:00.000Z"
          },
          {
            id: "session-mobile",
            current: false,
            deviceLabel: "Android cihaz",
            userAgent: "BabyLoopMobile Android",
            ipAddress: null,
            createdAt: "2030-01-02T10:00:00.000Z",
            updatedAt: "2030-01-02T10:10:00.000Z",
            expiresAt: "2030-02-02T10:00:00.000Z"
          }
        ]
      }
    });

    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Görüntüle" }));
    expect(await screen.findByText("Mac tarayıcı")).toBeInTheDocument();
    expect(screen.getByText("Android cihaz")).toBeInTheDocument();
    expect(screen.getByText("Bu cihaz")).toBeInTheDocument();
    expect(screen.getByText("2 açık oturum")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/refreshToken|refresh_token|refreshTokenHash|passwordHash|accessToken/iu);
  });

  it("revokes one non-current session and removes it from the list", async () => {
    vi.mocked(fetchAuthSessions).mockResolvedValueOnce({
      ok: true,
      data: {
        currentSessionId: "session-current",
        sessions: [
          {
            id: "session-current",
            current: true,
            deviceLabel: "Mac tarayıcı",
            userAgent: "Mozilla/5.0 Macintosh",
            ipAddress: "127.0.0.1",
            createdAt: "2030-01-01T10:00:00.000Z",
            updatedAt: "2030-01-01T10:10:00.000Z",
            expiresAt: "2030-02-01T10:00:00.000Z"
          },
          {
            id: "session-mobile",
            current: false,
            deviceLabel: "Android cihaz",
            userAgent: "BabyLoopMobile Android",
            ipAddress: null,
            createdAt: "2030-01-02T10:00:00.000Z",
            updatedAt: "2030-01-02T10:10:00.000Z",
            expiresAt: "2030-02-02T10:00:00.000Z"
          }
        ]
      }
    });
    vi.mocked(revokeAuthSessionRequest).mockResolvedValueOnce({
      ok: true,
      data: {
        currentSessionRevoked: false,
        revoked: true,
        sessionId: "session-mobile"
      }
    });

    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Görüntüle" }));
    const mobileCard = await screen.findByText("Android cihaz");
    const card = mobileCard.closest("article");

    expect(card).not.toBeNull();

    fireEvent.click(within(card as HTMLElement).getByRole("button", { name: "Kapat" }));

    await waitFor(() => {
      expect(revokeAuthSessionRequest).toHaveBeenCalledWith("http://api.test", "session-mobile");
    });

    expect(await screen.findByRole("status")).toHaveTextContent("Oturum kapatıldı.");
    expect(screen.queryByText("Android cihaz")).not.toBeInTheDocument();
  });

  it("revokes all sessions and clears the list", async () => {
    vi.mocked(fetchAuthSessions).mockResolvedValueOnce({
      ok: true,
      data: {
        currentSessionId: "session-current",
        sessions: [
          {
            id: "session-current",
            current: true,
            deviceLabel: "Mac tarayıcı",
            userAgent: "Mozilla/5.0 Macintosh",
            ipAddress: "127.0.0.1",
            createdAt: "2030-01-01T10:00:00.000Z",
            updatedAt: "2030-01-01T10:10:00.000Z",
            expiresAt: "2030-02-01T10:00:00.000Z"
          }
        ]
      }
    });
    vi.mocked(revokeAllAuthSessionsRequest).mockResolvedValueOnce({
      ok: true,
      data: {
        revokedCount: 1
      }
    });

    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Tümünü kapat" }));
    const dialog = await screen.findByRole("dialog", { name: "Tüm oturumları kapat" });
    fireEvent.change(within(dialog).getByLabelText("Mevcut şifre"), {
      target: { value: "Password123!" }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Tümünü kapat" }));

    await waitFor(() => {
      expect(revokeAllAuthSessionsRequest).toHaveBeenCalledWith("http://api.test", "Password123!");
    });
  });
});
