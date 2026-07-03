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

    expect(await screen.findByText("İkinci doğrulama şu an kapalı.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Mevcut şifre"), {
      target: { value: "Password123!" }
    });
    fireEvent.click(screen.getByRole("button", { name: "OTP / MFA etkinleştir" }));

    await waitFor(() => {
      expect(enableMfa).toHaveBeenCalledWith("http://api.test", "Password123!");
    });

    expect(await screen.findByRole("status")).toHaveTextContent("OTP / MFA etkinleştirildi");
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

    expect(await screen.findByText("Sonraki girişlerde e-posta OTP kodu gerekir.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Mevcut şifre"), {
      target: { value: "Password123!" }
    });
    fireEvent.click(screen.getByRole("button", { name: "OTP / MFA kapat" }));

    await waitFor(() => {
      expect(disableMfa).toHaveBeenCalledWith("http://api.test", "Password123!");
    });

    expect(await screen.findByRole("status")).toHaveTextContent("OTP / MFA kapatıldı");
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

    fireEvent.click(await screen.findByRole("button", { name: "OTP / MFA etkinleştir" }));

    expect(await screen.findByText("Mevcut şifrenizi girin.")).toBeInTheDocument();
    expect(enableMfa).not.toHaveBeenCalled();
  });
});
