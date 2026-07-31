import {
  listingImages,
  listings,
  profiles
} from "@babyloop/database/schema";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { authHeader, createUser } from "./helpers/auth.js";
import { resetTestDatabase } from "./helpers/db.js";
import { createCategory, createListing } from "./helpers/fixtures.js";

describe("child listing age matching", () => {
  let app: TestApp;

  beforeEach(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("persists paired age ranges on create and update", async () => {
    const seller = await createUser(app);
    const category = await createCategory(app.db);
    const created = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        categoryId: category.id,
        condition: "good",
        currency: "TRY",
        listingType: "sale",
        priceAmount: "1000.00",
        recommendedAgeMinMonths: 12,
        recommendedAgeMaxMonths: 24,
        title: "12-24 month listing"
      }
    });

    expect(created.statusCode).toBe(201);

    const listingId = created.json().data.listing.id as string;
    const updated = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "PATCH",
      url: `/api/v1/listings/${listingId}`,
      payload: {
        recommendedAgeMinMonths: 24,
        recommendedAgeMaxMonths: 36
      }
    });
    const [row] = await app.db
      .select({
        min: listings.recommendedAgeMinMonths,
        max: listings.recommendedAgeMaxMonths
      })
      .from(listings)
      .where(eq(listings.id, listingId));

    expect(created.json().data.listing).toMatchObject({
      recommendedAgeMinMonths: 12,
      recommendedAgeMaxMonths: 24
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().data.listing).toMatchObject({
      recommendedAgeMinMonths: 24,
      recommendedAgeMaxMonths: 36
    });
    expect(row).toEqual({ min: 24, max: 36 });
  });

  it("enforces the paired age range at database level", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    await expect(
      app.db
        .update(listings)
        .set({
          recommendedAgeMinMonths: 12,
          recommendedAgeMaxMonths: null
        })
        .where(eq(listings.id, listing.id))
    ).rejects.toThrow();

    await expect(
      app.db
        .update(listings)
        .set({
          recommendedAgeMinMonths: 24,
          recommendedAgeMaxMonths: 12
        })
        .where(eq(listings.id, listing.id))
    ).rejects.toThrow();
  });

  it("returns only safe public matches in deterministic order", async () => {
    const buyer = await createUser(app, { email: "age-match-buyer@babyloop.test" });
    const seller = await createUser(app, { email: "age-match-seller@babyloop.test" });
    const suspendedSeller = await createUser(app, {
      email: "age-match-suspended-seller@babyloop.test"
    });
    const category = await createCategory(app.db, {
      name: "Age match toys",
      slug: "age-match-toys"
    });
    const childResponse = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/child-profiles",
      payload: {
        ageBand: "toddler_12_24",
        ageMonths: 18,
        label: "Ada"
      }
    });
    const specificOld = await createListing(app, seller.accessToken, {
      categoryId: category.id,
      title: "Specific older"
    });
    const specificNew = await createListing(app, seller.accessToken, {
      categoryId: category.id,
      title: "Specific newer"
    });
    const independentNewest = await createListing(app, seller.accessToken, {
      categoryId: category.id,
      title: "Independent newest"
    });
    const mismatched = await createListing(app, seller.accessToken, {
      categoryId: category.id,
      title: "Mismatched"
    });
    const reserved = await createListing(app, seller.accessToken, {
      categoryId: category.id,
      title: "Reserved"
    });
    const suspendedSellerListing = await createListing(app, suspendedSeller.accessToken, {
      categoryId: category.id,
      title: "Suspended seller listing"
    });
    const ownListing = await createListing(app, buyer.accessToken, {
      categoryId: category.id,
      title: "Own listing"
    });
    const unpublished = await createListing(app, seller.accessToken, {
      categoryId: category.id,
      title: "Unpublished"
    });
    const unapproved = await createListing(app, seller.accessToken, {
      categoryId: category.id,
      title: "Unapproved",
      withApprovedImage: false
    });
    const now = Date.now();

    await setListingRange(app, specificOld.id, 12, 24, new Date(now - 30_000));
    await setListingRange(app, specificNew.id, 12, 24, new Date(now - 20_000));
    await setListingRange(app, independentNewest.id, null, null, new Date(now));
    await setListingRange(app, mismatched.id, 24, 36, new Date(now + 10_000));
    await setListingRange(app, reserved.id, 12, 24, new Date(now + 15_000));
    await setListingRange(app, suspendedSellerListing.id, 12, 24, new Date(now + 17_000));
    await setListingRange(app, ownListing.id, 12, 24, new Date(now + 20_000));
    await setListingRange(app, unpublished.id, 12, 24, new Date(now + 30_000));
    await app.db
      .update(listings)
      .set({ status: "reserved" })
      .where(eq(listings.id, reserved.id));
    await app.db
      .update(profiles)
      .set({ safetyStatus: "suspended" })
      .where(eq(profiles.id, suspendedSeller.profile.id));
    await app.db
      .update(listings)
      .set({
        status: "draft",
        publicationState: "awaiting_images",
        publishAfter: null,
        publishedAt: null
      })
      .where(eq(listings.id, unpublished.id));
    await app.db
      .update(listings)
      .set({
        status: "active",
        publicationState: "published",
        publishedAt: new Date(now + 40_000),
        recommendedAgeMinMonths: 12,
        recommendedAgeMaxMonths: 24
      })
      .where(eq(listings.id, unapproved.id));
    await app.db.insert(listingImages).values({
      listingId: unapproved.id,
      reviewStatus: "rejected",
      sortOrder: 0,
      url: `/api/v1/uploads/listings/${unapproved.id}/rejected.png`
    });
    await app.db.insert(listingImages).values({
      listingId: specificNew.id,
      reviewStatus: "approved",
      sortOrder: 1,
      url: `/api/v1/uploads/listings/${specificNew.id}/second.png`
    });

    const response = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "GET",
      url: "/api/v1/child-profiles/lifecycle-recommendations"
    });

    expect(response.statusCode).toBe(200);

    const group = response.json().data.groups.find(
      (candidate: { childProfileId: string }) =>
        candidate.childProfileId === childResponse.json().data.childProfile.id
    );
    const ids = group.matchedListings.map((listing: { id: string }) => listing.id);

    expect(ids).toEqual([specificNew.id, specificOld.id, independentNewest.id]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(mismatched.id);
    expect(ids).not.toContain(reserved.id);
    expect(ids).not.toContain(suspendedSellerListing.id);
    expect(ids).not.toContain(ownListing.id);
    expect(ids).not.toContain(unpublished.id);
    expect(ids).not.toContain(unapproved.id);
  });

  it("shows only age-independent listings when current age is unknown", async () => {
    const buyer = await createUser(app, { email: "unknown-age-buyer@babyloop.test" });
    const seller = await createUser(app, { email: "unknown-age-seller@babyloop.test" });
    const category = await createCategory(app.db);
    await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/child-profiles",
      payload: {
        ageBand: "child_3_plus",
        label: "Yaşı bilinmeyen çocuk"
      }
    });
    const specific = await createListing(app, seller.accessToken, {
      categoryId: category.id,
      title: "Specific age"
    });
    const independent = await createListing(app, seller.accessToken, {
      categoryId: category.id,
      title: "Independent age"
    });
    await setListingRange(app, specific.id, 36, 72, new Date());
    await setListingRange(app, independent.id, null, null, new Date());

    const response = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "GET",
      url: "/api/v1/child-profiles/lifecycle-recommendations"
    });
    const ids = response.json().data.groups[0].matchedListings.map(
      (listing: { id: string }) => listing.id
    );

    expect(ids).toEqual([independent.id]);
  });

  it("returns fully localized Turkish lifecycle category copy", async () => {
    const parent = await createUser(app, { email: "turkish-lifecycle@babyloop.test" });
    await createCategory(app.db, {
      name: "Montessori Oyuncakları",
      slug: "montessori-toys"
    });
    await createCategory(app.db, {
      name: "Oyuncaklar",
      slug: "toys"
    });
    await app.inject({
      headers: authHeader(parent.accessToken),
      method: "POST",
      url: "/api/v1/child-profiles",
      payload: {
        ageBand: "preschool_24_36",
        ageMonths: 30,
        label: "Deniz"
      }
    });

    const response = await app.inject({
      headers: authHeader(parent.accessToken),
      method: "GET",
      url: "/api/v1/child-profiles/lifecycle-recommendations?locale=tr"
    });

    expect(response.statusCode).toBe(200);
    const recommendations = response.json().data.groups[0].recommendations as Array<{
      categoryName: string;
      reasonLabel: string;
      whyNow: string;
    }>;

    expect(recommendations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        categoryName: "Montessori Oyuncakları",
        whyNow: "24–36 ay dönemi; odaklanma, sınıflandırma, sembolik oyun ve kendi başına oynama becerilerinin gelişimini destekleyen güçlü bir dönemdir."
      }),
      expect.objectContaining({
        categoryName: "Oyuncaklar",
        whyNow: "Oyuncaklar; hayal gücünü, sosyal oyunu ve daha uzun süre bağımsız oynayabilme becerisini destekleyebilir."
      })
    ]));
    expect(JSON.stringify(recommendations)).not.toMatch(
      /24-36 month|focused play|pretend play|independent play|can support|relevant for|useful for/iu
    );
  });
});

async function setListingRange(
  app: TestApp,
  listingId: string,
  min: number | null,
  max: number | null,
  publishedAt: Date
): Promise<void> {
  await app.db
    .update(listings)
    .set({
      recommendedAgeMinMonths: min,
      recommendedAgeMaxMonths: max,
      publishedAt
    })
    .where(eq(listings.id, listingId));
}
