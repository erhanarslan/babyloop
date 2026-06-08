import {
  aiModelRuns,
  authAccounts,
  conversations,
  emailVerificationTokens,
  favorites,
  listingImages,
  listings,
  mfaOtpChallenges,
  passwordResetTokens,
  profiles,
  sessions,
  users
} from "@babyloop/database/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  REALTIME_EVENTS,
  realtimeConversationRoom,
  realtimeProfileRoom,
  type ConversationUpdatedPayload,
  type MessageCreatedPayload,
  type RealtimeErrorPayload
} from "@babyloop/shared";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { REFRESH_TOKEN_COOKIE_NAME, hashRefreshToken } from "../src/utils/refresh-token.js";
import { hashEmailVerificationToken } from "../src/utils/email-verification-token.js";
import { hashMfaOtpCode } from "../src/utils/mfa-otp.js";
import { GOOGLE_OAUTH_STATE_COOKIE_NAME, type GoogleUserInfo } from "../src/services/google-oauth.service.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";
import { authHeader, createUser, loginUser } from "./helpers/auth.js";
import { countEvents, createCategory, createConversation, createListing, getListingSellerProfileId } from "./helpers/fixtures.js";
import { getCookieValue, getDevResetToken, getGoogleOAuthStateSetCookie, getRefreshSetCookie, toCookieHeader } from "./helpers/cookies.js";
import { createRecordingEmailDeliveryService, type RecordingEmailDeliveryService } from "./helpers/email.js";
import { createFakeGoogleOAuthClient } from "./helpers/google-oauth.js";
import { connectRealtimeSocket, delay, expectUnauthenticatedSocketRejected, getListeningBaseUrl, onceSocketEvent, waitForConversationRoomSize } from "./helpers/realtime.js";

let app!: TestApp;
let uploadRoot!: string;

beforeEach(async () => {
  await resetTestDatabase();
  uploadRoot = await mkdtemp(path.join(tmpdir(), "babyloop-listing-images-"));
  app = await createTestApp({ uploadRoot });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await app.close();
  await rm(uploadRoot, { force: true, recursive: true });
});

describe("listings API", () => {
  it("publicly lists active listings", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/listings"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.listings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: listing.id
        })
      ])
    );
  });

  it("searches active listings by title", async () => {
    const seller = await createUser(app);
    const stroller = await createListing(app, seller.accessToken, {
      title: "Blue Nuna stroller"
    });
    const puzzle = await createListing(app, seller.accessToken, {
      title: "Wooden puzzle set"
    });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/listings?q=stroller"
    });
    const listingIds = response.json().data.listings.map((listing: { id: string }) => listing.id);

    expect(response.statusCode).toBe(200);
    expect(listingIds).toContain(stroller.id);
    expect(listingIds).not.toContain(puzzle.id);
  });

  it("searches active listings by partial case-insensitive title", async () => {
    const seller = await createUser(app);
    const stroller = await createListing(app, seller.accessToken, {
      title: "Blue Nuna stroller"
    });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/listings?q=NuNa"
    });
    const listingIds = response.json().data.listings.map((listing: { id: string }) => listing.id);

    expect(response.statusCode).toBe(200);
    expect(listingIds).toContain(stroller.id);
  });

  it("does not narrow listing search below three characters", async () => {
    const seller = await createUser(app);
    const stroller = await createListing(app, seller.accessToken, {
      title: "Blue Nuna stroller"
    });
    const puzzle = await createListing(app, seller.accessToken, {
      title: "Wooden puzzle set"
    });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/listings?q=nu"
    });
    const listingIds = response.json().data.listings.map((listing: { id: string }) => listing.id);

    expect(response.statusCode).toBe(200);
    expect(listingIds).toContain(stroller.id);
    expect(listingIds).toContain(puzzle.id);
  });

  it("does not publicly list inactive listings", async () => {
    const seller = await createUser(app);
    const activeListing = await createListing(app, seller.accessToken);
    const archivedListing = await createListing(app, seller.accessToken);
    const soldListing = await createListing(app, seller.accessToken);
    await app.db
      .update(listings)
      .set({ status: "archived" })
      .where(eq(listings.id, archivedListing.id));
    await app.db
      .update(listings)
      .set({ status: "sold" })
      .where(eq(listings.id, soldListing.id));

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/listings"
    });
    const listingIds = response.json().data.listings.map((listing: { id: string }) => listing.id);

    expect(response.statusCode).toBe(200);
    expect(listingIds).toContain(activeListing.id);
    expect(listingIds).not.toContain(archivedListing.id);
    expect(listingIds).not.toContain(soldListing.id);
  });

  it("rejects dangerous HTML/script-like listing title and description", async () => {
    const seller = await createUser(app);
    const category = await createCategory(app.db);
    const scriptTitle = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        categoryId: category.id,
        condition: "good",
        currency: "TRY",
        listingType: "sale",
        priceAmount: "1000.00",
        title: "<script>alert(1)</script>"
      }
    });
    const dangerousDescription = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        categoryId: category.id,
        condition: "good",
        currency: "TRY",
        description: "<img src=x onerror=alert(1)>",
        listingType: "sale",
        priceAmount: "1000.00",
        title: "Clean baby stroller"
      }
    });

    expect(scriptTitle.statusCode).toBe(400);
    expect(dangerousDescription.statusCode).toBe(400);
  });

  it("accepts valid plaintext listing title and description", async () => {
    const seller = await createUser(app);
    const category = await createCategory(app.db);
    const response = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        categoryId: category.id,
        condition: "good",
        currency: "TRY",
        description: "Temiz kullanıldı. Puset ve yağmurluk dahildir.",
        listingType: "sale",
        priceAmount: "1000.00",
        title: "Temiz bebek arabası"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.listing).toMatchObject({
      title: "Temiz bebek arabası"
    });
  });

  it("publicly returns active listing detail", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/listings/${listing.id}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        listing: {
          id: listing.id,
          seller: {
            id: seller.profile.id
          }
        }
      }
    });
  });

  it("returns privacy-safe favorite counts without exposing favoriting users", async () => {
    const seller = await createUser(app);
    const firstBuyer = await createUser(app, {
      displayName: "First Favorite User",
      email: "first-favorite-user@babyloop.test"
    });
    const secondBuyer = await createUser(app, {
      displayName: "Second Favorite User",
      email: "second-favorite-user@babyloop.test"
    });
    const listing = await createListing(app, seller.accessToken);

    await app.inject({
      headers: authHeader(firstBuyer.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });
    await app.inject({
      headers: authHeader(secondBuyer.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });

    const detailWithTwoFavorites = await app.inject({
      method: "GET",
      url: `/api/v1/listings/${listing.id}`
    });
    const sellerListingsWithTwoFavorites = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "GET",
      url: "/api/v1/me/listings"
    });

    await app.inject({
      headers: authHeader(firstBuyer.accessToken),
      method: "DELETE",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });

    const detailAfterUnfavorite = await app.inject({
      method: "GET",
      url: `/api/v1/listings/${listing.id}`
    });

    expect(detailWithTwoFavorites.statusCode).toBe(200);
    expect(detailWithTwoFavorites.json().data.listing.favoriteCount).toBe(2);
    expect(sellerListingsWithTwoFavorites.statusCode).toBe(200);
    expect(sellerListingsWithTwoFavorites.json().data.listings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: listing.id,
          favoriteCount: 2
        })
      ])
    );
    expect(detailAfterUnfavorite.json().data.listing.favoriteCount).toBe(1);
    for (const responseBody of [
      detailWithTwoFavorites.body,
      sellerListingsWithTwoFavorites.body,
      detailAfterUnfavorite.body
    ]) {
      expect(responseBody).not.toContain(firstBuyer.profile.id);
      expect(responseBody).not.toContain(firstBuyer.user.id);
      expect(responseBody).not.toContain(firstBuyer.user.email);
      expect(responseBody).not.toContain(secondBuyer.profile.id);
      expect(responseBody).not.toContain(secondBuyer.user.id);
      expect(responseBody).not.toContain(secondBuyer.user.email);
    }
  });

  it("lets the seller upload, serve, and delete a safe listing image", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const uploadRequest = multipartRequest({
      buffer: tinyPng(),
      filename: "stroller.png",
      mimetype: "image/png"
    });
    const upload = await app.inject({
      ...uploadRequest,
      headers: {
        ...authHeader(seller.accessToken),
        ...uploadRequest.headers
      },
      method: "POST",
      url: `/api/v1/listings/${listing.id}/images`
    });

    expect(upload.statusCode).toBe(201);
    const image = upload.json().data.image;
    expect(image).toMatchObject({
      sortOrder: 0
    });
    expect(image.url).toMatch(/^\/api\/v1\/uploads\/listings\/.+\.png$/);

    const [imageRow] = await app.db
      .select({ id: listingImages.id, url: listingImages.url })
      .from(listingImages)
      .where(eq(listingImages.id, image.id));
    const detail = await app.inject({
      method: "GET",
      url: `/api/v1/listings/${listing.id}`
    });
    const served = await app.inject({
      method: "GET",
      url: image.url
    });

    expect(imageRow).toMatchObject({ id: image.id, url: image.url });
    expect(detail.json().data.listing.images).toEqual([
      expect.objectContaining({
        id: image.id,
        url: image.url
      })
    ]);
    expect(detail.json().data.listing.firstImage).toMatchObject({
      id: image.id,
      url: image.url
    });
    expect(served.statusCode).toBe(200);
    expect(served.headers["content-type"]).toContain("image/png");
    expect(served.headers["x-content-type-options"]).toBe("nosniff");

    const deleted = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "DELETE",
      url: `/api/v1/listings/${listing.id}/images/${image.id}`
    });
    const detailAfterDelete = await app.inject({
      method: "GET",
      url: `/api/v1/listings/${listing.id}`
    });
    const servedAfterDelete = await app.inject({
      method: "GET",
      url: image.url
    });

    expect(deleted.statusCode).toBe(200);
    expect(detailAfterDelete.json().data.listing.images).toEqual([]);
    expect(servedAfterDelete.statusCode).toBe(404);
  });

  it("enforces listing image ownership", async () => {
    const seller = await createUser(app);
    const otherUser = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const unauthenticatedUpload = await app.inject({
      ...multipartRequest({
        buffer: tinyPng(),
        filename: "stroller.png",
        mimetype: "image/png"
      }),
      method: "POST",
      url: `/api/v1/listings/${listing.id}/images`
    });
    const nonOwnerUploadRequest = multipartRequest({
      buffer: tinyPng(),
      filename: "stroller.png",
      mimetype: "image/png"
    });
    const nonOwnerUpload = await app.inject({
      ...nonOwnerUploadRequest,
      headers: {
        ...authHeader(otherUser.accessToken),
        ...nonOwnerUploadRequest.headers
      },
      method: "POST",
      url: `/api/v1/listings/${listing.id}/images`
    });
    const ownerUploadRequest = multipartRequest({
      buffer: tinyPng(),
      filename: "stroller.png",
      mimetype: "image/png"
    });
    const ownerUpload = await app.inject({
      ...ownerUploadRequest,
      headers: {
        ...authHeader(seller.accessToken),
        ...ownerUploadRequest.headers
      },
      method: "POST",
      url: `/api/v1/listings/${listing.id}/images`
    });
    const imageId = ownerUpload.json().data.image.id;
    const nonOwnerDelete = await app.inject({
      headers: authHeader(otherUser.accessToken),
      method: "DELETE",
      url: `/api/v1/listings/${listing.id}/images/${imageId}`
    });

    expect(unauthenticatedUpload.statusCode).toBe(401);
    expect(nonOwnerUpload.statusCode).toBe(403);
    expect(ownerUpload.statusCode).toBe(201);
    expect(nonOwnerDelete.statusCode).toBe(403);
  });

  it("rejects unsafe listing image uploads", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const svgRequest = multipartRequest({
      buffer: Buffer.from("<svg><script>alert(1)</script></svg>"),
      filename: "xss.svg",
      mimetype: "image/svg+xml"
    });
    const htmlDisguisedRequest = multipartRequest({
      buffer: Buffer.from("<script>alert(1)</script>"),
      filename: "xss.png",
      mimetype: "image/png"
    });
    const mismatchRequest = multipartRequest({
      buffer: tinyPng(),
      filename: "stroller.jpg",
      mimetype: "image/jpeg"
    });
    const oversizedRequest = multipartRequest({
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
      filename: "large.png",
      mimetype: "image/png"
    });
    const missingFileRequest = multipartRequest({
      buffer: Buffer.from("not an image"),
      fieldName: "notImage",
      filename: "x.png",
      mimetype: "image/png"
    });

    const responses = await Promise.all([
      app.inject({
        ...svgRequest,
        headers: { ...authHeader(seller.accessToken), ...svgRequest.headers },
        method: "POST",
        url: `/api/v1/listings/${listing.id}/images`
      }),
      app.inject({
        ...htmlDisguisedRequest,
        headers: { ...authHeader(seller.accessToken), ...htmlDisguisedRequest.headers },
        method: "POST",
        url: `/api/v1/listings/${listing.id}/images`
      }),
      app.inject({
        ...mismatchRequest,
        headers: { ...authHeader(seller.accessToken), ...mismatchRequest.headers },
        method: "POST",
        url: `/api/v1/listings/${listing.id}/images`
      }),
      app.inject({
        ...oversizedRequest,
        headers: { ...authHeader(seller.accessToken), ...oversizedRequest.headers },
        method: "POST",
        url: `/api/v1/listings/${listing.id}/images`
      }),
      app.inject({
        ...missingFileRequest,
        headers: { ...authHeader(seller.accessToken), ...missingFileRequest.headers },
        method: "POST",
        url: `/api/v1/listings/${listing.id}/images`
      })
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([400, 400, 400, 413, 400]);
    expect(responses[0].json().error.code).toBe("INVALID_IMAGE");
    expect(responses[1].json().error.code).toBe("INVALID_IMAGE");
    expect(responses[2].json().error.code).toBe("INVALID_IMAGE");
    expect(responses[3].json().error.code).toBe("IMAGE_TOO_LARGE");
    expect(responses[4].json().error.code).toBe("INVALID_REQUEST");
  });

  it("enforces listing image count and supports reordering", async () => {
    const seller = await createUser(app);
    const otherUser = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const uploadedImages: Array<{ id: string }> = [];

    for (let index = 0; index < 5; index += 1) {
      const request = multipartRequest({
        buffer: tinyPng(),
        filename: `stroller-${index}.png`,
        mimetype: "image/png"
      });
      const response = await app.inject({
        ...request,
        headers: {
          ...authHeader(seller.accessToken),
          ...request.headers
        },
        method: "POST",
        url: `/api/v1/listings/${listing.id}/images`
      });

      expect(response.statusCode).toBe(201);
      uploadedImages.push(response.json().data.image);
    }

    const sixthRequest = multipartRequest({
      buffer: tinyPng(),
      filename: "sixth.png",
      mimetype: "image/png"
    });
    const tooMany = await app.inject({
      ...sixthRequest,
      headers: {
        ...authHeader(seller.accessToken),
        ...sixthRequest.headers
      },
      method: "POST",
      url: `/api/v1/listings/${listing.id}/images`
    });
    const reversedIds = uploadedImages.map((image) => image.id).reverse();
    const nonOwnerReorder = await app.inject({
      headers: authHeader(otherUser.accessToken),
      method: "PATCH",
      payload: { imageIds: reversedIds },
      url: `/api/v1/listings/${listing.id}/images/reorder`
    });
    const invalidReorder = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "PATCH",
      payload: { imageIds: reversedIds.slice(1) },
      url: `/api/v1/listings/${listing.id}/images/reorder`
    });
    const reordered = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "PATCH",
      payload: { imageIds: reversedIds },
      url: `/api/v1/listings/${listing.id}/images/reorder`
    });

    expect(tooMany.statusCode).toBe(400);
    expect(tooMany.json().error.code).toBe("TOO_MANY_IMAGES");
    expect(nonOwnerReorder.statusCode).toBe(403);
    expect(invalidReorder.statusCode).toBe(400);
    expect(reordered.statusCode).toBe(200);
    expect(reordered.json().data.images.map((image: { id: string }) => image.id)).toEqual(reversedIds);
  });

  it("does not publicly return inactive listing detail", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    await app.db
      .update(listings)
      .set({ status: "archived" })
      .where(eq(listings.id, listing.id));

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/listings/${listing.id}`
    });

    expect(response.statusCode).toBe(404);
  });

  it("returns 401 for unauthenticated listing creation", async () => {
    const category = await createCategory(app.db);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        categoryId: category.id,
        condition: "good",
        listingType: "sale",
        title: "Unauthenticated listing"
      }
    });

    expect(response.statusCode).toBe(401);
  });

  it("rejects listing creation with unknown categoryId", async () => {
    const seller = await createUser(app);
    const response = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        categoryId: "99999999-9999-4999-8999-999999999999",
        condition: "good",
        listingType: "sale",
        title: "Unknown category listing"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_CATEGORY"
      }
    });
  });

  it("rejects invalid listing image URLs and more than five image URLs", async () => {
    const seller = await createUser(app);
    const category = await createCategory(app.db);
    const invalidUrl = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        categoryId: category.id,
        condition: "good",
        imageUrls: ["not-a-url"],
        listingType: "sale",
        title: "Invalid image URL listing"
      }
    });
    const tooManyUrls = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        categoryId: category.id,
        condition: "good",
        imageUrls: [
          "https://example.com/1.jpg",
          "https://example.com/2.jpg",
          "https://example.com/3.jpg",
          "https://example.com/4.jpg",
          "https://example.com/5.jpg",
          "https://example.com/6.jpg"
        ],
        listingType: "sale",
        title: "Too many image URLs listing"
      }
    });

    expect(invalidUrl.statusCode).toBe(400);
    expect(tooManyUrls.statusCode).toBe(400);
  });

  it("creates a listing for authenticated user", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    expect(listing.id).toEqual(expect.any(String));
  });

  it("creates listings for active MVP listing types", async () => {
    const seller = await createUser(app);
    const sale = await createListing(app, seller.accessToken, {
      listingType: "sale",
      title: "Sale listing"
    });
    const donation = await createListing(app, seller.accessToken, {
      listingType: "donation",
      title: "Donation listing"
    });
    const swap = await createListing(app, seller.accessToken, {
      listingType: "swap",
      title: "Swap listing"
    });

    expect(sale.id).toEqual(expect.any(String));
    expect(donation.id).toEqual(expect.any(String));
    expect(swap.id).toEqual(expect.any(String));
  });

  it("rejects rent listing creation because rentals are deferred from MVP scope", async () => {
    const seller = await createUser(app);
    const category = await createCategory(app.db);
    const response = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        categoryId: category.id,
        condition: "good",
        listingType: "rent",
        title: "Rental listing should be rejected"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_REQUEST"
      }
    });
  });

  it("stores listing images in sortOrder order", async () => {
    const seller = await createUser(app);
    const category = await createCategory(app.db);
    const imageUrls = [
      "https://example.com/first.jpg",
      "https://example.com/second.jpg",
      "https://example.com/third.jpg"
    ];
    const response = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        categoryId: category.id,
        condition: "good",
        imageUrls,
        listingType: "sale",
        title: "Ordered image listing"
      }
    });
    const listingId = response.json().data.listing.id;
    const images = await app.db
      .select({
        sortOrder: listingImages.sortOrder,
        url: listingImages.url
      })
      .from(listingImages)
      .where(eq(listingImages.listingId, listingId))
      .orderBy(asc(listingImages.sortOrder));

    expect(response.statusCode).toBe(201);
    expect(images).toEqual([
      { sortOrder: 0, url: imageUrls[0] },
      { sortOrder: 1, url: imageUrls[1] },
      { sortOrder: 2, url: imageUrls[2] }
    ]);
  });

  it("rejects client seller profile spoofing", async () => {
    const seller = await createUser(app);
    const category = await createCategory(app.db);
    const response = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        categoryId: category.id,
        condition: "good",
        listingType: "sale",
        sellerProfileId: "10000000-0000-4000-8000-000000000001",
        title: "Spoofed seller listing"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_REQUEST"
      }
    });
  });

  it("rejects invalid listingType, invalid condition, and unknown extra fields", async () => {
    const seller = await createUser(app);
    const category = await createCategory(app.db);
    const basePayload = {
      categoryId: category.id,
      condition: "good",
      listingType: "sale",
      title: "Invalid contract listing"
    };

    const invalidListingType = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        ...basePayload,
        listingType: "auction"
      }
    });
    const invalidCondition = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        ...basePayload,
        condition: "excellent"
      }
    });
    const extraFields = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        ...basePayload,
        sellerProfileId: seller.profile.id,
        status: "archived"
      }
    });

    expect(invalidListingType.statusCode).toBe(400);
    expect(invalidCondition.statusCode).toBe(400);
    expect(extraFields.statusCode).toBe(400);
    expect(extraFields.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_REQUEST"
      }
    });
  });

  it("returns 401 for unauthenticated current user listings", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/me/listings"
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns only listings owned by the authenticated user", async () => {
    const owner = await createUser(app);
    const otherUser = await createUser(app);
    const ownerActiveListing = await createListing(app, owner.accessToken);
    const ownerArchivedListing = await createListing(app, owner.accessToken);
    const otherListing = await createListing(app, otherUser.accessToken);
    await app.db
      .update(listings)
      .set({ status: "archived" })
      .where(eq(listings.id, ownerArchivedListing.id));

    const response = await app.inject({
      headers: authHeader(owner.accessToken),
      method: "GET",
      url: "/api/v1/me/listings"
    });
    const ownedListingIds = response.json().data.listings.map((listing: { id: string }) => listing.id);

    expect(response.statusCode).toBe(200);
    expect(ownedListingIds).toContain(ownerActiveListing.id);
    expect(ownedListingIds).toContain(ownerArchivedListing.id);
    expect(ownedListingIds).not.toContain(otherListing.id);
  });

  it("allows the owner to update editable listing fields", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const response = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "PATCH",
      url: `/api/v1/listings/${listing.id}`,
      payload: {
        title: "Updated stroller listing",
        priceAmount: "1250.00"
      }
    });

    const [row] = await app.db
      .select({
        title: listings.title,
        priceAmount: listings.priceAmount
      })
      .from(listings)
      .where(eq(listings.id, listing.id))
      .limit(1);

    expect(response.statusCode).toBe(200);
    expect(response.json().data.listing).toMatchObject({
      id: listing.id,
      title: "Updated stroller listing",
      price: {
        amount: "1250.00",
        currency: "TRY"
      }
    });
    expect(row).toMatchObject({
      title: "Updated stroller listing",
      priceAmount: "1250.00"
    });
  });

  it("blocks non-owner and logged-out listing updates", async () => {
    const seller = await createUser(app);
    const otherUser = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const unauthenticated = await app.inject({
      method: "PATCH",
      url: `/api/v1/listings/${listing.id}`,
      payload: {
        title: "Logged out update"
      }
    });
    const nonOwner = await app.inject({
      headers: authHeader(otherUser.accessToken),
      method: "PATCH",
      url: `/api/v1/listings/${listing.id}`,
      payload: {
        title: "Other user update"
      }
    });

    expect(unauthenticated.statusCode).toBe(401);
    expect(nonOwner.statusCode).toBe(403);
  });

  it("allows the owner to mark a listing as sold and hides it from public listings", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const updated = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "PATCH",
      url: `/api/v1/listings/${listing.id}/status`,
      payload: {
        status: "sold"
      }
    });
    const listed = await app.inject({
      method: "GET",
      url: "/api/v1/listings"
    });
    const detail = await app.inject({
      method: "GET",
      url: `/api/v1/listings/${listing.id}`
    });
    const listingIds = listed.json().data.listings.map((item: { id: string }) => item.id);

    expect(updated.statusCode).toBe(200);
    expect(updated.json().data.listing).toMatchObject({
      id: listing.id,
      status: "sold"
    });
    expect(listingIds).not.toContain(listing.id);
    expect(detail.statusCode).toBe(404);
  });

  it("allows the owner to archive and reactivate a listing", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const archived = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "PATCH",
      url: `/api/v1/listings/${listing.id}/status`,
      payload: {
        status: "archived"
      }
    });
    const hidden = await app.inject({
      method: "GET",
      url: "/api/v1/listings"
    });
    const reactivated = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "PATCH",
      url: `/api/v1/listings/${listing.id}/status`,
      payload: {
        status: "active"
      }
    });
    const visible = await app.inject({
      method: "GET",
      url: "/api/v1/listings"
    });
    const hiddenIds = hidden.json().data.listings.map((item: { id: string }) => item.id);
    const visibleIds = visible.json().data.listings.map((item: { id: string }) => item.id);

    expect(archived.statusCode).toBe(200);
    expect(archived.json().data.listing.status).toBe("archived");
    expect(hiddenIds).not.toContain(listing.id);
    expect(reactivated.statusCode).toBe(200);
    expect(reactivated.json().data.listing.status).toBe("active");
    expect(visibleIds).toContain(listing.id);
  });

  it("allows reserved listings to remain public and messageable", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const reserved = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "PATCH",
      url: `/api/v1/listings/${listing.id}/status`,
      payload: {
        status: "reserved"
      }
    });
    const listed = await app.inject({
      method: "GET",
      url: "/api/v1/listings"
    });
    const detail = await app.inject({
      method: "GET",
      url: `/api/v1/listings/${listing.id}`
    });
    const listingIds = listed.json().data.listings.map((item: { id: string }) => item.id);

    expect(reserved.statusCode).toBe(200);
    expect(reserved.json().data.listing.status).toBe("reserved");
    expect(listingIds).toContain(listing.id);
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data.listing.status).toBe("reserved");
  });

  it("rejects invalid listing status values and invalid status transitions", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const invalidStatus = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "PATCH",
      url: `/api/v1/listings/${listing.id}/status`,
      payload: {
        status: "deleted"
      }
    });
    const sold = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "PATCH",
      url: `/api/v1/listings/${listing.id}/status`,
      payload: {
        status: "sold"
      }
    });
    const invalidTransition = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "PATCH",
      url: `/api/v1/listings/${listing.id}/status`,
      payload: {
        status: "active"
      }
    });

    expect(invalidStatus.statusCode).toBe(400);
    expect(invalidStatus.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_LISTING_STATUS"
      }
    });
    expect(sold.statusCode).toBe(200);
    expect(invalidTransition.statusCode).toBe(400);
    expect(invalidTransition.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_STATUS_TRANSITION"
      }
    });
  });

  it("does not expose internal seller user id in public listing list", async () => {
    const seller = await createUser(app);
    await createListing(app, seller.accessToken);
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/listings"
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain(seller.user.id);
    expect(response.body).not.toContain("userId");
    expect(response.body).not.toContain("user_id");
  });

  it("does not expose password hash or user email in listing detail", async () => {
    const seller = await createUser(app, { email: "seller-private@example.com" });
    const listing = await createListing(app, seller.accessToken);
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/listings/${listing.id}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain("passwordHash");
    expect(response.body).not.toContain("password_hash");
    expect(response.body).not.toContain("seller-private@example.com");
  });
});

function tinyPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lS4c3wAAAABJRU5ErkJggg==",
    "base64"
  );
}

function multipartRequest(input: {
  buffer: Buffer;
  fieldName?: string;
  filename: string;
  mimetype: string;
}): {
  headers: Record<string, string>;
  payload: Buffer;
} {
  const boundary = `----babyloop-${Math.random().toString(16).slice(2)}`;
  const fieldName = input.fieldName ?? "image";
  const head = Buffer.from(
    [
      `--${boundary}`,
      `Content-Disposition: form-data; name="${fieldName}"; filename="${input.filename}"`,
      `Content-Type: ${input.mimetype}`,
      "",
      ""
    ].join("\r\n")
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);

  return {
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`
    },
    payload: Buffer.concat([head, input.buffer, tail])
  };
}
