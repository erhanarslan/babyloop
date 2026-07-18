import {
  listingImages,
  listings,
  notifications,
  productCategories,
  savedSearches
} from "@babyloop/database/schema";
import { and, desc, eq, ne, or, sql, type SQL } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import {
  createNotification,
  type NotificationResponse
} from "./notifications.service.js";
import { isNotificationPreferenceEnabledForDelivery } from "./notification-preferences.service.js";
import { safePlainTextFallback } from "./text-safety.service.js";

export type SavedSearchNotificationGenerationResponse = {
  createdCount: number;
  skippedCount: number;
  notifications: NotificationResponse[];
  deliveryChannel: "in_app";
  draftOnly: false;
  note: string;
};

type SavedSearchCandidate = {
  id: string;
  name: string;
  queryText: string | null;
  categoryId: string | null;
  listingType: string | null;
  condition: string | null;
  priceMin: string | null;
  priceMax: string | null;
  hasImages: boolean;
};

type MatchingListingCandidate = {
  id: string;
  sellerProfileId: string;
  categoryId: string;
  categoryName: string;
  title: string;
  priceAmount: string | null;
  currency: string;
  listingType: string;
  condition: string;
};

const SAVED_SEARCH_NOTIFICATION_SOURCE = "saved_search";
const SAVED_SEARCH_NOTIFICATION_KIND = "saved_search_match";

export async function generateSavedSearchNotifications(
  app: FastifyInstance,
  profileId: string
): Promise<SavedSearchNotificationGenerationResponse> {
  const preferenceEnabled = await isNotificationPreferenceEnabledForDelivery(
    app,
    profileId,
    "saved_search",
    "in_app"
  );
  const searches = await listEnabledSavedSearches(app, profileId);
  const createdNotifications: NotificationResponse[] = [];
  let skippedCount = 0;

  for (const savedSearch of searches) {
    if (!preferenceEnabled) {
      skippedCount += 1;
      continue;
    }

    const matchingListings = await listMatchingListingsForSavedSearch(app, profileId, savedSearch);

    if (matchingListings.length === 0) {
      continue;
    }

    for (const listing of matchingListings.slice(0, 3)) {
      const dedupeKey = buildSavedSearchDedupeKey(savedSearch, listing);
      const alreadyCreated = await hasExistingSavedSearchNotification(
        app,
        profileId,
        savedSearch.id,
        listing.id,
        dedupeKey
      );

      if (alreadyCreated) {
        skippedCount += 1;
        continue;
      }

      const notification = await createNotification(app, {
        recipientProfileId: profileId,
        actorProfileId: null,
        type: "system",
        title: buildNotificationTitle(savedSearch),
        body: buildNotificationBody(savedSearch, listing),
        entityType: "listing",
        entityId: listing.id,
        metadata: {
          source: SAVED_SEARCH_NOTIFICATION_SOURCE,
          kind: SAVED_SEARCH_NOTIFICATION_KIND,
          dedupeKey,
          savedSearchId: savedSearch.id,
          listingId: listing.id,
          categoryId: listing.categoryId,
          categoryName: safeCategoryName(listing.categoryName),
          listingTitle: safeListingTitle(listing.title),
          listingType: listing.listingType,
          condition: listing.condition,
          priceAmount: listing.priceAmount,
          currency: listing.currency,
          actionHref: `/listings/${listing.id}`
        }
      });

      if (notification) {
        createdNotifications.push(notification);
      } else {
        skippedCount += 1;
      }
    }
  }

  return {
    createdCount: createdNotifications.length,
    skippedCount,
    notifications: createdNotifications,
    deliveryChannel: "in_app",
    draftOnly: false,
    note: "Bu endpoint yalnızca uygulama içi BabyLoop bildirimleri üretir. Email, push veya n8n gönderimi yapmaz."
  };
}

async function listEnabledSavedSearches(
  app: FastifyInstance,
  profileId: string
): Promise<SavedSearchCandidate[]> {
  return app.db
    .select({
      id: savedSearches.id,
      name: savedSearches.name,
      queryText: savedSearches.queryText,
      categoryId: savedSearches.categoryId,
      listingType: savedSearches.listingType,
      condition: savedSearches.condition,
      priceMin: savedSearches.priceMin,
      priceMax: savedSearches.priceMax,
      hasImages: savedSearches.hasImages
    })
    .from(savedSearches)
    .where(and(
      eq(savedSearches.profileId, profileId),
      eq(savedSearches.notificationsEnabled, true)
    ))
    .orderBy(desc(savedSearches.createdAt))
    .limit(50);
}

async function listMatchingListingsForSavedSearch(
  app: FastifyInstance,
  profileId: string,
  savedSearch: SavedSearchCandidate
): Promise<MatchingListingCandidate[]> {
  const filters: SQL[] = [
    or(eq(listings.status, "active"), eq(listings.status, "reserved"))!,
    eq(listings.publicationState, "published"),
    ne(listings.sellerProfileId, profileId)
  ];

  if (savedSearch.queryText) {
    filters.push(sql`${listings.title} ilike ${buildSafeILikePattern(savedSearch.queryText)} escape '\'`);
  }

  if (savedSearch.categoryId) {
    filters.push(eq(listings.categoryId, savedSearch.categoryId));
  }

  if (savedSearch.listingType) {
    filters.push(eq(listings.listingType, savedSearch.listingType as "sale" | "swap" | "donation" | "rent"));
  }

  if (savedSearch.condition) {
    filters.push(eq(
      listings.condition,
      savedSearch.condition as "new" | "like_new" | "good" | "fair" | "needs_repair"
    ));
  }

  if (savedSearch.priceMin) {
    filters.push(sql`${listings.priceAmount} is not null and ${listings.priceAmount} >= ${savedSearch.priceMin}`);
  }

  if (savedSearch.priceMax) {
    filters.push(sql`${listings.priceAmount} is not null and ${listings.priceAmount} <= ${savedSearch.priceMax}`);
  }

  filters.push(sql`exists (
    select 1
    from ${listingImages}
    where ${listingImages.listingId} = ${listings.id}
      and ${listingImages.reviewStatus} = 'approved'
  )`);

  return app.db
    .select({
      id: listings.id,
      sellerProfileId: listings.sellerProfileId,
      categoryId: listings.categoryId,
      categoryName: productCategories.name,
      title: listings.title,
      priceAmount: listings.priceAmount,
      currency: listings.currency,
      listingType: listings.listingType,
      condition: listings.condition
    })
    .from(listings)
    .innerJoin(productCategories, eq(listings.categoryId, productCategories.id))
    .where(and(...filters))
    .orderBy(desc(listings.createdAt))
    .limit(10);
}

async function hasExistingSavedSearchNotification(
  app: FastifyInstance,
  profileId: string,
  savedSearchId: string,
  listingId: string,
  dedupeKey: string
): Promise<boolean> {
  const [existing] = await app.db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(
      eq(notifications.recipientProfileId, profileId),
      eq(notifications.type, "system"),
      eq(notifications.entityType, "listing"),
      eq(notifications.entityId, listingId),
      sql`${notifications.metadata} @> ${JSON.stringify({
        source: SAVED_SEARCH_NOTIFICATION_SOURCE,
        savedSearchId,
        listingId,
        dedupeKey
      })}::jsonb`
    ))
    .limit(1);

  return Boolean(existing);
}

function buildSavedSearchDedupeKey(
  savedSearch: SavedSearchCandidate,
  listing: MatchingListingCandidate
): string {
  return [
    SAVED_SEARCH_NOTIFICATION_SOURCE,
    savedSearch.id,
    listing.id,
    savedSearch.queryText ?? "",
    savedSearch.categoryId ?? "",
    savedSearch.listingType ?? "",
    savedSearch.condition ?? "",
    savedSearch.priceMin ?? "",
    savedSearch.priceMax ?? "",
    savedSearch.hasImages ? "images" : "any"
  ].join(":");
}

function buildNotificationTitle(savedSearch: SavedSearchCandidate): string {
  const name = safePlainTextFallback(savedSearch.name, "Kaydettiğin arama", {
    maxLength: 120,
    minLength: 1
  });

  return `${name} için yeni ilan`;
}

function buildNotificationBody(
  savedSearch: SavedSearchCandidate,
  listing: MatchingListingCandidate
): string {
  const listingTitle = safeListingTitle(listing.title);
  const searchName = safePlainTextFallback(savedSearch.name, "kaydettiğin arama", {
    maxLength: 120,
    minLength: 1
  });

  return `${searchName} ile eşleşen yeni bir ilan var: ${listingTitle}.`;
}

function safeListingTitle(value: string): string {
  return safePlainTextFallback(value, "İlan", {
    maxLength: 160,
    minLength: 1
  });
}

function safeCategoryName(value: string): string {
  return safePlainTextFallback(value, "Kategori", {
    maxLength: 120,
    minLength: 1
  });
}

function buildSafeILikePattern(value: string): string {
  const escaped = value
    .trim()
    .replace(/[\\%_]/g, (match) => `\\${match}`);

  return `%${escaped}%`;
}
