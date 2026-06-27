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

test.describe("backoffice listing image review", () => {
  test("admin can open review queue, approve a needs-review image, and see audit state", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    const state = createImageReviewState();

    await installBackofficeMocks(page, state);

    await page.goto("/listings", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Listings", exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByText("Image review queue", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Show review queue", exact: true }).click();

    await expect(page.getByText("Image review queue active", { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    const listingCard = page.locator(`[data-admin-listing-id="${state.listing.id}"]`);
    await expect(listingCard).toBeVisible({ timeout: 15_000 });
    await expect(listingCard).toHaveAttribute("data-admin-primary-image-review-status", "needs_review");
    await expect(listingCard.getByText("Needs review image", { exact: true })).toBeVisible();

    await listingCard.getByRole("link", { name: "Review images", exact: true }).click();

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
    await expect(awaitingReviewPanel.getByText("Images awaiting review", { exact: true })).toBeVisible();
    await expect(page.getByText("Hidden publicly until approved", { exact: true })).toBeVisible();

    const imageId = state.listing.images[0]!.id;
    const imageCard = page.locator(`[data-admin-image-id="${imageId}"]`);

    await expect(imageCard).toBeVisible({ timeout: 15_000 });
    await expect(imageCard).toHaveAttribute("data-admin-image-review-status", "needs_review");
    await expect(imageCard.locator('[data-admin-image-review-status-label="needs_review"]')).toBeVisible();

    await expect(imageCard.getByText("AI decision")).toBeVisible();
    await expect(imageCard.getByText("needs_review", { exact: true })).toBeVisible();
    await expect(imageCard.getByText("gemini", { exact: true })).toBeVisible();
    await expect(imageCard.getByText("gemini-2.5-flash", { exact: true })).toBeVisible();
    await expect(
      imageCard.getByText("listing_image_authenticity.gemini.v1", { exact: true }),
    ).toBeVisible();

    await imageCard.locator(`[data-admin-image-review-action="${imageId}"]`).selectOption("approve");
    await imageCard
      .locator(`[data-admin-image-review-reason="${imageId}"]`)
      .fill("Looks like a real stroller product photo.");

    const reviewResponsePromise = page.waitForResponse((response) => {
      return (
        response.url().includes(`/api/v1/admin/listings/${state.listing.id}/images/${imageId}/actions`) &&
        response.request().method() === "POST"
      );
    });

    await imageCard.locator(`[data-admin-image-review-submit="${imageId}"]`).click();

    const reviewResponse = await reviewResponsePromise;
    expect(reviewResponse.ok(), await reviewResponse.text()).toBe(true);

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
    await expect(page.getByText("Image review audited: audit-image-review-e2e-1")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Image approved", { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await page.goto("/listings", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Show review queue", exact: true }).click();

    await expect(page.getByText("No listings found", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator(`[data-admin-listing-id="${state.listing.id}"]`)).toHaveCount(0);
  });
});

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

    if (request.method().toUpperCase() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: getCorsHeaders(route),
      });
      return;
    }

    if (url.pathname === "/api/v1/admin/listings" && request.method() === "GET") {
      await fulfillJson(route, {
        ok: true,
        data: {
          listings: getFilteredListings(state, url.searchParams),
        },
      });
      return;
    }

    if (url.pathname === `/api/v1/admin/listings/${state.listing.id}` && request.method() === "GET") {
      await fulfillJson(route, {
        ok: true,
        data: {
          listing: state.listing,
        },
      });
      return;
    }

    const imageActionPath = `/api/v1/admin/listings/${state.listing.id}/images/${state.listing.images[0]!.id}/actions`;

    if (url.pathname === imageActionPath && request.method() === "POST") {
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
            },
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
    id: "admin-image-e2e-1",
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
      },
      checkedAt: "2026-01-01T10:00:00.000Z",
    },
    createdAt: "2026-01-01T10:00:00.000Z",
  };

  const listing: AdminListingDetail = {
    id: "admin-listing-e2e-1",
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
