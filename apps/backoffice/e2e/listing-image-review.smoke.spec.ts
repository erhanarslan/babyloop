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

type AdminListingImageReviewStatus = "pending" | "approved" | "needs_review" | "rejected";
type AdminListingImageAction = "approve" | "reject";

type AdminListingImage = {
  id: string;
  url: string;
  sortOrder: number;
  reviewStatus: AdminListingImageReviewStatus;
  reviewedAt: string | null;
  reviewedByProfileId: string | null;
  authenticity: {
    decision: "allow" | "needs_review" | "reject" | null;
    confidence: number | null;
    providerName: string | null;
    modelName: string | null;
    promptVersion: string | null;
    reasons: string[];
    flags: Record<string, unknown>;
    checkedAt: string | null;
  };
  createdAt: string;
};

type AdminListingDetail = {
  id: string;
  title: string;
  description: string | null;
  price: {
    amount: string;
    currency: string;
  } | null;
  currency: string;
  status: "active";
  listingType: "sale";
  condition: "good";
  category: {
    id: string;
    name: string;
    slug: string;
  };
  seller: {
    profileId: string;
    displayName: string;
    locationCity: string | null;
    createdAt: string;
  };
  primaryImage: AdminListingImage | null;
  imageCount: number;
  moderation: {
    relatedCaseCount: number;
    openRelatedCaseCount: number;
  };
  createdAt: string;
  updatedAt: string;
  images: AdminListingImage[];
  relatedModerationCases: [];
  actionEligibility: {
    canArchive: boolean;
    canRestore: boolean;
    supportedActions: ["archive"];
  };
  auditTrail: Array<{
    id: string;
    eventType: string;
    createdAt: string;
    actor: {
      id: string;
      displayName: string;
    };
    metadata: Record<string, string | number | boolean | string[] | null>;
  }>;
};

type MockState = {
  listing: AdminListingDetail;
  imageActionRequests: Array<{
    action: AdminListingImageAction;
    reason: string;
  }>;
  failNextImageAction?: boolean;
  forceDetailNotFound?: boolean;
};

const ADMIN_AUTH = {
  user: {
    id: "admin-user-e2e",
    email: "admin-image-review-e2e@babyloop.test",
    role: "admin",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    profileId: "admin-profile-e2e",
    displayName: "Backoffice E2E Admin",
    locationCity: "İstanbul",
  },
};

const RAW_EMAIL_SENTINEL = "raw-admin-image-review-private@example.test";
const RAW_PHONE_SENTINEL = "+905551119988";
const RAW_TOKEN_SENTINEL = "sk-admin-image-review-secret-token";
const RAW_MESSAGE_SENTINEL = "RAW_ADMIN_IMAGE_REVIEW_PRIVATE_MESSAGE_BODY";
const RAW_PROMPT_SENTINEL = "RAW_ADMIN_IMAGE_REVIEW_AI_PROMPT";
const IMAGE_ACTION_FAILURE_MESSAGE = "Image review service temporarily failed.";
const E2E_LISTING_ID = "admin-listing-e2e-1";
const E2E_IMAGE_ID = "admin-image-e2e-1";

test.describe("backoffice listing image review", () => {
  test("admin can open review queue, approve a needs-review image, and see audit state", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    const state = createImageReviewState();

    await installBackofficeMocks(page, state);

    await openReviewQueue(page, state);

    const imageCard = await openListingImageReview(page, state);
    const imageId = state.listing.images[0]!.id;

    await submitImageReviewAction({
      action: "approve",
      imageCard,
      imageId,
      page,
      reason: "Looks like a real stroller product photo.",
      state,
    });

    expect(state.imageActionRequests).toEqual([
      {
        action: "approve",
        reason: "Looks like a real stroller product photo.",
      },
    ]);

    await expect(imageCard).toHaveAttribute("data-admin-image-review-status", "approved", {
      timeout: 15_000,
    });
    await expect(imageCard.locator('[data-admin-image-review-status-label="approved"]')).toBeVisible();
    await expect(page.getByText("Görsel incelemesi denetlendi: audit-image-review-e2e-1")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Görsel onaylandı", { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await page.goto("/listings", { waitUntil: "domcontentloaded" });
    await filterNeedsReviewImages(page);

    await expect(page.getByText("İlan bulunamadı", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator(`[data-admin-listing-id="${state.listing.id}"]`)).toHaveCount(0);
    await expectNoImageReviewPrivateLeak(page);
  });

  test("admin can reject a needs-review image and see rejected audit state without private leaks", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    const state = createImageReviewState();

    await installBackofficeMocks(page, state);
    await openReviewQueue(page, state);

    const imageCard = await openListingImageReview(page, state);
    const imageId = state.listing.images[0]!.id;

    await submitImageReviewAction({
      action: "reject",
      imageCard,
      imageId,
      page,
      reason: "Rejecting catalog-like image after manual marketplace review.",
      state,
    });

    expect(state.imageActionRequests).toEqual([
      {
        action: "reject",
        reason: "Rejecting catalog-like image after manual marketplace review.",
      },
    ]);

    await expect(imageCard).toHaveAttribute("data-admin-image-review-status", "rejected", {
      timeout: 15_000,
    });
    await expect(imageCard.locator('[data-admin-image-review-status-label="rejected"]')).toBeVisible();
    await expect(page.getByText("Görsel reddedildi", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Görsel incelemesi denetlendi: audit-image-review-e2e-1")).toBeVisible({
      timeout: 15_000,
    });

    await page.goto("/listings", { waitUntil: "domcontentloaded" });
    await filterNeedsReviewImages(page);

    await expect(page.getByText("İlan bulunamadı", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator(`[data-admin-listing-id="${state.listing.id}"]`)).toHaveCount(0);
    await expectNoImageReviewPrivateLeak(page);
  });

  test("admin cannot submit image review without a useful reason", async ({ page }) => {
    const state = createImageReviewState();

    await installBackofficeMocks(page, state);
    await openReviewQueue(page, state);

    const imageCard = await openListingImageReview(page, state);
    const imageId = state.listing.images[0]!.id;
    const submitButton = imageCard.locator(`[data-admin-image-review-submit="${imageId}"]`);

    await expect(submitButton).toBeDisabled();
    await imageCard.locator(`[data-admin-image-review-reason="${imageId}"]`).fill("short");
    await expect(submitButton).toBeDisabled();

    expect(state.imageActionRequests).toEqual([]);
    await expect(imageCard).toHaveAttribute("data-admin-image-review-status", "needs_review");
    await expectNoImageReviewPrivateLeak(page);
  });

  test("admin sees safe image review API failure state without raw private data", async ({ page }) => {
    const state = createImageReviewState();

    state.failNextImageAction = true;

    await installBackofficeMocks(page, state);
    await openReviewQueue(page, state);

    const imageCard = await openListingImageReview(page, state);
    const imageId = state.listing.images[0]!.id;

    await imageCard.locator(`[data-admin-image-review-action="${imageId}"]`).selectOption("reject");
    await imageCard
      .locator(`[data-admin-image-review-reason="${imageId}"]`)
      .fill("Rejecting because the image review provider failed safely.");

    const reviewResponsePromise = page.waitForResponse((response) => {
      return (
        response.url().includes(`/api/v1/admin/listings/${state.listing.id}/images/${imageId}/actions`) &&
        response.request().method() === "POST"
      );
    });

    await imageCard.locator(`[data-admin-image-review-submit="${imageId}"]`).click();

    const reviewResponse = await reviewResponsePromise;
    expect(reviewResponse.ok()).toBe(false);
    expect(state.imageActionRequests).toEqual([]);

    await expect(imageCard.getByRole("alert").filter({ hasText: "Görsel incelenemedi." })).toBeVisible({
      timeout: 15_000,
    });
    await expect(imageCard.getByText(IMAGE_ACTION_FAILURE_MESSAGE, { exact: true })).toHaveCount(0);
    await expect(imageCard).toHaveAttribute("data-admin-image-review-status", "needs_review");
    await expectNoImageReviewPrivateLeak(page);
  });

  test("admin sees safe listing detail not-found state without raw private data", async ({ page }) => {
    const state = createImageReviewState();

    state.forceDetailNotFound = true;

    await installBackofficeMocks(page, state);

    await page.goto(`/listings/${state.listing.id}`, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Backoffice", exact: true })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "İlan yüklenemedi." })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: state.listing.title, exact: true })).toHaveCount(0);
    await expectNoImageReviewPrivateLeak(page);
  });
});

async function openReviewQueue(page: Page, state: MockState): Promise<void> {
  await page.goto("/listings", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "İlan inceleme", exact: true })).toBeVisible({
    timeout: 15_000,
  });

  await filterNeedsReviewImages(page);

  const listingCard = page.locator(`[data-admin-listing-id="${state.listing.id}"]`);
  await expect(listingCard).toBeVisible({ timeout: 15_000 });
  await expect(listingCard).toHaveAttribute("data-admin-primary-image-review-status", "needs_review");
  await expect(listingCard.getByText("Görsel incelemesi", { exact: true })).toBeVisible();
  await expectNoImageReviewPrivateLeak(page);
}

async function filterNeedsReviewImages(page: Page): Promise<void> {
  const filters = page.locator("form.filter-panel");

  await filters.getByLabel("Görsel inceleme").selectOption("needs_review");

  const filteredListingsResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());

    return (
      url.pathname === "/api/v1/admin/listings" &&
      url.searchParams.get("imageReviewStatus") === "needs_review" &&
      response.request().method() === "GET"
    );
  });

  await filters.getByRole("button", { name: "Filtreleri uygula", exact: true }).click();

  const filteredListingsResponse = await filteredListingsResponsePromise;
  expect(filteredListingsResponse.ok(), await filteredListingsResponse.text()).toBe(true);
}

async function openListingImageReview(page: Page, state: MockState) {
  const listingCard = page.locator(`[data-admin-listing-id="${state.listing.id}"]`);

  await listingCard.getByRole("link", { name: "İncelemeyi aç", exact: true }).click();

  await expect(page).toHaveURL(new RegExp(`/listings/${state.listing.id}$`), {
    timeout: 15_000,
  });
  await expect(page.getByRole("heading", { name: state.listing.title, exact: true })).toBeVisible({
    timeout: 15_000,
  });

  const awaitingReviewPanel = page.locator(
    `[data-admin-images-awaiting-review-panel="${state.listing.id}"]`,
  );

  await expect(awaitingReviewPanel).toBeVisible();
  await expect(awaitingReviewPanel.getByText("İnceleme bekleyen görseller", { exact: true })).toBeVisible();
  await expect(page.getByText("Onaylanana kadar herkese açık görünmez", { exact: true })).toBeVisible();

  const imageId = state.listing.images[0]!.id;
  const imageCard = page.locator(`[data-admin-image-id="${imageId}"]`);

  await expect(imageCard).toBeVisible({ timeout: 15_000 });
  await expect(imageCard).toHaveAttribute("data-admin-image-review-status", "needs_review");
  await expect(imageCard.locator('[data-admin-image-review-status-label="needs_review"]')).toBeVisible();

  await expect(imageCard.getByText("AI kararı")).toBeVisible();
  await expect(imageCard.locator('[data-admin-image-review-status-label="needs_review"]')).toHaveText("İnceleme gerekli");
  await expect(imageCard.getByText("gemini", { exact: true })).toBeVisible();
  await expect(imageCard.getByText("gemini-2.5-flash", { exact: true })).toBeVisible();
  await expect(
    imageCard.getByText("listing_image_authenticity.gemini.v1", { exact: true }),
  ).toBeVisible();
  await expectNoImageReviewPrivateLeak(page);

  return imageCard;
}

async function submitImageReviewAction(input: {
  action: AdminListingImageAction;
  imageCard: ReturnType<Page["locator"]>;
  imageId: string;
  page: Page;
  reason: string;
  state: MockState;
}): Promise<void> {
  await input.imageCard
    .locator(`[data-admin-image-review-action="${input.imageId}"]`)
    .selectOption(input.action);
  await input.imageCard
    .locator(`[data-admin-image-review-reason="${input.imageId}"]`)
    .fill(input.reason);

  const reviewResponsePromise = input.page.waitForResponse((response) => {
    return (
      response.url().includes(`/api/v1/admin/listings/${input.state.listing.id}/images/${input.imageId}/actions`) &&
      response.request().method() === "POST"
    );
  });

  await input.imageCard.locator(`[data-admin-image-review-submit="${input.imageId}"]`).click();

  const reviewResponse = await reviewResponsePromise;
  expect(reviewResponse.ok(), await reviewResponse.text()).toBe(true);
}

async function installBackofficeMocks(page: Page, state: MockState): Promise<void> {
  await page.route("**/api/v1/auth/backoffice/refresh", async (route) => {
    await fulfillJson(route, {
      ok: true,
      data: ADMIN_AUTH,
    });
  });

  await page.route("**/api/v1/auth/backoffice/me", async (route) => {
    await fulfillJson(route, {
      ok: true,
      data: ADMIN_AUTH,
    });
  });

  await page.route("**/api/v1/auth/backoffice/csrf", async (route) => {
    await fulfillJson(route, {
      ok: true,
      data: {
        csrfToken: "backoffice-e2e-csrf",
      },
    });
  });

  await page.route("**/api/v1/admin/listings**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();

    if (method === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: getCorsHeaders(route),
      });
      return;
    }

    if (url.pathname === "/api/v1/admin/listings/publication-settings" && method === "GET") {
      await fulfillJson(route, {
        ok: true,
        data: {
          settings: {
            adminReviewEnabled: false,
            autoPublishDelaySeconds: 30,
            updatedByProfileId: null,
            updatedAt: "2026-01-01T10:00:00.000Z",
          },
        },
      });
      return;
    }

    if (url.pathname === "/api/v1/admin/listings" && method === "GET") {
      await fulfillJson(route, {
        ok: true,
        data: {
          listings: getFilteredListings(state, url.searchParams),
        },
      });
      return;
    }

    if (url.pathname === `/api/v1/admin/listings/${state.listing.id}` && method === "GET") {
      if (state.forceDetailNotFound) {
        await fulfillJson(
          route,
          {
            ok: false,
            error: {
              code: "NOT_FOUND",
              message: "Listing was not found.",
              rawEmail: RAW_EMAIL_SENTINEL,
              rawPhone: RAW_PHONE_SENTINEL,
              accessToken: RAW_TOKEN_SENTINEL,
              rawMessageBody: RAW_MESSAGE_SENTINEL,
              rawPrompt: RAW_PROMPT_SENTINEL,
            },
          } as ApiResponse<never>,
          404,
        );
        return;
      }

      await fulfillJson(route, {
        ok: true,
        data: {
          listing: state.listing,
        },
      });
      return;
    }

    const imageActionPath = `/api/v1/admin/listings/${state.listing.id}/images/${state.listing.images[0]!.id}/actions`;

    if (url.pathname === imageActionPath && method === "POST") {
      if (state.failNextImageAction) {
        state.failNextImageAction = false;

        await fulfillJson(
          route,
          {
            ok: false,
            error: {
              code: "IMAGE_REVIEW_FAILED",
              message: IMAGE_ACTION_FAILURE_MESSAGE,
              rawEmail: RAW_EMAIL_SENTINEL,
              rawPhone: RAW_PHONE_SENTINEL,
              accessToken: RAW_TOKEN_SENTINEL,
              refreshToken: RAW_TOKEN_SENTINEL,
              rawMessageBody: RAW_MESSAGE_SENTINEL,
              rawPrompt: RAW_PROMPT_SENTINEL,
            },
          } as ApiResponse<never>,
          503,
        );
        return;
      }

      const body = (await request.postDataJSON()) as {
        action?: AdminListingImageAction;
        reason?: string;
      };

      if ((body.action !== "approve" && body.action !== "reject") || !body.reason?.trim()) {
        await fulfillJson(
          route,
          {
            ok: false,
            error: {
              code: "INVALID_REQUEST",
              message: "Admin listing image action body is invalid.",
            },
          },
          400,
        );
        return;
      }

      state.imageActionRequests.push({
        action: body.action,
        reason: body.reason.trim(),
      });

      const nextReviewStatus = body.action === "approve" ? "approved" : "rejected";
      const image = state.listing.images[0]!;

      state.listing = {
        ...state.listing,
        primaryImage: {
          ...image,
          reviewStatus: nextReviewStatus,
          reviewedAt: "2026-01-01T12:00:00.000Z",
          reviewedByProfileId: "admin-profile-e2e",
        },
        images: [
          {
            ...image,
            reviewStatus: nextReviewStatus,
            reviewedAt: "2026-01-01T12:00:00.000Z",
            reviewedByProfileId: "admin-profile-e2e",
          },
        ],
        updatedAt: "2026-01-01T12:00:00.000Z",
        auditTrail: [
          {
            id: "audit-image-review-e2e-1",
            eventType: "admin_listing_image_review_applied",
            createdAt: "2026-01-01T12:00:00.000Z",
            actor: {
              id: "admin-profile-e2e",
              displayName: "Backoffice E2E Admin",
            },
            metadata: {
              action: body.action,
              imageId: image.id,
              previousReviewStatus: image.reviewStatus,
              nextReviewStatus,
              reasonLength: body.reason.trim().length,
              rawEmail: RAW_EMAIL_SENTINEL,
              rawPhone: RAW_PHONE_SENTINEL,
              accessToken: RAW_TOKEN_SENTINEL,
              rawMessageBody: RAW_MESSAGE_SENTINEL,
              rawPrompt: RAW_PROMPT_SENTINEL,
            } as Record<string, string | number | boolean | string[] | null>,
          },
          ...state.listing.auditTrail,
        ],
      };

      await fulfillJson(route, {
        ok: true,
        data: {
          image: state.listing.images[0],
          auditEventId: "audit-image-review-e2e-1",
        },
      });
      return;
    }

    await fulfillJson(
      route,
      {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: `Unhandled backoffice E2E route: ${request.method()} ${url.pathname}`,
        },
      },
      404,
    );
  });
}

function getFilteredListings(state: MockState, searchParams: URLSearchParams): AdminListingDetail[] {
  const imageReviewStatus = searchParams.get("imageReviewStatus");

  if (imageReviewStatus && state.listing.primaryImage?.reviewStatus !== imageReviewStatus) {
    return [];
  }

  return [state.listing];
}

async function expectNoImageReviewPrivateLeak(page: Page): Promise<void> {
  const body = page.locator("body");

  await expect(body).not.toContainText(ADMIN_AUTH.user.email);
  await expect(body).not.toContainText(RAW_EMAIL_SENTINEL);
  await expect(body).not.toContainText(RAW_PHONE_SENTINEL);
  await expect(body).not.toContainText(RAW_TOKEN_SENTINEL);
  await expect(body).not.toContainText(RAW_MESSAGE_SENTINEL);
  await expect(body).not.toContainText(RAW_PROMPT_SENTINEL);
  await expect(body).not.toContainText("accessToken");
  await expect(body).not.toContainText("refreshToken");
  await expect(body).not.toContainText("passwordHash");
  await expect(body).not.toContainText("rawMessageBody");
  await expect(body).not.toContainText("rawPrompt");
}

async function fulfillJson(route: Route, body: ApiResponse<unknown>, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: getCorsHeaders(route),
    body: JSON.stringify(body),
  });
}

function getCorsHeaders(route: Route): Record<string, string> {
  const origin = route.request().headers()["origin"] ?? "http://localhost:3001";

  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,x-babyloop-csrf-token",
    vary: "Origin",
  };
}

function createImageReviewState(): MockState {
  const image: AdminListingImage = {
    id: E2E_IMAGE_ID,
    url: "/favicon.ico",
    sortOrder: 0,
    reviewStatus: "needs_review",
    reviewedAt: null,
    reviewedByProfileId: null,
    authenticity: {
      decision: "needs_review",
      confidence: 0.73,
      providerName: "gemini",
      modelName: "gemini-2.5-flash",
      promptVersion: "listing_image_authenticity.gemini.v1",
      reasons: ["Catalog-like image requires human review."],
      flags: {
        isStockOrCatalogLike: true,
        isRealProductPhoto: true,
        rawPrompt: RAW_PROMPT_SENTINEL,
        accessToken: RAW_TOKEN_SENTINEL,
      },
      checkedAt: "2026-01-01T10:00:00.000Z",
    },
    createdAt: "2026-01-01T10:00:00.000Z",
  };

  const listing: AdminListingDetail = {
    id: E2E_LISTING_ID,
    title: "Backoffice E2E stroller with review image",
    description: "A listing with an AI-authenticity image requiring admin review.",
    price: {
      amount: "6500.00",
      currency: "TRY",
    },
    currency: "TRY",
    status: "active",
    listingType: "sale",
    condition: "good",
    category: {
      id: "category-e2e-1",
      name: "Bebek Arabası & Seyahat",
      slug: "strollers-travel",
    },
    seller: {
      profileId: "seller-profile-e2e",
      displayName: "Backoffice E2E Seller",
      locationCity: "İstanbul",
      createdAt: "2025-12-01T10:00:00.000Z",
    },
    primaryImage: image,
    imageCount: 1,
    moderation: {
      relatedCaseCount: 0,
      openRelatedCaseCount: 0,
    },
    createdAt: "2026-01-01T10:00:00.000Z",
    updatedAt: "2026-01-01T10:00:00.000Z",
    images: [image],
    relatedModerationCases: [],
    actionEligibility: {
      canArchive: true,
      canRestore: false,
      supportedActions: ["archive"],
    },
    auditTrail: [],
  };

  return {
    listing,
    imageActionRequests: [],
  };
}
