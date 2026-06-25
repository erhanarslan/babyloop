import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmailOpsPage } from "./email-ops-page";

const apiBaseUrl = "http://api.example.test";

const previewPayload = {
  ok: true,
  data: {
    emailProvider: {
      driver: "smtp",
      sendEnabled: false,
      fromConfigured: true,
      providerConfigured: false,
      sandboxOnly: true,
      missing: ["SMTP_HOST", "SMTP_PORT"],
      warning: "Email provider sandbox modundadır."
    },
    supportedIntents: [
      "email_verification",
      "password_reset",
      "notification_digest",
      "security_alert"
    ],
    warning: "Email ops preview secret-safe."
  }
};

function jsonResponse(payload: unknown, ok = true) {
  return {
    ok,
    json: async () => payload
  } as Response;
}

describe("EmailOpsPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders provider preview and missing env fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(previewPayload));
    vi.stubGlobal("fetch", fetchMock);

    render(<EmailOpsPage apiBaseUrl={apiBaseUrl} />);

    expect(screen.getByText("Email ops preview yükleniyor...")).toBeInTheDocument();

    expect(await screen.findByText("Email delivery operasyonları")).toBeInTheDocument();
    expect(screen.getByText("SMTP")).toBeInTheDocument();
    expect(screen.getByText("SMTP_HOST")).toBeInTheDocument();
    expect(screen.getByText("SMTP_PORT")).toBeInTheDocument();
    expect(screen.getByText("Email provider sandbox modundadır.")).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      `${apiBaseUrl}/api/v1/admin/email/ops-preview`,
      {
        credentials: "include"
      }
    );
  });

  it("submits a controlled test-send request and renders sandbox result", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(previewPayload))
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          data: {
            intent: "password_reset",
            result: {
              sent: false,
              provider: "smtp",
              sandboxOnly: true,
              reason: "email_delivery_disabled"
            },
            warning: "Admin test email sandbox/disabled modda kaldı; gerçek mail gönderilmedi."
          }
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<EmailOpsPage apiBaseUrl={apiBaseUrl} />);

    await screen.findByText("Admin test email");

    fireEvent.change(screen.getByLabelText("To"), {
      target: {
        value: "ops@example.test"
      }
    });
    fireEvent.change(screen.getByLabelText("Intent"), {
      target: {
        value: "password_reset"
      }
    });
    fireEvent.change(screen.getByLabelText("Note"), {
      target: {
        value: " SMTP smoke test "
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Test email gönder" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(fetchMock).toHaveBeenLastCalledWith(
      `${apiBaseUrl}/api/v1/admin/email/test-send`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          to: "ops@example.test",
          intent: "password_reset",
          note: "SMTP smoke test"
        })
      }
    );

    expect(await screen.findByText("email_delivery_disabled")).toBeInTheDocument();
    expect(screen.getByText("Admin test email sandbox/disabled modda kaldı; gerçek mail gönderilmedi.")).toBeInTheDocument();
  });

  it("renders preview error when ops preview fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "Forbidden"
          }
        },
        false
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<EmailOpsPage apiBaseUrl={apiBaseUrl} />);

    expect(await screen.findByText("Email ops preview yüklenemedi.")).toBeInTheDocument();
  });
});
