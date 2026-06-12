import {
  events,
  listingImages,
  listings,
  moderationCases
} from "@babyloop/database/schema";
import { and, eq, gte, inArray, sql, type SQL } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { AdminDashboardSummaryResponse } from "../schemas/admin-dashboard.schemas.js";

const LISTING_STATUSES = ["draft", "active", "reserved", "sold", "archived"] as const;

export async function getAdminDashboardSummary(
  app: FastifyInstance
): Promise<AdminDashboardSummaryResponse> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    listingStatusCounts,
    listingsCreatedLast7Days,
    listingsUpdatedLast7Days,
    listingsWithRejectedImages,
    imageReviewCounts,
    imagesReviewedLast7Days,
    moderationCounts,
    casesCreatedLast7Days,
    sensitiveAccessGrantedLast7Days,
    sensitiveAccessDeniedLast7Days,
    listingActionsLast7Days,
    imageReviewActionsLast7Days
  ] = await Promise.all([
    countListingsByStatus(app),
    countListings(app, gte(listings.createdAt, since)),
    countListings(app, gte(listings.updatedAt, since)),
    countListingsWithRejectedImages(app),
    countImagesByReviewStatus(app),
    countListingImages(
      app,
      and(
        gte(listingImages.reviewedAt, since),
        inArray(listingImages.reviewStatus, ["approved", "rejected"])
      )
    ),
    countModerationCasesByOpenState(app),
    countModerationCases(app, gte(moderationCases.createdAt, since)),
    countEventsSince(app, "admin_sensitive_access_granted", since),
    countEventsSince(app, "admin_sensitive_access_denied", since),
    countEventsSince(app, "admin_listing_action_applied", since),
    countEventsSince(app, "admin_listing_image_review_applied", since)
  ]);

  return {
    listings: {
      totalListings: sumCounts(listingStatusCounts),
      activeListings: listingStatusCounts.active ?? 0,
      archivedListings: listingStatusCounts.archived ?? 0,
      soldListings: listingStatusCounts.sold ?? 0,
      reservedListings: listingStatusCounts.reserved ?? 0,
      draftListings: listingStatusCounts.draft ?? 0,
      listingsCreatedLast7Days,
      listingsUpdatedLast7Days,
      listingsWithRejectedImages
    },
    images: {
      totalListingImages: sumCounts(imageReviewCounts),
      approvedListingImages: imageReviewCounts.approved ?? 0,
      rejectedListingImages: imageReviewCounts.rejected ?? 0,
      imagesReviewedLast7Days
    },
    moderation: {
      totalModerationCases: moderationCounts.open + moderationCounts.closed,
      openModerationCases: moderationCounts.open,
      closedModerationCases: moderationCounts.closed,
      casesCreatedLast7Days,
      sensitiveAccessGrantedLast7Days,
      sensitiveAccessDeniedLast7Days
    },
    actions: {
      listingActionsLast7Days,
      imageReviewActionsLast7Days
    }
  };
}

async function countListingsByStatus(
  app: FastifyInstance
): Promise<Record<(typeof LISTING_STATUSES)[number], number>> {
  const rows = await app.db
    .select({
      status: listings.status,
      itemCount: sql<number>`count(${listings.id})::int`
    })
    .from(listings)
    .groupBy(listings.status);
  const counts = Object.fromEntries(LISTING_STATUSES.map((status) => [status, 0])) as Record<
    (typeof LISTING_STATUSES)[number],
    number
  >;

  for (const row of rows) {
    counts[row.status] = row.itemCount;
  }

  return counts;
}

async function countImagesByReviewStatus(
  app: FastifyInstance
): Promise<Record<"approved" | "rejected", number>> {
  const rows = await app.db
    .select({
      reviewStatus: listingImages.reviewStatus,
      itemCount: sql<number>`count(${listingImages.id})::int`
    })
    .from(listingImages)
    .groupBy(listingImages.reviewStatus);
  const counts: Record<"approved" | "rejected", number> = {
    approved: 0,
    rejected: 0
  };

  for (const row of rows) {
    counts[row.reviewStatus] = row.itemCount;
  }

  return counts;
}

async function countModerationCasesByOpenState(
  app: FastifyInstance
): Promise<{ open: number; closed: number }> {
  const rows = await app.db
    .select({
      status: moderationCases.status,
      itemCount: sql<number>`count(${moderationCases.id})::int`
    })
    .from(moderationCases)
    .groupBy(moderationCases.status);

  return rows.reduce(
    (counts, row) => {
      if (row.status === "pending" || row.status === "in_review") {
        counts.open += row.itemCount;
      } else {
        counts.closed += row.itemCount;
      }

      return counts;
    },
    { open: 0, closed: 0 }
  );
}

async function countListingsWithRejectedImages(app: FastifyInstance): Promise<number> {
  const [row] = await app.db
    .select({
      itemCount: sql<number>`count(distinct ${listingImages.listingId})::int`
    })
    .from(listingImages)
    .where(eq(listingImages.reviewStatus, "rejected"));

  return row?.itemCount ?? 0;
}

async function countEventsSince(
  app: FastifyInstance,
  eventType: string,
  since: Date
): Promise<number> {
  return countEvents(app, and(eq(events.eventType, eventType), gte(events.createdAt, since)));
}

async function countListings(app: FastifyInstance, whereClause?: SQL): Promise<number> {
  const [row] = await app.db
    .select({
      itemCount: sql<number>`count(*)::int`
    })
    .from(listings)
    .where(whereClause);

  return row?.itemCount ?? 0;
}

async function countListingImages(app: FastifyInstance, whereClause?: SQL): Promise<number> {
  const [row] = await app.db
    .select({
      itemCount: sql<number>`count(*)::int`
    })
    .from(listingImages)
    .where(whereClause);

  return row?.itemCount ?? 0;
}

async function countModerationCases(app: FastifyInstance, whereClause?: SQL): Promise<number> {
  const [row] = await app.db
    .select({
      itemCount: sql<number>`count(*)::int`
    })
    .from(moderationCases)
    .where(whereClause);

  return row?.itemCount ?? 0;
}

async function countEvents(
  app: FastifyInstance,
  whereClause?: SQL
): Promise<number> {
  const [row] = await app.db
    .select({
      itemCount: sql<number>`count(*)::int`
    })
    .from(events)
    .where(whereClause);

  return row?.itemCount ?? 0;
}

function sumCounts(counts: Record<string, number>): number {
  return Object.values(counts).reduce((total, count) => total + count, 0);
}
