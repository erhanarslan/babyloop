import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BackofficeAccessProvider } from "../auth/backoffice-access";
import { NotificationOpsPage } from "./notification-ops-page";

const { authFetchMock } = vi.hoisted(() => ({ authFetchMock: vi.fn() }));
vi.mock("../../lib/auth-client", () => ({ authFetch: authFetchMock }));

const data = {
  operationalHealth: {
    worker: { status: "idle", lastHeartbeatAt: "2026-07-31T10:00:00.000Z", lastCompletedAt: "2026-07-31T09:59:00.000Z", lastErrorCode: null },
    providers: { email: true, push: false, n8n: false },
    lastSuccessfulDeliveryAt: "2026-07-31T09:58:00.000Z",
    lastFailedDeliveryAt: null,
    retryScheduledCount: 1,
    deadLetterCount: null
  },
  channels: [
    { key: "in_app", label: "In-app", status: "draft_only", note: "Uygulama içi adaylar güvenli kayıtta izlenir." },
    { key: "n8n_future", label: "n8n", status: "future", note: "Desteklenmiyor" }
  ],
  deliveryPolicy: {
    sendEnabled: false,
    queueEnabled: false,
    emailEnabled: false,
    pushEnabled: false,
    n8nEnabled: false
  },
  deliveryLogPreview: {
    totals: { all: 3, candidate: 1, processing: 1, blocked: 0, sent: 1, failed: 0, skipped: 0 },
    recent: [{
      kind: "saved_search", sourceType: "saved_search", sourceRef: "saved…ing-1", channel: "in_app", status: "candidate",
      provider: "none", providerStatus: null, attemptCount: 0, nextAttemptAt: null,
      claimedAt: null, claimExpiresAt: null, workerId: null, lastErrorCode: null,
      lastErrorMessageRedacted: null,
      skippedReason: null, createdAt: "2026-07-31T09:57:00.000Z"
    }],
    privacyNote: "Yalnız toplu sayaç ve maskeli kaynak referansı gösterilir."
  },
  transitionPreview: {
    deliveryAllowed: false,
    draftOnly: true,
    allowedDraftOnlyTransitions: [
      { from: "candidate", to: "blocked", reason: "draft_only_block" },
      { from: "candidate", to: "skipped", reason: "draft_only_skip" }
    ],
    futureSenderTransitions: [
      { from: "candidate", to: "sent", blockedUntil: ["provider sandbox", "admin audit"] },
      { from: "candidate", to: "failed", blockedUntil: ["provider attempt record"] }
    ],
    privacyNote: "Geçiş özeti hassas veri içermez."
  },
  pushReadinessPreview: {
    pushSenderEnabled: false,
    providerConfigured: false,
    tokenRegistryEnabled: true,
    warning: "Anlık bildirim sağlayıcısı çağrılmaz."
  },
  n8nReadinessPreview: {
    n8nWorkflowEnabled: false,
    webhookConfigured: false,
    queueEnabled: false,
    warning: "n8n çağrısı yapılmaz."
  },
  warning: "Bu görünüm gönderim yapmaz."
};

function response(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

function renderPage(accessMode: "preview" | "staff" = "staff") {
  render(
    <BackofficeAccessProvider accessMode={accessMode} role={accessMode === "staff" ? "admin" : "user"}>
      <NotificationOpsPage apiBaseUrl="http://api.test" />
    </BackofficeAccessProvider>
  );
}

describe("NotificationOpsPage", () => {
  afterEach(() => authFetchMock.mockReset());

  it("renders operational metrics and does not invent unavailable values", async () => {
    authFetchMock.mockResolvedValue(response({ ok: true, data }));
    renderPage();

    expect(await screen.findByText("Bildirim gönderim sağlığı")).toBeInTheDocument();
    expect(screen.getByText("İşleyici sağlığı")).toBeInTheDocument();
    expect(screen.getByText("31 Tem 2026 13:00")).toBeInTheDocument();
    expect(screen.getByText("Ölçülmüyor")).toBeInTheDocument();
    expect(screen.getByText("Bu metrik henüz üretilmiyor")).toBeInTheDocument();
    expect(screen.getByText("Kayıtlı arama · Bekliyor")).toBeInTheDocument();
    expect(screen.getByText("Teslimat geçiş güvenliği")).toBeInTheDocument();
    expect(screen.getByText("Bekliyor → Atlandı")).toBeInTheDocument();
    expect(screen.getByText("Gönderildi/Başarısız için sağlayıcı güvenlik katmanları zorunludur.")).toBeInTheDocument();
    expect(screen.getByText("Anlık bildirim hazırlığı")).toBeInTheDocument();
    expect(screen.getByText("Anlık bildirim göndericisi kapalı. Expo, Firebase veya APNs çağrısı yapılmıyor.")).toBeInTheDocument();
    expect(screen.getByText("n8n iş akışı hazırlığı")).toBeInTheDocument();
    expect(screen.getByText("Webhook kapalı. Kuyruk ve işleyici kapalı. Gerçek n8n iş akışı tetiklemesi yok.")).toBeInTheDocument();
    expect(screen.queryByText("Desteklenmiyor")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sent|candidate|retry/iu })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/parent@example|secret-idempotency|secret-dedup|Bearer secret/iu);
  });

  it("does not render management actions for preview principals", async () => {
    authFetchMock.mockResolvedValue(response({ ok: true, data }));
    renderPage("preview");
    await screen.findByText("Bildirim gönderim sağlığı");
    expect(screen.queryByText("Güvenli yönetim aksiyonları")).not.toBeInTheDocument();
  });

  it("renders a retryable safe error", async () => {
    authFetchMock.mockRejectedValue(new Error("network"));
    renderPage();
    expect(await screen.findByText("Bildirim operasyon durumu alınamadı")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tekrar dene" })).toBeInTheDocument();
  });
});
