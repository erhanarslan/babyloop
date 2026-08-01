import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BackofficeAccessProvider } from "../auth/backoffice-access";
import { EmailOpsPage } from "./email-ops-page";

const { authFetchMock } = vi.hoisted(() => ({ authFetchMock: vi.fn() }));
vi.mock("../../lib/auth-client", () => ({ authFetch: authFetchMock }));

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
      missingConfigurationCount: 2,
      senderDomainVerified: null
    },
    recipientPolicyConfigured: true,
    supportedIntents: ["email_verification", "password_reset", "notification_digest", "security_alert"],
    warning: "Gönderim kapalı; kontrollü test isteği sağlayıcıya iletilmez."
  }
};

function jsonResponse(payload: unknown, ok = true) {
  return { ok, json: async () => payload } as Response;
}

function renderPage(role = "admin", accessMode: "preview" | "staff" = "staff") {
  return render(
    <BackofficeAccessProvider accessMode={accessMode} role={role}>
      <EmailOpsPage apiBaseUrl={apiBaseUrl} />
    </BackofficeAccessProvider>
  );
}

describe("EmailOpsPage", () => {
  afterEach(() => {
    authFetchMock.mockReset();
    vi.restoreAllMocks();
  });

  it("renders safe provider readiness without environment key dumps", async () => {
    authFetchMock.mockResolvedValue(jsonResponse(previewPayload));
    renderPage();

    expect(screen.getByText("E-posta operasyon durumu yükleniyor…")).toBeInTheDocument();
    expect(await screen.findByText("E-posta gönderim sağlığı")).toBeInTheDocument();
    expect(screen.getAllByText("SMTP")).toHaveLength(2);
    expect(screen.getByText("2 yapılandırma alanı eksik.")).toBeInTheDocument();
    expect(screen.queryByText(/SMTP_HOST|RESEND_API_KEY/u)).not.toBeInTheDocument();
    expect(authFetchMock).toHaveBeenCalledWith(apiBaseUrl, "/api/v1/admin/email/ops-preview");
  });

  it("submits a CSRF-aware controlled request and renders safe delivery result", async () => {
    authFetchMock
      .mockResolvedValueOnce(jsonResponse(previewPayload))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        data: {
          intent: "password_reset",
          status: "not_sent",
          provider: "smtp",
          sandboxOnly: true,
          deliveryReference: null,
          recipientMasked: "o***@example.test",
          occurredAt: "2026-07-31T10:00:00.000Z",
          errorCategory: "delivery_disabled",
          message: "Gerçek gönderim operasyon anahtarıyla kapalı."
        }
      }));
    vi.spyOn(crypto, "randomUUID").mockReturnValue("99999999-9999-4999-8999-999999999999");
    renderPage();

    await screen.findByText("Kontrollü test e-postası");
    fireEvent.change(screen.getByLabelText("Alıcı"), { target: { value: "ops@example.test" } });
    fireEvent.change(screen.getByLabelText("Senaryo"), { target: { value: "password_reset" } });
    fireEvent.click(screen.getByLabelText(/Kontrollü test gönderimini onaylıyorum/u));
    fireEvent.click(screen.getByRole("button", { name: "Test e-postası gönder" }));

    await waitFor(() => expect(authFetchMock).toHaveBeenCalledTimes(2));
    expect(authFetchMock.mock.calls[1]?.[0]).toBe(apiBaseUrl);
    expect(authFetchMock.mock.calls[1]?.[1]).toBe("/api/v1/admin/email/test-send");
    expect(JSON.parse(String(authFetchMock.mock.calls[1]?.[2]?.body))).toMatchObject({
      confirmation: "SEND_TEST_EMAIL",
      idempotencyKey: "99999999-9999-4999-8999-999999999999",
      intent: "password_reset",
      to: "ops@example.test"
    });
    expect(await screen.findByText("Gönderim kapalı")).toBeInTheDocument();
    expect(screen.getByText("o***@example.test")).toBeInTheDocument();
  });

  it("hides the mutation form for preview principals", async () => {
    authFetchMock.mockResolvedValue(jsonResponse(previewPayload));
    renderPage("user", "preview");
    await screen.findByText("E-posta gönderim sağlığı");
    expect(screen.queryByText("Kontrollü test e-postası")).not.toBeInTheDocument();
  });

  it("reuses the same idempotency key when a network result is retried", async () => {
    authFetchMock
      .mockResolvedValueOnce(jsonResponse(previewPayload))
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        data: {
          intent: "security_alert",
          status: "not_sent",
          provider: "smtp",
          sandboxOnly: true,
          deliveryReference: null,
          recipientMasked: "o***@example.test",
          occurredAt: "2026-07-31T10:00:00.000Z",
          errorCategory: "delivery_disabled",
          message: "Gerçek gönderim operasyon anahtarıyla kapalı."
        }
      }));
    const randomUuid = vi.spyOn(crypto, "randomUUID")
      .mockReturnValue("12121212-1212-4212-8212-121212121212");
    renderPage();

    await screen.findByText("Kontrollü test e-postası");
    fireEvent.change(screen.getByLabelText("Alıcı"), { target: { value: "ops@example.test" } });
    fireEvent.click(screen.getByLabelText(/Kontrollü test gönderimini onaylıyorum/u));
    fireEvent.click(screen.getByRole("button", { name: "Test e-postası gönder" }));
    expect(await screen.findByText(/Ağ bağlantısını kontrol/u)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Test e-postası gönder" }));
    expect(await screen.findByText("Gönderim kapalı")).toBeInTheDocument();

    const firstBody = JSON.parse(String(authFetchMock.mock.calls[1]?.[2]?.body));
    const secondBody = JSON.parse(String(authFetchMock.mock.calls[2]?.[2]?.body));
    expect(secondBody.idempotencyKey).toBe(firstBody.idempotencyKey);
    expect(randomUuid).toHaveBeenCalledTimes(1);
  });

  it("renders a safe preview error", async () => {
    authFetchMock.mockResolvedValue(jsonResponse({ ok: false, error: { code: "FORBIDDEN", message: "Forbidden" } }, false));
    renderPage();
    expect(await screen.findByText("E-posta operasyon durumu yüklenemedi.")).toBeInTheDocument();
    expect(screen.queryByText("Forbidden")).not.toBeInTheDocument();
  });
});
