import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../lib/i18n/i18n-provider";
import { confirmPasswordReset } from "./api";
import { ResetPasswordForm } from "./reset-password-form";

const searchParams = new URLSearchParams("token=reset-token-secret");

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams
}));

vi.mock("./api", () => ({
  confirmPasswordReset: vi.fn()
}));

function renderForm() {
  return render(
    <I18nProvider>
      <ResetPasswordForm apiBaseUrl="http://api.test" />
    </I18nProvider>
  );
}

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    vi.mocked(confirmPasswordReset).mockReset();
  });

  it("submits the URL token without rendering it and shows generic success", async () => {
    vi.mocked(confirmPasswordReset).mockResolvedValueOnce({
      ok: true,
      data: {
        passwordReset: true
      }
    });

    renderForm();

    expect(screen.queryByText("reset-token-secret")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Yeni şifre"), {
      target: { value: "NewPassword123!" }
    });
    fireEvent.change(screen.getByLabelText("Yeni şifre tekrar"), {
      target: { value: "NewPassword123!" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Şifreyi değiştir" }));

    await waitFor(() => {
      expect(confirmPasswordReset).toHaveBeenCalledWith(
        "http://api.test",
        "reset-token-secret",
        "NewPassword123!"
      );
    });
    expect(await screen.findByText("Şifre sıfırlandı")).toBeInTheDocument();
    expect(screen.queryByText("NewPassword123!")).not.toBeInTheDocument();
  });

  it("maps unsafe API errors to a controlled message", async () => {
    vi.mocked(confirmPasswordReset).mockResolvedValueOnce({
      ok: false,
      error: {
        code: "INVALID_TOKEN",
        message: "<script>alert('x')</script>"
      }
    });

    renderForm();

    fireEvent.change(screen.getByLabelText("Yeni şifre"), {
      target: { value: "NewPassword123!" }
    });
    fireEvent.change(screen.getByLabelText("Yeni şifre tekrar"), {
      target: { value: "NewPassword123!" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Şifreyi değiştir" }));

    expect(await screen.findByText("İstek başarısız oldu. Lütfen tekrar dene.")).toBeInTheDocument();
    expect(screen.queryByText("<script>alert('x')</script>")).not.toBeInTheDocument();
    expect(document.querySelector("script")).not.toBeInTheDocument();
  });
});
