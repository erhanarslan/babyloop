import { CURRENT_TERMS_VERSION } from "@babyloop/shared";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../lib/i18n/i18n-provider";
import { startGoogleLogin } from "./api";
import { AuthPromptProvider } from "./auth-prompt-provider";

const { router } = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn()
  }
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router
}));

vi.mock("./api", () => ({
  completeLoginApproval: vi.fn(),
  isLoginApprovalCompletePendingPayload: vi.fn(),
  startGoogleLogin: vi.fn(),
  submitAuthRequest: vi.fn(),
  verifyMfaLogin: vi.fn()
}));

function renderProvider(search: string) {
  window.history.replaceState({}, "", `/${search}`);

  return render(
    <I18nProvider>
      <AuthPromptProvider apiBaseUrl="http://api.test">
        <p>Ana sayfa</p>
      </AuthPromptProvider>
    </I18nProvider>
  );
}

describe("AuthPromptProvider query contract", () => {
  beforeEach(() => {
    router.push.mockReset();
    router.refresh.mockReset();
    router.replace.mockReset();
    vi.mocked(startGoogleLogin).mockReset();
  });

  it("opens the login tab with a safe Google failure alert and keyboard focus", async () => {
    renderProvider("?auth=login&authError=google_auth_failed");

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("tab", { name: "Giriş yap" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Google ile giriş başarısız oldu. Lütfen tekrar deneyin."
    );
    await waitFor(() => {
      expect(within(dialog).getByRole("button", { name: "Kapat" })).toHaveFocus();
    });
  });

  it("shows the controlled unavailable message", async () => {
    renderProvider("?auth=login&authError=google_auth_unavailable");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Google ile giriş şu anda kullanılamıyor. E-posta ve şifreyle devam edebilirsin."
    );
  });

  it("opens the register tab for an explicit register query", async () => {
    renderProvider("?auth=register");

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("tab", { name: "Hesap oluştur" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(within(dialog).getByRole("checkbox", { name: /Kullanım Koşulları/ })).toBeVisible();
  });

  it("requires current terms before retrying a first Google registration", async () => {
    vi.mocked(startGoogleLogin).mockResolvedValueOnce({
      data: { started: true },
      ok: true
    });
    renderProvider(
      "?auth=register&authError=legal_terms_required&provider=google"
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Bu Google hesabıyla ilk kez devam ediyorsun. Kullanım Koşulları'nı kabul edip Google ile devam et."
    );

    const googleButton = within(dialog).getByRole("button", { name: "Google ile devam et" });
    const termsCheckbox = within(dialog).getByRole("checkbox", { name: /Kullanım Koşulları/ });
    expect(googleButton).toBeDisabled();

    fireEvent.click(termsCheckbox);
    expect(googleButton).toBeEnabled();
    fireEvent.click(googleButton);

    await waitFor(() => {
      expect(startGoogleLogin).toHaveBeenCalledWith("http://api.test", {
        termsAccepted: true,
        termsVersion: CURRENT_TERMS_VERSION
      });
    });
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("cleans only auth-owned query state with router.replace when closed", async () => {
    renderProvider(
      "?auth=login&authError=google_auth_failed&provider=google&returnTo=%2Faccount&utm_source=safe"
    );

    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(router.replace).toHaveBeenCalledWith("/?utm_source=safe", { scroll: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not render an unknown provider error value", async () => {
    renderProvider("?auth=login&authError=raw-provider-secret");

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("raw-provider-secret")).not.toBeInTheDocument();
  });
});
