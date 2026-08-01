import { expect, test, type Page, type Route } from "@playwright/test";

const ADMIN_AUTH = {
  accessMode: "staff",
  user: {
    id: "ops-observability-admin",
    email: "ops-observability-admin@babyloop.test",
    role: "admin",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    profileId: "ops-observability-admin-profile",
    displayName: "Operasyon Test Yöneticisi",
    locationCity: "İstanbul"
  }
};

test.describe("backoffice operations observability", () => {
  test.beforeEach(async ({ page }) => {
    await installAdminAuth(page);
  });

  test("renders canonical analytics fixture metrics with freshness", async ({ page }) => {
    await page.route("**/api/v1/admin/analytics/**", async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.endsWith("/overview")) {
        await fulfillJson(route, { ok: true, data: { overview: analyticsOverviewFixture() } });
        return;
      }
      if (pathname.endsWith("/pages")) {
        await fulfillJson(route, { ok: true, data: { pages: [] } });
        return;
      }
      await fulfillNotFound(route);
    });

    await page.goto("/analytics", { waitUntil: "domcontentloaded" });

    const overview = page.getByRole("region", { name: "Analitik genel bakış" });
    await expect(page.getByRole("heading", { name: "Genel Bakış", exact: true })).toBeVisible();
    await expect(overview.getByText("2 kayıt", { exact: true })).toBeVisible();
    await expect(overview.getByText("11 ilan görüntüleme", { exact: true })).toBeVisible();
    await expect(overview.getByText("4 soru", { exact: true })).toBeVisible();
    await expect(overview.getByText("1 profil oluşturma", { exact: true })).toBeVisible();
    await expect(page.getByText("Toplanmış veri güncel değil", { exact: true })).toBeVisible();
    await expect(page.getByText("Son dönem ham olayları", { exact: true })).toBeVisible();
    await expect(page.getByText("Henüz sayfa veya ekran olayı yok", { exact: true })).toBeVisible();
  });

  test("shows measured notification health and keeps unsupported actions unavailable", async ({ page }) => {
    await page.route("**/api/v1/admin/notifications/ops-preview", (route) => fulfillJson(route, {
      ok: true,
      data: notificationFixture()
    }));
    await page.route("**/api/v1/admin/email/ops-preview", (route) => fulfillJson(route, {
      ok: true,
      data: emailFixture()
    }));

    await page.goto("/notifications", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Bildirim gönderim sağlığı", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "İşleyici sağlığı", exact: true })).toBeVisible();
    await expect(page.getByText("Ölçülmüyor", { exact: true })).toBeVisible();
    await expect(page.getByText("31 Tem 2026 13:04", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /gönder|yeniden dene|durum geçişi/iu })).toHaveCount(0);

    await page.goto("/email", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "E-posta gönderim sağlığı", exact: true })).toBeVisible();
    await expect(page.getByText("Kontrollü test e-postası", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Test e-postası gönder", exact: true })).toBeVisible();
    await expect(page.getByText(/SMTP_HOST|SMTP_PASS|RESEND_API_KEY/u)).toHaveCount(0);
  });

  test("keeps RAG playground and documents visible when health fails safely", async ({ page }) => {
    await page.route("**/api/v1/admin/rag/**", (route) => fulfillRag(route));

    await page.goto("/rag", { waitUntil: "domcontentloaded" });

    await expect(page.getByText("RAG durumu alınamadı", { exact: true })).toBeVisible();
    await expect(page.getByText("Güvenli hata kodu: RAG_HEALTH_FAILED", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "RAG Deneme Alanı", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dokümanlar", exact: true })).toBeVisible();
    await expect(page.getByText(/Internal server error|raw-rag-secret/iu)).toHaveCount(0);
  });
});

async function installAdminAuth(page: Page): Promise<void> {
  await page.route("**/auth/backoffice/me**", (route) => fulfillJson(route, { ok: true, data: ADMIN_AUTH }));
  await page.route("**/auth/backoffice/refresh**", (route) => fulfillJson(route, { ok: true, data: ADMIN_AUTH }));
  await page.route("**/auth/backoffice/csrf**", (route) => fulfillJson(route, {
    ok: true,
    data: { csrfToken: "local-ops-observability-csrf" }
  }));
}

function analyticsOverviewFixture() {
  return {
    totalRegisteredUsers: 8,
    demoSystemAccounts: 2,
    loginDisabledAccounts: 1,
    verifiedUsers: 6,
    verifiedRate: 75,
    googleLinkedUsers: 3,
    googleLinkedRate: 37.5,
    passwordUsers: 5,
    dau: 5,
    activeUsers: 5,
    activeCustomerUsers: 4,
    sessions: 7,
    averageSessionEngagementMs: 61_000,
    pageViews: 20,
    screenViews: 3,
    listingViews: 11,
    uniqueListingViewers: 6,
    favoriteUsers: 3,
    chatUsers: 2,
    messageSenders: 2,
    conversationsStarted: 2,
    assistantUsers: 3,
    assistantQuestions: 4,
    assistantAnswers: 3,
    assistantErrors: 1,
    assistantGroundedAnswers: 2,
    assistantGroundedRate: 66.67,
    registrations: 2,
    successfulLogins: 4,
    failedLogins: 1,
    googleSuccessfulLogins: 2,
    emailVerifications: 2,
    mfaCompletions: 1,
    checkoutUsers: 1,
    searches: 5,
    contactIntents: 2,
    messagesSent: 3,
    messagesRead: 2,
    activeMessagingParticipants: 2,
    childProfilesCreated: 1,
    childNotesCreated: 2,
    childRemindersCreated: 3,
    rawEventsInRange: 55,
    lastRawEventAt: "2026-07-31T10:00:00.000Z",
    lastRollupAt: null,
    aggregationStatus: "pending",
    dataSource: "raw_recent"
  };
}

function notificationFixture() {
  return {
    operationalHealth: {
      worker: {
        status: "idle",
        lastHeartbeatAt: "2026-07-31T10:04:00.000Z",
        lastCompletedAt: "2026-07-31T10:03:00.000Z",
        lastErrorCode: null
      },
      providers: { email: false, push: false, n8n: false },
      lastSuccessfulDeliveryAt: "2026-07-31T10:02:00.000Z",
      lastFailedDeliveryAt: null,
      retryScheduledCount: 1,
      deadLetterCount: null
    },
    channels: [
      { key: "in_app", label: "Uygulama içi", status: "draft_only", note: "Gönderim kapalı." },
      { key: "push_future", label: "Anlık bildirim", status: "future", note: "Henüz kullanılamıyor." }
    ],
    deliveryPolicy: {
      sendEnabled: false,
      queueEnabled: false,
      emailEnabled: false,
      pushEnabled: false,
      n8nEnabled: false
    },
    deliveryLogPreview: {
      totals: { all: 3, candidate: 1, processing: 0, blocked: 0, sent: 2, failed: 0, skipped: 0 },
      recent: [],
      privacyNote: "Yalnız güvenli toplu bilgiler gösterilir."
    },
    transitionPreview: {
      deliveryAllowed: false,
      draftOnly: true,
      allowedDraftOnlyTransitions: [],
      futureSenderTransitions: [],
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
    warning: "Bu uç nokta bildirim göndermez."
  };
}

function emailFixture() {
  return {
    emailProvider: {
      driver: "smtp",
      sendEnabled: false,
      fromConfigured: true,
      providerConfigured: true,
      sandboxOnly: true,
      missingConfigurationCount: 0,
      senderDomainVerified: null
    },
    recipientPolicyConfigured: true,
    supportedIntents: ["email_verification", "password_reset", "notification_digest", "security_alert"],
    warning: "Gönderim kapalı; kontrollü test isteği sağlayıcıya iletilmez."
  };
}

async function fulfillRag(route: Route): Promise<void> {
  const pathname = new URL(route.request().url()).pathname;
  if (pathname.endsWith("/health")) {
    await fulfillJson(route, {
      ok: false,
      error: { code: "RAG_HEALTH_FAILED", message: "Internal server error raw-rag-secret" }
    }, 500);
    return;
  }

  const responses: Record<string, unknown> = {
    "/documents": { ok: true, data: { documents: [] } },
    "/cache/stats": { ok: true, data: { cache: { enabled: false, backend: "disabled", backendEffective: "disabled", entries: 0, hits: 0, misses: 0, sets: 0, clears: 0, hitRate: 0 } } },
    "/eval/cases": { ok: true, data: { cases: [] } },
    "/eval/history": { ok: true, data: { runs: [] } },
    "/reindex/check": { ok: true, data: { totalDocuments: 0, reindexRequired: 0, stale: 0, missing: 0, unknown: 0, documents: [] } },
    "/metrics": { ok: true, data: { metrics: { enabled: false, backend: "disabled", backendEffective: "disabled", date: "2026-07-31", counters: {}, byIntent: {}, byMode: {}, byTopic: {} } } },
    "/usage": { ok: true, data: { usage: { enabled: false, backend: "disabled", backendEffective: "disabled", limits: { hourlyGuest: 0, dailyGuest: 0, hourlyUser: 0, dailyUser: 0, adminBypass: true } } } }
  };
  const match = Object.entries(responses).find(([suffix]) => pathname.endsWith(suffix));
  if (match) {
    await fulfillJson(route, match[1]);
    return;
  }
  await fulfillNotFound(route);
}

async function fulfillNotFound(route: Route): Promise<void> {
  await fulfillJson(route, { ok: false, error: { code: "NOT_FOUND", message: "Bulunamadı." } }, 404);
}

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ body: JSON.stringify(body), contentType: "application/json", status });
}
