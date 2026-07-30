import { CURRENT_TERMS_VERSION } from "@babyloop/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../lib/i18n/i18n-provider";
import { AuthActionPromptModal } from "./auth-action-prompt-modal";
import { startGoogleLogin, submitAuthRequest } from "./api";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() })
}));

vi.mock("./api", () => ({
  completeLoginApproval: vi.fn(),
  isLoginApprovalCompletePendingPayload: vi.fn(),
  startGoogleLogin: vi.fn(),
  submitAuthRequest: vi.fn(),
  verifyMfaLogin: vi.fn()
}));

function renderModal() {
  return render(
    <I18nProvider>
      <AuthActionPromptModal
        apiBaseUrl="http://api.test"
        isOpen
        onClose={vi.fn()}
        title="Tekrar hoş geldin"
      />
    </I18nProvider>
  );
}

describe("AuthActionPromptModal register contract", () => {
  beforeEach(() => {
    vi.mocked(startGoogleLogin).mockReset();
    vi.mocked(submitAuthRequest).mockReset();
  });

  it("requires current terms and sends the exact register payload", async () => {
    vi.mocked(submitAuthRequest).mockResolvedValueOnce({
      error: { code: "INVALID_REQUEST", message: "invalid" },
      httpStatus: 400,
      ok: false,
      retryAfterSeconds: null
    });
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Hesap oluştur" }));

    const termsCheckbox = screen.getByRole("checkbox", {
      name: /Kullanım Koşulları/
    });
    const submitButton = document.querySelector<HTMLButtonElement>(
      ".market-auth-submit-button"
    );
    expect(termsCheckbox).not.toBeChecked();
    expect(submitButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "Google ile devam et" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Ad soyad"), {
      target: { value: "Çağla Şen" }
    });
    fireEvent.change(screen.getByLabelText("Şehir"), {
      target: { value: "Ataşehir" }
    });
    fireEvent.change(screen.getByLabelText("E-posta"), {
      target: { value: "synthetic-register@example.test" }
    });
    fireEvent.change(screen.getByLabelText("Şifre"), {
      target: { value: " Abcde! " }
    });
    fireEvent.click(termsCheckbox);
    expect(submitButton).toBeEnabled();

    fireEvent.submit(submitButton!.closest("form")!);

    await waitFor(() => {
      expect(submitAuthRequest).toHaveBeenCalledWith(
        "http://api.test",
        "register",
        {
          displayName: "Çağla Şen",
          email: "synthetic-register@example.test",
          locationCity: "Ataşehir",
          password: " Abcde! ",
          termsAccepted: true,
          termsVersion: CURRENT_TERMS_VERSION
        }
      );
    });
  });

  it("binds Google registration to the same current terms contract", async () => {
    vi.mocked(startGoogleLogin).mockResolvedValueOnce({
      error: { code: "GOOGLE_AUTH_UNAVAILABLE", message: "unavailable" },
      ok: false
    });
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Hesap oluştur" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Kullanım Koşulları/ }));
    fireEvent.click(screen.getByRole("button", { name: "Google ile devam et" }));

    await waitFor(() => {
      expect(startGoogleLogin).toHaveBeenCalledWith("http://api.test", {
        termsAccepted: true,
        termsVersion: CURRENT_TERMS_VERSION
      });
    });
  });
});
