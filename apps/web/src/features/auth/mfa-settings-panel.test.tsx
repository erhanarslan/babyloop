import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../lib/i18n/i18n-provider";
import {
  disableMfa,
  enableMfa,
  fetchMfaStatus
} from "./api";
import { MfaSettingsPanel } from "./mfa-settings-panel";

const requireAuthMock = vi.fn();

vi.mock("../../lib/use-protected-route", () => ({
  useProtectedRoute: () => ({
    isCheckingAuth: false,
    requireAuth: requireAuthMock
  })
}));

vi.mock("./api", () => ({
  disableMfa: vi.fn(),
  enableMfa: vi.fn(),
  fetchMfaStatus: vi.fn()
}));

function renderPanel() {
  return render(
    <I18nProvider>
      <MfaSettingsPanel apiBaseUrl="http://api.test" />
    </I18nProvider>
  );
}

describe("MfaSettingsPanel", () => {
  beforeEach(() => {
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue(true);
    vi.mocked(disableMfa).mockReset();
    vi.mocked(enableMfa).mockReset();
    vi.mocked(fetchMfaStatus).mockReset();
  });

  it("loads MFA status and enables email OTP without rendering secrets", async () => {
    vi.mocked(fetchMfaStatus).mockResolvedValueOnce({
      ok: true,
      data: {
        delivery: "email",
        method: "email_otp",
        mfaEnabled: false
      }
    });
    vi.mocked(enableMfa).mockResolvedValueOnce({
      ok: true,
      data: {
        delivery: "email",
        method: "email_otp",
        mfaEnabled: true,
        updated: true
      }
    });

    renderPanel();

    const toggle = await screen.findByRole("switch", { name: "İki adımlı doğrulama kapalı" });
    expect(toggle).toHaveAttribute("aria-checked", "false");

    fireEvent.click(toggle);
    fireEvent.change(screen.getByLabelText("Mevcut şifre"), {
      target: { value: "Password123!" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Aç" }));

    await waitFor(() => {
      expect(enableMfa).toHaveBeenCalledWith("http://api.test", "Password123!");
    });

    expect(await screen.findByRole("status")).toHaveTextContent("İki adımlı doğrulama açıldı");
    expect(screen.queryByText("Password123!")).not.toBeInTheDocument();
    expect(JSON.stringify(screen.queryByText("Password123!"))).not.toMatch(/accessToken|refreshToken|passwordHash/iu);
  });

  it("disables MFA when it is currently enabled", async () => {
    vi.mocked(fetchMfaStatus).mockResolvedValueOnce({
      ok: true,
      data: {
        delivery: "email",
        method: "email_otp",
        mfaEnabled: true
      }
    });
    vi.mocked(disableMfa).mockResolvedValueOnce({
      ok: true,
      data: {
        delivery: "email",
        method: "email_otp",
        mfaEnabled: false,
        updated: true
      }
    });

    renderPanel();

    const toggle = await screen.findByRole("switch", { name: "İki adımlı doğrulama açık" });
    expect(toggle).toHaveAttribute("aria-checked", "true");

    fireEvent.click(toggle);
    fireEvent.change(screen.getByLabelText("Mevcut şifre"), {
      target: { value: "Password123!" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Kapat" }));

    await waitFor(() => {
      expect(disableMfa).toHaveBeenCalledWith("http://api.test", "Password123!");
    });

    expect(await screen.findByRole("status")).toHaveTextContent("İki adımlı doğrulama kapatıldı");
  });

  it("requires current password before changing MFA", async () => {
    vi.mocked(fetchMfaStatus).mockResolvedValueOnce({
      ok: true,
      data: {
        delivery: "email",
        method: "email_otp",
        mfaEnabled: false
      }
    });

    renderPanel();

    fireEvent.click(await screen.findByRole("switch", { name: "İki adımlı doğrulama kapalı" }));
    fireEvent.click(screen.getByRole("button", { name: "Aç" }));

    expect(await screen.findByText("Mevcut şifreni gir.")).toBeInTheDocument();
    expect(enableMfa).not.toHaveBeenCalled();
  });
});
