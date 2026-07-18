import { listingImages, listings } from "@babyloop/database/schema";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  processDueListingPublications,
  reconcileListingPublication
} from "../src/services/listing-publication.service.js";
import { authHeader, createUser } from "./helpers/auth.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";
import { createCategory } from "./helpers/fixtures.js";

let app: TestApp;

beforeEach(async () => {
  await resetTestDatabase();
  app = await createTestApp();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await app.close();
});

describe("listing publication workflow", () => {
  it("protects publication settings with backoffice permission and validation", async () => {
    const regularUser = await createUser(app, {
      email: "publication-settings-user@babyloop.test"
    });
    const admin = await createUser(app, {
      email: "publication-settings-admin@babyloop.test",
      role: "admin"
    });

    const forbidden = await app.inject({
      headers: authHeader(regularUser.accessToken),
      method: "PATCH",
      url: "/api/v1/admin/listings/publication-settings",
      payload: {
        adminReviewEnabled: true,
        autoPublishDelaySeconds: 30
      }
    });
    const invalid = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "PATCH",
      url: "/api/v1/admin/listings/publication-settings",
      payload: {
        adminReviewEnabled: false,
        autoPublishDelaySeconds: 1
      }
    });

    expect(forbidden.statusCode).toBe(403);
    expect(invalid.statusCode).toBe(400);
  });

  it("schedules AI-approved listings for the default 30-second publication window", async () => {
    const seller = await createUser(app);
    const listingId = await createDraftListing(seller.accessToken, "Automatic publication");
    const beforeReconcile = Date.now();

    await addApprovedImage(listingId);
    const reconciled = await reconcileListingPublication(app, listingId, {
      actorProfileId: seller.profile.id,
      trigger: "test_ai_approved"
    });

    expect(reconciled).toMatchObject({
      status: "draft",
      publicationState: "scheduled"
    });
    expect(reconciled?.publishAfter).toBeInstanceOf(Date);

    const delayMs = (reconciled?.publishAfter?.getTime() ?? 0) - beforeReconcile;
    expect(delayMs).toBeGreaterThanOrEqual(29_000);
    expect(delayMs).toBeLessThanOrEqual(31_000);

    const publicDuringReview = await app.inject({
      method: "GET",
      url: `/api/v1/listings/${listingId}`
    });
    expect(publicDuringReview.statusCode).toBe(404);

    const beforeDue = await processDueListingPublications(app, {
      now: new Date((reconciled?.publishAfter?.getTime() ?? 0) - 1)
    });
    const atDue = await processDueListingPublications(app, {
      now: reconciled?.publishAfter ?? new Date()
    });
    const duplicateRun = await processDueListingPublications(app, {
      now: reconciled?.publishAfter ?? new Date()
    });

    expect(beforeDue).toBe(0);
    expect(atDue).toBe(1);
    expect(duplicateRun).toBe(0);

    const publicAfterDue = await app.inject({
      method: "GET",
      url: `/api/v1/listings/${listingId}`
    });
    expect(publicAfterDue.statusCode).toBe(200);
    expect(publicAfterDue.json().data.listing).toMatchObject({
      id: listingId,
      status: "active",
      publicationState: "published"
    });
  });

  it("blocks unpublished listings from every public interaction surface", async () => {
    const seller = await createUser(app, {
      email: "publication-boundary-seller@babyloop.test"
    });
    const buyer = await createUser(app, {
      email: "publication-boundary-buyer@babyloop.test"
    });
    const title = "PendingPublicationBoundary";
    const listingId = await createDraftListing(seller.accessToken, title);

    await addApprovedImage(listingId);
    await reconcileListingPublication(app, listingId, {
      actorProfileId: seller.profile.id,
      trigger: "test_public_boundary"
    });

    const favoriteResponse = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: { listingId }
    });
    const cartResponse = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/cart/items",
      payload: { listingId }
    });
    const conversationResponse = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/conversations",
      payload: { listingId }
    });
    const suggestionResponse = await app.inject({
      method: "GET",
      url: `/api/v1/search-suggestions?q=${title}&limit=10`
    });

    expect(favoriteResponse.statusCode).toBe(400);
    expect(favoriteResponse.json().error.code).toBe("LISTING_NOT_ACTIVE");
    expect(cartResponse.statusCode).toBe(409);
    expect(cartResponse.json().error.code).toBe("LISTING_UNAVAILABLE_FOR_CART");
    expect(conversationResponse.statusCode).toBe(400);
    expect(conversationResponse.json().error.code).toBe("INVALID_LISTING");
    expect(suggestionResponse.statusCode).toBe(200);
    expect(suggestionResponse.body).not.toContain(listingId);
    expect(suggestionResponse.body).not.toContain(title);
  });

  it("keeps AI needs-review listings in human review even when auto publish is enabled", async () => {
    const seller = await createUser(app, {
      email: "publication-ai-review-seller@babyloop.test"
    });
    const listingId = await createDraftListing(seller.accessToken, "AI review listing");

    await addImage(listingId, "needs_review");
    const reconciled = await reconcileListingPublication(app, listingId, {
      actorProfileId: seller.profile.id,
      trigger: "test_ai_needs_review"
    });
    const publishedCount = await processDueListingPublications(app, {
      now: new Date(Date.now() + 60_000)
    });

    expect(reconciled).toMatchObject({
      status: "draft",
      publicationState: "ai_review",
      publishAfter: null
    });
    expect(publishedCount).toBe(0);
  });

  it("moves scheduled listings into admin review immediately when manual review is enabled", async () => {
    const admin = await createUser(app, {
      email: "publication-enable-admin@babyloop.test",
      role: "admin"
    });
    const seller = await createUser(app, {
      email: "publication-enable-seller@babyloop.test"
    });
    const listingId = await createDraftListing(seller.accessToken, "Enable review listing");

    await addApprovedImage(listingId);
    const scheduled = await reconcileListingPublication(app, listingId, {
      actorProfileId: seller.profile.id,
      trigger: "test_scheduled_before_toggle"
    });
    expect(scheduled?.publicationState).toBe("scheduled");

    await setAdminReview(admin.accessToken, true);

    const [row] = await app.db
      .select({
        publicationState: listings.publicationState,
        publishAfter: listings.publishAfter
      })
      .from(listings)
      .where(eq(listings.id, listingId))
      .limit(1);
    const publishedCount = await processDueListingPublications(app, {
      now: new Date(Date.now() + 60_000)
    });

    expect(row).toMatchObject({
      publicationState: "admin_review",
      publishAfter: null
    });
    expect(publishedCount).toBe(0);
  });

  it("holds safe listings for a real backoffice decision when admin review is enabled", async () => {
    const admin = await createUser(app, {
      email: "publication-admin@babyloop.test",
      role: "admin"
    });
    const seller = await createUser(app, {
      email: "publication-seller@babyloop.test"
    });

    const settingsResponse = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "PATCH",
      url: "/api/v1/admin/listings/publication-settings",
      payload: {
        adminReviewEnabled: true,
        autoPublishDelaySeconds: 30
      }
    });
    expect(settingsResponse.statusCode).toBe(200);
    expect(settingsResponse.json().data.settings).toMatchObject({
      adminReviewEnabled: true,
      autoPublishDelaySeconds: 30
    });

    const listingId = await createDraftListing(seller.accessToken, "Manual publication");
    await addApprovedImage(listingId);
    const reconciled = await reconcileListingPublication(app, listingId, {
      actorProfileId: seller.profile.id,
      trigger: "test_ai_approved"
    });

    expect(reconciled).toMatchObject({
      status: "draft",
      publicationState: "admin_review",
      publishAfter: null
    });

    const queueResponse = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "GET",
      url: "/api/v1/admin/listings?publicationState=admin_review&limit=20"
    });
    expect(queueResponse.statusCode).toBe(200);
    expect(
      queueResponse.json().data.listings.map((listing: { id: string }) => listing.id)
    ).toContain(listingId);

    const publicBeforeApproval = await app.inject({
      method: "GET",
      url: `/api/v1/listings/${listingId}`
    });
    expect(publicBeforeApproval.statusCode).toBe(404);

    const approval = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "POST",
      url: `/api/v1/admin/listings/${listingId}/actions`,
      payload: {
        action: "publish",
        reason: "İlan bilgileri ve AI görsel sinyalleri güvenli bulundu."
      }
    });
    expect(approval.statusCode).toBe(200);
    expect(approval.json().data).toMatchObject({
      listingId,
      action: "publish",
      previousPublicationState: "admin_review",
      nextPublicationState: "published",
      nextStatus: "active"
    });

    const publicAfterApproval = await app.inject({
      method: "GET",
      url: `/api/v1/listings/${listingId}`
    });
    expect(publicAfterApproval.statusCode).toBe(200);
  });

  it("returns requested changes to the same controlled review flow after seller edits", async () => {
    const admin = await createUser(app, {
      email: "publication-change-admin@babyloop.test",
      role: "admin"
    });
    const seller = await createUser(app, {
      email: "publication-change-seller@babyloop.test"
    });

    await setAdminReview(admin.accessToken, true);
    const listingId = await createDraftListing(seller.accessToken, "Change request listing");
    await addApprovedImage(listingId);
    await reconcileListingPublication(app, listingId, {
      actorProfileId: seller.profile.id,
      trigger: "test_ready_for_admin_review"
    });

    const requested = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "POST",
      url: `/api/v1/admin/listings/${listingId}/actions`,
      payload: {
        action: "request_changes",
        reason: "Ürün açıklamasındaki ölçü bilgisini daha açık yazmalısın."
      }
    });
    const edited = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "PATCH",
      url: `/api/v1/listings/${listingId}`,
      payload: {
        description: "Ölçüler: 80 x 45 x 100 cm. Ürün açıklaması güncellendi."
      }
    });

    expect(requested.statusCode).toBe(200);
    expect(requested.json().data).toMatchObject({
      listingId,
      action: "request_changes",
      previousPublicationState: "admin_review",
      nextPublicationState: "changes_requested",
      nextStatus: "draft"
    });
    expect(edited.statusCode).toBe(200);
    expect(edited.json().data.listing).toMatchObject({
      status: "draft",
      publicationState: "admin_review",
      publicationReviewReason: null
    });
  });

  it("reschedules already queued listings when the automatic delay changes", async () => {
    const admin = await createUser(app, {
      email: "publication-delay-admin@babyloop.test",
      role: "admin"
    });
    const seller = await createUser(app, {
      email: "publication-delay-seller@babyloop.test"
    });
    const listingId = await createDraftListing(seller.accessToken, "Delay change listing");

    await addApprovedImage(listingId);
    await reconcileListingPublication(app, listingId, {
      actorProfileId: seller.profile.id,
      trigger: "test_delay_before_change"
    });

    const beforeChange = Date.now();
    const response = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "PATCH",
      url: "/api/v1/admin/listings/publication-settings",
      payload: {
        adminReviewEnabled: false,
        autoPublishDelaySeconds: 45
      }
    });
    const [row] = await app.db
      .select({
        publicationState: listings.publicationState,
        publishAfter: listings.publishAfter
      })
      .from(listings)
      .where(eq(listings.id, listingId))
      .limit(1);

    expect(response.statusCode).toBe(200);
    expect(row?.publicationState).toBe("scheduled");
    expect(row?.publishAfter).toBeInstanceOf(Date);
    expect((row?.publishAfter?.getTime() ?? 0) - beforeChange).toBeGreaterThanOrEqual(44_000);
    expect((row?.publishAfter?.getTime() ?? 0) - beforeChange).toBeLessThanOrEqual(46_000);
  });

  it("archives pending listings without leaving a runnable publication schedule", async () => {
    const seller = await createUser(app, {
      email: "publication-archive-seller@babyloop.test"
    });
    const listingId = await createDraftListing(seller.accessToken, "Archive pending listing");

    await addApprovedImage(listingId);
    await reconcileListingPublication(app, listingId, {
      actorProfileId: seller.profile.id,
      trigger: "test_schedule_before_archive"
    });

    const archived = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "PATCH",
      url: `/api/v1/listings/${listingId}/status`,
      payload: { status: "archived" }
    });
    const [row] = await app.db
      .select({
        status: listings.status,
        publicationState: listings.publicationState,
        publishAfter: listings.publishAfter,
        publishedAt: listings.publishedAt
      })
      .from(listings)
      .where(eq(listings.id, listingId))
      .limit(1);
    const publishedCount = await processDueListingPublications(app, {
      now: new Date(Date.now() + 120_000)
    });

    expect(archived.statusCode).toBe(200);
    expect(row).toMatchObject({
      status: "archived",
      publicationState: "awaiting_images",
      publishAfter: null,
      publishedAt: null
    });
    expect(publishedCount).toBe(0);
  });

  it("moves admin-review listings into a fresh delay when manual review is disabled", async () => {
    const admin = await createUser(app, {
      email: "publication-toggle-admin@babyloop.test",
      role: "admin"
    });
    const seller = await createUser(app, {
      email: "publication-toggle-seller@babyloop.test"
    });

    await setAdminReview(admin.accessToken, true);
    const listingId = await createDraftListing(seller.accessToken, "Toggle publication");
    await addApprovedImage(listingId);
    await reconcileListingPublication(app, listingId, {
      actorProfileId: seller.profile.id,
      trigger: "test_ai_approved"
    });

    const beforeToggle = Date.now();
    await setAdminReview(admin.accessToken, false);

    const [row] = await app.db
      .select({
        status: listings.status,
        publicationState: listings.publicationState,
        publishAfter: listings.publishAfter
      })
      .from(listings)
      .where(eq(listings.id, listingId))
      .limit(1);

    expect(row).toMatchObject({
      status: "draft",
      publicationState: "scheduled"
    });
    expect(row?.publishAfter).toBeInstanceOf(Date);
    expect((row?.publishAfter?.getTime() ?? 0) - beforeToggle).toBeGreaterThanOrEqual(29_000);
  });
});

async function createDraftListing(accessToken: string, title: string): Promise<string> {
  const category = await createCategory(app.db);
  const response = await app.inject({
    headers: authHeader(accessToken),
    method: "POST",
    url: "/api/v1/listings",
    payload: {
      categoryId: category.id,
      condition: "good",
      currency: "TRY",
      listingType: "sale",
      priceAmount: "1000.00",
      title
    }
  });

  expect(response.statusCode).toBe(201);
  expect(response.json().data.listing).toMatchObject({
    status: "draft",
    publicationState: "awaiting_images"
  });

  return response.json().data.listing.id as string;
}

async function addApprovedImage(listingId: string): Promise<void> {
  await addImage(listingId, "approved");
}

async function addImage(
  listingId: string,
  reviewStatus: "approved" | "needs_review"
): Promise<void> {
  await app.db.insert(listingImages).values({
    authenticityDecision: reviewStatus === "approved" ? "allow" : "needs_review",
    listingId,
    reviewStatus,
    sortOrder: 0,
    url: `/api/v1/uploads/listings/${listingId}/publication-test-${reviewStatus}.png`
  });
}

async function setAdminReview(accessToken: string, adminReviewEnabled: boolean): Promise<void> {
  const response = await app.inject({
    headers: authHeader(accessToken),
    method: "PATCH",
    url: "/api/v1/admin/listings/publication-settings",
    payload: {
      adminReviewEnabled,
      autoPublishDelaySeconds: 30
    }
  });

  expect(response.statusCode).toBe(200);
}
