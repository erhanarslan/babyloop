import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../lib/i18n/i18n-provider";
import { requestEmailVerification } from "./api";
import { RequestEmailVerificationForm } from "./request-email-verification-form";

vi.mock("./api", () => ({
  requestEmailVerification: vi.fn()
}));

describe("RequestEmailVerificationForm", () => {
  it("submits the account email and shows the neutral success state", async () => {
    vi.mocked(requestEmailVerification).mockResolvedValue({
      ok: true,
      data: {
        requested: true
      }
    });

    render(
      <I18nProvider>
        <RequestEmailVerificationForm apiBaseUrl="http://api.test" />
      </I18nProvider>
    );

    fireEvent.change(screen.getByLabelText("E-posta"), {
      target: { value: "ebeveyn@example.test" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Doğrulama bağlantısını gönder" }));

    await waitFor(() => {
      expect(requestEmailVerification).toHaveBeenCalledWith(
        "http://api.test",
        "ebeveyn@example.test"
      );
    });

    expect(await screen.findByText("Doğrulama e-postası istendi")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Giriş yap" })).not.toBeInTheDocument();
  });
});
