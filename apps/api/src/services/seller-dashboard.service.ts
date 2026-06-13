import {
  events,
  favorites,
  listings,
  productCategories
} from "@babyloop/database/schema";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

const SELLER_PRODUCT_EVENT_TYPES: string[] = [
  "product_listing_detail_viewed",
  "product_listing_card_clicked",
  "product_contact_seller_intent",
  "product_recently_viewed_listing_clicked"
];

export type SellerDashboardSummaryResponse = {
  totals: {
    totalListings: number;
    activeListings: number;
    reservedListings: number;
    soldListings: number;
    archivedListings: number;
    totalFavorites: number;
    listingDetailViews: number;
    listingClicks: number;
    contactSellerIntents: number;
  };
  listings: Array<{
    listingId: string;
    title: string;
    status: string;
    categoryName: string;
    categorySlug: string;
    createdAt: string;
    favoriteCount: number;
    detailViews: number;
    listingClicks: number;
    contactSellerIntents: number;
  }>;
};

type ListingDashboardRow = {
  listingId: string;
  title: string;
  status: string;
  categoryName: string;
  categorySlug: string;
  createdAt: Date;
};

export async function getSellerDashboardSummary(
  app: FastifyInstance,
  sellerProfileId: string
): Promise<SellerDashboardSummaryResponse> {
  const listingRows = await app.db
    .select({
      listingId: listings.id,
      title: listings.title,
      status: listings.status,
      categoryName: productCategories.name,
      categorySlug: productCategories.slug,
      createdAt: listings.createdAt
    })
    .from(listings)
    .innerJoin(productCategories, eq(listings.categoryId, productCategories.id))
    .where(eq(listings.sellerProfileId, sellerProfileId))
    .orderBy(desc(listings.createdAt))
    .limit(100);

  const listingIds = listingRows.map((listing) => listing.listingId);

  if (listingIds.length === 0) {
    return {
      totals: {
        totalListings: 0,
        activeListings: 0,
        reservedListings: 0,
        soldListings: 0,
        archivedListings: 0,
        totalFavorites: 0,
        listingDetailViews: 0,
        listingClicks: 0,
        contactSellerIntents: 0
      },
      listings: []
    };
  }

  const [favoriteCounts, eventCounts] = await Promise.all([
    getFavoriteCounts(app, listingIds),
    getEventCounts(app, listingIds)
  ]);

  const dashboardListings = listingRows.map((listing) => {
    const counts = eventCounts.get(listing.listingId) ?? {
      contactSellerIntents: 0,
      detailViews: 0,
      listingClicks: 0
    };

    return {
      listingId: listing.listingId,
      title: listing.title,
      status: listing.status,
      categoryName: listing.categoryName,
      categorySlug: listing.categorySlug,
      createdAt: listing.createdAt.toISOString(),
      favoriteCount: favoriteCounts.get(listing.listingId) ?? 0,
      detailViews: counts.detailViews,
      listingClicks: counts.listingClicks,
      contactSellerIntents: counts.contactSellerIntents
    };
  });

  return {
    totals: {
      totalListings: listingRows.length,
      activeListings: countByStatus(listingRows, "active"),
      reservedListings: countByStatus(listingRows, "reserved"),
      soldListings: countByStatus(listingRows, "sold"),
      archivedListings: countByStatus(listingRows, "archived"),
      totalFavorites: sum(dashboardListings.map((listing) => listing.favoriteCount)),
      listingDetailViews: sum(dashboardListings.map((listing) => listing.detailViews)),
      listingClicks: sum(dashboardListings.map((listing) => listing.listingClicks)),
      contactSellerIntents: sum(dashboardListings.map((listing) => listing.contactSellerIntents))
    },
    listings: dashboardListings
  };
}

async function getFavoriteCounts(
  app: FastifyInstance,
  listingIds: string[]
): Promise<Map<string, number>> {
  const rows = await app.db
    .select({
      listingId: favorites.listingId,
      itemCount: sql<number>`count(${favorites.id})::int`
    })
    .from(favorites)
    .where(inArray(favorites.listingId, listingIds))
    .groupBy(favorites.listingId);

  return new Map(rows.map((row) => [row.listingId, row.itemCount]));
}

async function getEventCounts(
  app: FastifyInstance,
  listingIds: string[]
): Promise<Map<string, {
  contactSellerIntents: number;
  detailViews: number;
  listingClicks: number;
}>> {
  const rows = await app.db
    .select({
      listingId: events.entityId,
      eventType: events.eventType,
      itemCount: sql<number>`count(${events.id})::int`
    })
    .from(events)
    .where(and(inArray(events.entityId, listingIds), inArray(events.eventType, SELLER_PRODUCT_EVENT_TYPES)))
    .groupBy(events.entityId, events.eventType);

  const countsByListing = new Map<string, {
    contactSellerIntents: number;
    detailViews: number;
    listingClicks: number;
  }>();

  for (const row of rows) {
    const current = countsByListing.get(row.listingId) ?? {
      contactSellerIntents: 0,
      detailViews: 0,
      listingClicks: 0
    };

    if (row.eventType === "product_listing_detail_viewed") {
      current.detailViews += row.itemCount;
    }

    if (row.eventType === "product_listing_card_clicked" || row.eventType === "product_recently_viewed_listing_clicked") {
      current.listingClicks += row.itemCount;
    }

    if (row.eventType === "product_contact_seller_intent") {
      current.contactSellerIntents += row.itemCount;
    }

    countsByListing.set(row.listingId, current);
  }

  return countsByListing;
}

function countByStatus(rows: ListingDashboardRow[], status: string): number {
  return rows.filter((row) => row.status === status).length;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
