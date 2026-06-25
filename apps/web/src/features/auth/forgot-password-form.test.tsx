import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../lib/i18n/i18n-provider";
import { requestPasswordReset } from "./api";
import { ForgotPasswordForm } from "./forgot-password-form";

vi.mock("./api", () => ({
  requestPasswordReset: vi.fn()
}));

function renderForm() {
  return render(
    <I18nProvider>
      <ForgotPasswordForm apiBaseUrl="http://api.test" />
    </I18nProvider>
  );
}

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    vi.mocked(requestPasswordReset).mockReset();
  });

  it("shows a generic success message without account enumeration", async () => {
    vi.mocked(requestPasswordReset).mockResolvedValueOnce({
      ok: true,
      data: {
        requested: true
      }
    });

    renderForm();

    fireEvent.change(screen.getByLabelText("E-posta"), {
      target: { value: "parent@example.test" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Sıfırlama iste" }));

    await waitFor(() => {
      expect(requestPasswordReset).toHaveBeenCalledWith("http://api.test", "parent@example.test");
    });
    expect(screen.getByRole("status")).toHaveTextContent("İstek hazırlandı");
    expect(screen.getByText(/hesabın var olup olmadığını göstermez/i)).toBeInTheDocument();
    expect(screen.queryByText("parent@example.test")).not.toBeInTheDocument();
  });

  it("maps unsafe API error text to a controlled message", async () => {
    vi.mocked(requestPasswordReset).mockResolvedValueOnce({
      ok: false,
      error: {
        code: "BAD_REQUEST",
        message: "<script>alert('x')</script>"
      }
    });

    renderForm();

    fireEvent.change(screen.getByLabelText("E-posta"), {
      target: { value: "parent@example.test" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Sıfırlama iste" }));

    expect(await screen.findByText("İstek başarısız oldu. Lütfen tekrar dene.")).toBeInTheDocument();
    expect(screen.queryByText("<script>alert('x')</script>")).not.toBeInTheDocument();
    expect(document.querySelector("script")).not.toBeInTheDocument();
  });
});
