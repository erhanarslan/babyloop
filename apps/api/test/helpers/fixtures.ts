import type { Database } from "@babyloop/database";
import {
  events,
  listingImages,
  listings,
  notifications,
  productCategories
} from "@babyloop/database/schema";
import { and, eq } from "drizzle-orm";
import {
  processDueListingPublications,
  reconcileListingPublication
} from "../../src/services/listing-publication.service.js";
import type { TestApp } from "./app.js";
import { authHeader } from "./auth.js";

let sequence = 0;

type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export async function createCategory(
  db: Database,
  overrides: Partial<{
    name: string;
    slug: string;
  }> = {}
) {
  const id = nextId();
  const [category] = await db
    .insert(productCategories)
    .values({
      name: overrides.name ?? `Category ${id}`,
      slug: overrides.slug ?? `category-${id}`
    })
    .returning({
      id: productCategories.id,
      name: productCategories.name,
      slug: productCategories.slug
    });

  if (!category) {
    throw new Error("Category setup failed.");
  }

  return category;
}

export async function createListing(
  app: TestApp,
  token: string,
  overrides: Partial<{
    categoryId: string;
    condition: string;
    listingType: string;
    priceAmount: string;
    title: string;
    withApprovedImage: boolean;
    preservePublicationNotification: boolean;
  }> = {}
) {
  const categoryId = overrides.categoryId ?? (await createCategory(app.db)).id;
  const response = await app.inject({
    headers: authHeader(token),
    method: "POST",
    url: "/api/v1/listings",
    payload: {
      categoryId,
      condition: overrides.condition ?? "good",
      currency: "TRY",
      listingType: overrides.listingType ?? "sale",
      priceAmount: overrides.priceAmount ?? "1000.00",
      title: overrides.title ?? `Listing ${nextId()}`
    }
  });

  if (response.statusCode !== 201) {
    throw new Error(`Listing setup failed: ${response.statusCode} ${response.body}`);
  }

  const listing = response.json<ApiSuccess<{
    listing: {
      id: string;
      title: string;
    };
  }>>().data.listing;

  if (overrides.withApprovedImage !== false) {
    const now = new Date();

    const [approvedImage] = await app.db
      .insert(listingImages)
      .values({
        authenticityCheckedAt: now,
        authenticityDecision: "allow",
        authenticityFlags: {},
        authenticityReasons: [],
        listingId: listing.id,
        reviewStatus: "approved",
        reviewedAt: now,
        sortOrder: 0,
        url: `/api/v1/uploads/listings/${listing.id}/fixture.png`
      })
      .returning({
        id: listingImages.id
      });

    if (!approvedImage) {
      throw new Error(
        `Approved image fixture setup failed for listing ${listing.id}.`
      );
    }

    const reconciled = await reconcileListingPublication(
      app,
      listing.id,
      {
        trigger: "test_fixture_ai_approved"
      }
    );

    if (
      !reconciled ||
      reconciled.status !== "draft" ||
      reconciled.publicationState !== "scheduled" ||
      !reconciled.publishAfter
    ) {
      throw new Error(
        `Listing fixture did not enter scheduled publication: ${JSON.stringify(
          reconciled
        )}`
      );
    }

    const publishedCount = await processDueListingPublications(
      app,
      {
        now: new Date(reconciled.publishAfter.getTime() + 1)
      }
    );

    if (publishedCount !== 1) {
      throw new Error(
        `Expected one fixture listing to publish, received ${publishedCount}.`
      );
    }

    const [publishedListing] = await app.db
      .select({
        id: listings.id,
        publicationState: listings.publicationState,
        publishedAt: listings.publishedAt,
        status: listings.status
      })
      .from(listings)
      .where(eq(listings.id, listing.id))
      .limit(1);

    if (
      !publishedListing ||
      publishedListing.status !== "active" ||
      publishedListing.publicationState !== "published" ||
      !publishedListing.publishedAt
    ) {
      throw new Error(
        `Published listing fixture verification failed: ${JSON.stringify(
          publishedListing
        )}`
      );
    }


    if (overrides.preservePublicationNotification !== true) {
      await app.db
        .delete(notifications)
        .where(
          and(
            eq(notifications.type, "listing_status_changed"),
            eq(notifications.entityType, "listing"),
            eq(notifications.entityId, listing.id)
          )
        );
    }
  }

  return listing;
}

export async function createConversation(
  app: TestApp,
  token: string,
  listingId: string
) {
  return app.inject({
    headers: authHeader(token),
    method: "POST",
    url: "/api/v1/conversations",
    payload: {
      listingId
    }
  });
}

export async function getListingSellerProfileId(
  db: Database,
  listingId: string
): Promise<string> {
  const [row] = await db
    .select({
      sellerProfileId: listings.sellerProfileId
    })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);

  if (!row) {
    throw new Error("Listing seller lookup failed.");
  }

  return row.sellerProfileId;
}

export async function countEvents(
  db: Database,
  eventType: string,
  entityId: string
): Promise<number> {
  const rows = await db
    .select({
      id: events.id
    })
    .from(events)
    .where(and(eq(events.eventType, eventType), eq(events.entityId, entityId)));

  return rows.length;
}

function nextId(): number {
  sequence += 1;
  return sequence;
}
