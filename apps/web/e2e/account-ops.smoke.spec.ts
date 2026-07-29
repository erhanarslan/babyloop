import { expect, test, type Page, type Route } from "@playwright/test";

type ApiResponse<TData> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

type NotificationType = "message_received" | "listing_favorited" | "listing_status_changed";

type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType: "conversation" | "listing";
  entityId: string;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

type SavedSearch = {
  id: string;
  name: string;
  q: string;
  categoryId: string | null;
  listingType: string | null;
  condition: string | null;
  priceMin: string | null;
  priceMax: string | null;
  hasImages: boolean;
  sort: string;
  notificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type MockState = {
  notifications: Notification[];
  savedSearches: SavedSearch[];
  readAllRequests: number;
  savedSearchNotificationRequests: Array<{
    id: string;
    notificationsEnabled: boolean;
  }>;
  savedSearchDeleteRequests: string[];
  passwordChangeRequests: Array<{
    currentPassword: string;
    newPassword: string;
  }>;
};

const PROFILE_ID = "profile-account-ops-e2e-current";
const LISTING_ID = "listing-account-ops-e2e-1";
const CONVERSATION_ID = "conversation-account-ops-e2e-1";
const SAVED_SEARCH_ID = "saved-search-account-ops-e2e-1";
const SAVED_SEARCH_DELETE_ID = "saved-search-account-ops-e2e-delete";

const RAW_BUYER_EMAIL = "raw-buyer-account-ops-e2e@babyloop.test";
const RAW_FAVORITER_PROFILE_ID = "raw-favoriter-profile-account-ops-e2e";
const RAW_ACCESS_TOKEN = "RAW_ACCESS_TOKEN_ACCOUNT_OPS_E2E_SHOULD_NOT_RENDER";
const RAW_REFRESH_TOKEN = "RAW_REFRESH_TOKEN_ACCOUNT_OPS_E2E_SHOULD_NOT_RENDER";
const RAW_PASSWORD_HASH = "RAW_PASSWORD_HASH_ACCOUNT_OPS_E2E_SHOULD_NOT_RENDER";
const RAW_VERIFICATION_TOKEN = "RAW_VERIFICATION_TOKEN_ACCOUNT_OPS_E2E_SHOULD_NOT_RENDER";
const RAW_MESSAGE_BODY = "RAW_MESSAGE_BODY_ACCOUNT_OPS_E2E_SHOULD_NOT_RENDER";

test.describe("public account operations", () => {
  test("notifications stay privacy-safe and mark-all-read updates page and badge state", async ({ page }) => {
    test.setTimeout(60_000);

    const state = createAccountOpsState();

    await installAccountOpsMocks(page, state);

    await page.goto("/notifications", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Bildirimler", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Mesaj ve ilan hareketlerini burada görebilirsin.", { exact: true })).toBeVisible();

    await expect(page.locator(".market-notifications-trigger")).toContainText("3", {
      timeout: 15_000,
    });

    const notificationSummary = page.getByLabel("Bildirim özeti");

    await expect(notificationSummary.getByText("Okunmamış mesaj", { exact: true })).toBeVisible();
    await expect(notificationSummary.getByText("2 kullanıcı ürünlerini favori ürünlere ekledi", { exact: true })).toBeVisible();
    await expect(notificationSummary.getByRole("link", { name: "Mesajlara git", exact: true })).toHaveAttribute(
      "href",
      "/conversations",
    );

    const favoriteSection = page.getByLabel("Favori hareketleri");
    await expect(favoriteSection.getByRole("link", { name: "Privacy-safe stroller", exact: true })).toHaveAttribute(
      "href",
      `/listings/${LISTING_ID}`,
    );
    await expect(favoriteSection.getByText("2 favori · Bugün +2", { exact: true })).toBeVisible();

    const recentList = page.getByLabel("Son bildirimler");
    await expect(recentList.getByText("Yeni mesaj", { exact: true })).toBeVisible();
    await expect(recentList.getByText("Yeni bir mesajın var.", { exact: true })).toBeVisible();
    await expect(recentList.getByText("Favori hareketi", { exact: true })).toHaveCount(2);
    await expect(recentList.getByText("Bir kullanıcı ürününü favori ürünlere ekledi.", { exact: true })).toHaveCount(2);

    await expectNoAccountOpsSensitiveLeak(page);

    const readAllResponsePromise = page.waitForResponse((response) => {
      return (
        response.url().includes("/api/v1/notifications/read-all") &&
        response.request().method() === "PATCH"
      );
    });

    await page.getByRole("button", { name: "Tümünü okundu işaretle", exact: true }).click();

    const readAllResponse = await readAllResponsePromise;
    expect(readAllResponse.ok(), await readAllResponse.text()).toBe(true);
    expect(state.readAllRequests).toBe(1);

    await expect(page.locator(".market-notifications-trigger")).not.toContainText("3", {
      timeout: 15_000,
    });
    await expect(page.locator(".market-notifications-trigger")).toHaveAttribute("aria-label", "Bildirimler");
    await expect(page.locator(".market-notifications-trigger")).toHaveAttribute("title", "Bildirimler");
    await expect(page.getByRole("button", { name: "Tümünü okundu işaretle", exact: true })).toBeDisabled();
    await expect(recentList.getByText("Okunmadı", { exact: true })).toHaveCount(0);
    await expect(recentList.getByText("Okundu", { exact: true })).toHaveCount(3);

    await expectNoAccountOpsSensitiveLeak(page);
  });

  test("saved searches expose safe filters, notification settings, and two-step deletion", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    const state = createAccountOpsState();

    await installAccountOpsMocks(page, state);

    await page.goto("/account/saved-searches", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Kayıtlı aramalarım", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    const savedSearchIntro = page
      .getByRole("main")
      .locator("p:visible")
      .filter({
        hasText: "Burada kayıtlarını yeniden açabilir",
      });

    await expect(savedSearchIntro).toHaveCount(1);
    await expect(savedSearchIntro).toBeVisible();

    const savedSearchCard = page.locator("article").filter({
      has: page.getByRole("heading", { name: "Bebek arabası takip", exact: true }),
    });

    await expect(savedSearchCard).toBeVisible();
    await expect(savedSearchCard.getByText("Bildirim kapalı", { exact: true })).toBeVisible();
    await expect(savedSearchCard.getByText("Arama: bebek arabası", { exact: true })).toBeVisible();
    await expect(savedSearchCard.getByText("İlan tipi: Satılık", { exact: true })).toBeVisible();
    await expect(savedSearchCard.getByText("Durum: İyi", { exact: true })).toBeVisible();
    await expect(savedSearchCard.getByText("En az: 1.000", { exact: true })).toBeVisible();
    await expect(savedSearchCard.getByText("En çok: 5.000", { exact: true })).toBeVisible();
    await expect(savedSearchCard.getByText("Sıralama: Fiyat: düşükten yükseğe", { exact: true })).toBeVisible();
    const openSearchHref = await savedSearchCard
      .getByRole("link", { name: "Aramayı aç", exact: true })
      .getAttribute("href");

    expect(openSearchHref).toBeTruthy();

    const openSearchUrl = new URL(openSearchHref ?? "", "http://localhost:3000");

    expect(openSearchUrl.pathname).toBe("/browse");
    expect(openSearchUrl.searchParams.get("q")).toBe("bebek arabası");
    expect(openSearchUrl.searchParams.get("categoryId")).toBe("category-strollers-e2e");
    expect(openSearchUrl.searchParams.get("listingType")).toBe("sale");
    expect(openSearchUrl.searchParams.get("condition")).toBe("good");
    expect(openSearchUrl.searchParams.get("priceMin")).toBe("1000");
    expect(openSearchUrl.searchParams.get("priceMax")).toBe("5000");
    expect(openSearchUrl.searchParams.has("hasImages")).toBe(false);
    expect(openSearchUrl.searchParams.get("sort")).toBe("price_asc");

    await expect(savedSearchCard.getByRole("link", { name: "Bildirim ayarları", exact: true })).toHaveAttribute(
      "href",
      "/account/notification-preferences",
    );

    await expectNoAccountOpsSensitiveLeak(page);
    expect(state.savedSearchNotificationRequests).toEqual([]);

    const deleteCard = page.locator("article").filter({
      has: page.getByRole("heading", { name: "Silinecek kayıtlı arama", exact: true }),
    });

    await expect(deleteCard).toBeVisible();

    await deleteCard.getByRole("button", { name: "Sil", exact: true }).click();
    await expect(deleteCard.getByText("Bu kayıt silinsin mi?", { exact: true })).toBeVisible();
    await expect(deleteCard.getByRole("button", { name: "Vazgeç", exact: true })).toBeVisible();
    expect(state.savedSearchDeleteRequests).toEqual([]);

    const deleteResponsePromise = page.waitForResponse((response) => {
      return (
        response.url().includes(`/api/v1/saved-searches/${SAVED_SEARCH_DELETE_ID}`) &&
        response.request().method() === "DELETE"
      );
    });

    await deleteCard.getByRole("button", { name: "Silmeyi onayla", exact: true }).click();

    const deleteResponse = await deleteResponsePromise;
    expect(deleteResponse.ok(), await deleteResponse.text()).toBe(true);
    expect(state.savedSearchDeleteRequests).toEqual([SAVED_SEARCH_DELETE_ID]);

    await expect(deleteCard).toHaveCount(0);

    await expect(savedSearchCard).toBeVisible();

    await expectNoAccountOpsSensitiveLeak(page);
  });

  test("account profile and password security flow validate fields, submit safely, and avoid credential leaks", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    const state = createAccountOpsState();

    await installAccountOpsMocks(page, state);

    await page.goto("/account/profile", { waitUntil: "domcontentloaded" });

    const accountRegion = page.getByLabel("Hesabım");

    await expect(accountRegion.getByRole("heading", { name: "Hesabım", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(accountRegion.getByText("Account Ops Parent", { exact: true })).toBeVisible();
    await expect(accountRegion.getByText("İstanbul", { exact: true })).toBeVisible();

    await accountRegion.getByRole("button", { name: /Pazar kısayolları/ }).click();
    await expect(accountRegion.getByRole("heading", { name: "Pazar kısayolları", exact: true })).toBeVisible();

    await expect(accountRegion.getByRole("link", { name: /Favoriler/ })).toHaveAttribute("href", "/favorites");
    await expect(accountRegion.getByRole("link", { name: /Kayıtlı aramalar/ })).toHaveAttribute(
      "href",
      "/account/saved-searches",
    );
    await expect(accountRegion.getByRole("link", { name: /Mesajlar/ })).toHaveAttribute(
      "href",
      "/conversations",
    );
    await expect(accountRegion.getByRole("link", { name: /Bildirimler/ })).toHaveAttribute(
      "href",
      "/notifications",
    );

    await accountRegion.getByRole("button", { name: /Güvenlik/ }).click();
    await expect(accountRegion.getByRole("heading", { name: "Güvenlik", exact: true })).toBeVisible();

    await expect(accountRegion.getByRole("link", { name: /Şifre Hesap şifreni güncelle/ })).toHaveAttribute(
      "href",
      "/account/password",
    );
    await expect(accountRegion.getByRole("heading", { name: "İki adımlı doğrulama", exact: true })).toBeVisible();
    await expect(accountRegion.getByRole("heading", { name: "Aktif oturumlar", exact: true })).toBeVisible();
    await expect(accountRegion.getByRole("heading", { name: "Tüm oturumları kapat", exact: true })).toBeVisible();

    await expectNoAccountOpsSensitiveLeak(page);

    await page.goto("/account/password", { waitUntil: "domcontentloaded" });

    await expect
      .poll(() => {
        const currentUrl = new URL(page.url());

        return {
          changePassword: currentUrl.searchParams.get("changePassword"),
          pathname: currentUrl.pathname,
          section: currentUrl.searchParams.get("section"),
        };
      }, { timeout: 15_000 })
      .toEqual({
        changePassword: "1",
        pathname: "/account/profile",
        section: "security",
      });

    const passwordDialog = page.getByRole("dialog", { name: "Şifreyi değiştir" });
    await expect(passwordDialog).toBeVisible();

    const passwordUpdateForm = passwordDialog.locator(
      'form:has(input[name="currentPassword"]):has(input[name="newPassword"]):has(input[name="confirmPassword"])',
    );
    await expect(passwordUpdateForm).toHaveCount(1);
    await expect(passwordUpdateForm).toBeVisible();

    const currentPasswordInput = passwordUpdateForm.locator('input[name="currentPassword"]');
    const newPasswordInput = passwordUpdateForm.locator('input[name="newPassword"]');
    const confirmPasswordInput = passwordUpdateForm.locator('input[name="confirmPassword"]');

    await expect(passwordUpdateForm.getByText("Mevcut şifre", { exact: true })).toBeVisible();
    await expect(passwordUpdateForm.getByText("Yeni şifre", { exact: true })).toBeVisible();
    await expect(passwordUpdateForm.getByText("Yeni şifre tekrar", { exact: true })).toBeVisible();
    await expect(currentPasswordInput).toHaveAttribute("name", "currentPassword");
    await expect(newPasswordInput).toHaveAttribute("name", "newPassword");
    await expect(confirmPasswordInput).toHaveAttribute("name", "confirmPassword");

    await currentPasswordInput.fill("CurrentPassword123!");
    await newPasswordInput.fill("NewPassword123!");
    await confirmPasswordInput.fill("DifferentPassword123!");

    await passwordUpdateForm.getByRole("button", { name: /Şifreyi değiştir|Change password/i }).click();

    await page.waitForTimeout(300);
    const invalidPasswordUrl = new URL(page.url());
    expect(invalidPasswordUrl.pathname).toBe("/account/profile");
    expect(invalidPasswordUrl.searchParams.get("section")).toBe("security");
    expect(invalidPasswordUrl.searchParams.get("changePassword")).toBe("1");
    expect(state.passwordChangeRequests).toEqual([]);

    const passwordForm = passwordUpdateForm;

    await confirmPasswordInput.fill("NewPassword123!");

    await expect(currentPasswordInput).toHaveValue("CurrentPassword123!");
    await expect(newPasswordInput).toHaveValue("NewPassword123!");
    await expect(confirmPasswordInput).toHaveValue("NewPassword123!");

    const passwordResponsePromise = page.waitForResponse((response) => {
      return (
        response.url().includes("/api/v1/auth/password/change") &&
        response.request().method() === "POST"
      );
    });
    await passwordForm.getByRole("button", { name: /Şifreyi değiştir|Change password/i }).click();

    const passwordResponse = await passwordResponsePromise;
    expect(passwordResponse.ok(), await passwordResponse.text()).toBe(true);
    expect(state.passwordChangeRequests).toEqual([
      {
        currentPassword: "CurrentPassword123!",
        newPassword: "NewPassword123!",
      },
    ]);

    await expect(page).toHaveURL(/\/$/, {
      timeout: 15_000,
    });
    await expect(page.getByRole("dialog", { name: "Şifren değişti, yeniden giriş yap" })).toBeVisible();

    await expectNoAccountOpsSensitiveLeak(page);
    await expect(page.getByText("CurrentPassword123!", { exact: true })).toHaveCount(0);
    await expect(page.getByText("NewPassword123!", { exact: true })).toHaveCount(0);
  });
});

async function installAccountOpsMocks(page: Page, state: MockState): Promise<void> {
  await page.route("**/api/v1/**", async (route) => {
    if (await fulfillOptions(route)) {
      return;
    }

    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (method === "GET" && pathEndsWith(url, "/api/v1/auth/me")) {
      await fulfillJson(route, {
        ok: true,
        data: createCurrentUserPayload(),
      });
      return;
    }

    if (method === "POST" && pathEndsWith(url, "/api/v1/auth/refresh")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          ...createCurrentUserPayload(),
          accessToken: "mock-public-account-ops-token",
        },
      });
      return;
    }

    if (method === "POST" && pathEndsWith(url, "/api/v1/auth/login")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          ...createCurrentUserPayload(),
          accessToken: "mock-public-account-ops-token",
        },
      });
      return;
    }

    if (method === "GET" && pathEndsWith(url, "/api/v1/auth/csrf")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          csrfToken: "public-account-ops-e2e-csrf",
        },
      });
      return;
    }

    if (method === "GET" && pathEndsWith(url, "/api/v1/auth/mfa/status")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          delivery: "email",
          method: "email_otp",
          mfaEnabled: false,
        },
      });
      return;
    }

    if (method === "GET" && pathEndsWith(url, "/api/v1/auth/sessions")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          sessions: [],
        },
      });
      return;
    }

    if (method === "GET" && pathEndsWith(url, "/api/v1/notifications/unread-count")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          count: getUnreadNotificationCount(state),
        },
      });
      return;
    }

    if (method === "GET" && pathEndsWith(url, "/api/v1/notifications")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          notifications: state.notifications,
        },
      });
      return;
    }

    if (method === "PATCH" && pathEndsWith(url, "/api/v1/notifications/read-all")) {
      state.readAllRequests += 1;
      const readAt = "2026-06-28T12:45:00.000Z";
      state.notifications = state.notifications.map((notification) => ({
        ...notification,
        readAt: notification.readAt ?? readAt,
      }));

      await fulfillJson(route, {
        ok: true,
        data: {
          updatedCount: 3,
        },
      });
      return;
    }

    if (method === "GET" && pathEndsWith(url, "/api/v1/saved-searches")) {
      await fulfillJson(route, {
        ok: true,
        data: {
          savedSearches: state.savedSearches,
        },
      });
      return;
    }

    if (method === "PATCH" && pathEndsWith(url, `/api/v1/saved-searches/${SAVED_SEARCH_ID}/notifications`)) {
      const body = (await request.postDataJSON()) as {
        notificationsEnabled?: boolean;
      };
      const notificationsEnabled = Boolean(body.notificationsEnabled);

      state.savedSearchNotificationRequests.push({
        id: SAVED_SEARCH_ID,
        notificationsEnabled,
      });

      state.savedSearches = state.savedSearches.map((savedSearch) =>
        savedSearch.id === SAVED_SEARCH_ID
          ? {
              ...savedSearch,
              notificationsEnabled,
              updatedAt: "2026-06-28T12:50:00.000Z",
            }
          : savedSearch,
      );

      await fulfillJson(route, {
        ok: true,
        data: {
          savedSearch: state.savedSearches.find((savedSearch) => savedSearch.id === SAVED_SEARCH_ID)!,
        },
      });
      return;
    }

    if (method === "DELETE" && pathEndsWith(url, `/api/v1/saved-searches/${SAVED_SEARCH_DELETE_ID}`)) {
      state.savedSearchDeleteRequests.push(SAVED_SEARCH_DELETE_ID);
      state.savedSearches = state.savedSearches.filter((savedSearch) => savedSearch.id !== SAVED_SEARCH_DELETE_ID);

      await fulfillJson(route, {
        ok: true,
        data: {
          deleted: true,
        },
      });
      return;
    }

    if (method === "POST" && pathEndsWith(url, "/api/v1/auth/password/change")) {
      const body = (await request.postDataJSON()) as {
        currentPassword?: string;
        newPassword?: string;
      };

      state.passwordChangeRequests.push({
        currentPassword: body.currentPassword ?? "",
        newPassword: body.newPassword ?? "",
      });

      await fulfillJson(route, {
        ok: true,
        data: {
          passwordChanged: true,
        },
      });
      return;
    }

    await fulfillJson(
      route,
      {
        ok: false,
        error: {
          code: "WEB_E2E_UNHANDLED_ACCOUNT_OPS_ROUTE",
          message: `Unhandled account ops E2E route: ${method} ${url.pathname}`,
        },
      },
      500,
    );
  });
}

function createAccountOpsState(): MockState {
  const todayIso = new Date().toISOString();

  return {
    notifications: [
      {
        id: "notification-message-account-ops-e2e",
        type: "message_received",
        title: RAW_MESSAGE_BODY,
        body: RAW_BUYER_EMAIL,
        entityType: "conversation",
        entityId: CONVERSATION_ID,
        metadata: {
          senderEmail: RAW_BUYER_EMAIL,
          senderProfileId: RAW_FAVORITER_PROFILE_ID,
          rawBody: RAW_MESSAGE_BODY,
        },
        readAt: null,
        createdAt: todayIso,
      },
      {
        id: "notification-favorite-account-ops-e2e-1",
        type: "listing_favorited",
        title: RAW_BUYER_EMAIL,
        body: RAW_FAVORITER_PROFILE_ID,
        entityType: "listing",
        entityId: LISTING_ID,
        metadata: {
          listingTitle: "Privacy-safe stroller",
          favoriterEmail: RAW_BUYER_EMAIL,
          favoriterProfileId: RAW_FAVORITER_PROFILE_ID,
        },
        readAt: null,
        createdAt: todayIso,
      },
      {
        id: "notification-favorite-account-ops-e2e-2",
        type: "listing_favorited",
        title: RAW_BUYER_EMAIL,
        body: RAW_FAVORITER_PROFILE_ID,
        entityType: "listing",
        entityId: LISTING_ID,
        metadata: {
          listingTitle: "Privacy-safe stroller",
          favoriterEmail: RAW_BUYER_EMAIL,
          favoriterProfileId: RAW_FAVORITER_PROFILE_ID,
        },
        readAt: null,
        createdAt: todayIso,
      },
    ],
    savedSearches: [
      {
        id: SAVED_SEARCH_ID,
        name: "Bebek arabası takip",
        q: "bebek arabası",
        categoryId: "category-strollers-e2e",
        listingType: "sale",
        condition: "good",
        priceMin: "1000",
        priceMax: "5000",
        hasImages: true,
        sort: "price_asc",
        notificationsEnabled: false,
        createdAt: "2026-06-28T11:00:00.000Z",
        updatedAt: "2026-06-28T11:00:00.000Z",
      },
      {
        id: SAVED_SEARCH_DELETE_ID,
        name: "Silinecek kayıtlı arama",
        q: "oto koltuğu",
        categoryId: null,
        listingType: null,
        condition: null,
        priceMin: null,
        priceMax: null,
        hasImages: false,
        sort: "newest",
        notificationsEnabled: false,
        createdAt: "2026-06-28T10:00:00.000Z",
        updatedAt: "2026-06-28T10:00:00.000Z",
      },
    ],
    readAllRequests: 0,
    savedSearchNotificationRequests: [],
    savedSearchDeleteRequests: [],
    passwordChangeRequests: [],
  };
}

function createCurrentUserPayload() {
  return {
    user: {
      id: "user-account-ops-e2e",
      email: "account-ops-parent@babyloop.test",
      emailVerifiedAt: "2026-06-28T11:00:00.000Z",
    },
    profile: {
      id: PROFILE_ID,
      displayName: "Account Ops Parent",
      locationCity: "İstanbul",
      avatarUrl: null,
    },
  };
}

function getUnreadNotificationCount(state: MockState): number {
  return state.notifications.filter((notification) => !notification.readAt).length;
}

async function expectNoAccountOpsSensitiveLeak(page: Page): Promise<void> {
  await expect(page.getByText(RAW_BUYER_EMAIL, { exact: true })).toHaveCount(0);
  await expect(page.getByText(RAW_FAVORITER_PROFILE_ID, { exact: true })).toHaveCount(0);
  await expect(page.getByText(RAW_ACCESS_TOKEN, { exact: true })).toHaveCount(0);
  await expect(page.getByText(RAW_REFRESH_TOKEN, { exact: true })).toHaveCount(0);
  await expect(page.getByText(RAW_PASSWORD_HASH, { exact: true })).toHaveCount(0);
  await expect(page.getByText(RAW_VERIFICATION_TOKEN, { exact: true })).toHaveCount(0);
  await expect(page.getByText(RAW_MESSAGE_BODY, { exact: true })).toHaveCount(0);
}

async function fulfillOptions(route: Route): Promise<boolean> {
  if (route.request().method().toUpperCase() !== "OPTIONS") {
    return false;
  }

  await route.fulfill({
    status: 204,
    headers: getCorsHeaders(route),
  });

  return true;
}

async function fulfillJson<TData>(
  route: Route,
  response: ApiResponse<TData>,
  status = response.ok ? 200 : 400,
): Promise<void> {
  await route.fulfill({
    status,
    headers: {
      ...getCorsHeaders(route),
      "content-type": "application/json",
    },
    body: JSON.stringify(response),
  });
}

function getCorsHeaders(route: Route): Record<string, string> {
  const origin = route.request().headers().origin ?? "http://localhost:3000";

  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,x-babyloop-csrf-token",
  };
}

function pathEndsWith(url: URL, suffix: string): boolean {
  return url.pathname === suffix || url.pathname.endsWith(suffix);
}
