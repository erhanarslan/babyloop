import {
  events,
  listings,
  productCategories
} from "@babyloop/database/schema";
import { and, desc, eq, gte, inArray, sql, type SQL } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type {
  AdminProductAnalyticsEventCountResponse,
  AdminProductAnalyticsEventName,
  AdminProductAnalyticsSearchBucketResponse,
  AdminProductAnalyticsSourceCountResponse,
  AdminProductAnalyticsSummaryResponse,
  AdminProductAnalyticsTopCategoryResponse,
  AdminProductAnalyticsTopListingResponse
} from "../schemas/admin-product-analytics.schemas.js";

const PRODUCT_EVENT_PREFIX = "product_";

const PRODUCT_EVENT_TYPES: string[] = [
  "product_listing_detail_viewed",
  "product_listing_card_clicked",
  "product_contact_seller_intent",
  "product_recently_viewed_listing_clicked",
  "product_category_viewed",
  "product_search_performed"
];

const LISTING_PRODUCT_EVENT_TYPES: string[] = [
  "product_listing_detail_viewed",
  "product_listing_card_clicked",
  "product_contact_seller_intent",
  "product_recently_viewed_listing_clicked"
];

export async function getAdminProductAnalyticsSummary(
  app: FastifyInstance
): Promise<AdminProductAnalyticsSummaryResponse> {
  const now = new Date();
  const since24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const since7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalEvents,
    eventsLast24Hours,
    eventsLast7Days,
    listingDetailViewsLast7Days,
    categoryViewsLast7Days,
    searchesLast7Days,
    recentlyViewedClicksLast7Days,
    eventCounts,
    sourceCounts,
    topCategories,
    topListings,
    searchResultBuckets
  ] = await Promise.all([
    countProductEvents(app),
    countProductEvents(app, gte(events.createdAt, since24Hours)),
    countProductEvents(app, gte(events.createdAt, since7Days)),
    countProductEvents(app, and(eq(events.eventType, "product_listing_detail_viewed"), gte(events.createdAt, since7Days))),
    countProductEvents(app, and(eq(events.eventType, "product_category_viewed"), gte(events.createdAt, since7Days))),
    countProductEvents(app, and(eq(events.eventType, "product_search_performed"), gte(events.createdAt, since7Days))),
    countProductEvents(app, and(eq(events.eventType, "product_recently_viewed_listing_clicked"), gte(events.createdAt, since7Days))),
    countProductEventsByType(app),
    countProductEventsBySource(app),
    listTopProductCategories(app, since7Days),
    listTopProductListings(app, since7Days),
    countSearchResultBuckets(app, since7Days)
  ]);

  return {
    totals: {
      totalEvents,
      eventsLast24Hours,
      eventsLast7Days,
      listingDetailViewsLast7Days,
      categoryViewsLast7Days,
      searchesLast7Days,
      recentlyViewedClicksLast7Days
    },
    eventCounts,
    sourceCounts,
    topCategories,
    topListings,
    searchResultBuckets
  };
}

async function countProductEvents(app: FastifyInstance, extraWhere?: SQL): Promise<number> {
  const whereClause = extraWhere
    ? and(inArray(events.eventType, PRODUCT_EVENT_TYPES), extraWhere)
    : inArray(events.eventType, PRODUCT_EVENT_TYPES);

  const [row] = await app.db
    .select({
      itemCount: sql<number>`count(${events.id})::int`
    })
    .from(events)
    .where(whereClause);

  return row?.itemCount ?? 0;
}

async function countProductEventsByType(
  app: FastifyInstance
): Promise<AdminProductAnalyticsEventCountResponse[]> {
  const rows = await app.db
    .select({
      eventType: events.eventType,
      itemCount: sql<number>`count(${events.id})::int`
    })
    .from(events)
    .where(inArray(events.eventType, PRODUCT_EVENT_TYPES))
    .groupBy(events.eventType)
    .orderBy(desc(sql`count(${events.id})`));

  return rows.map((row) => ({
    eventType: stripProductPrefix(row.eventType),
    count: row.itemCount
  }));
}

async function countProductEventsBySource(
  app: FastifyInstance
): Promise<AdminProductAnalyticsSourceCountResponse[]> {
  const sourceExpression = sql<string>`coalesce(${events.metadata}->>'source', 'unknown')`;

  const rows = await app.db
    .select({
      source: sourceExpression,
      itemCount: sql<number>`count(${events.id})::int`
    })
    .from(events)
    .where(inArray(events.eventType, PRODUCT_EVENT_TYPES))
    .groupBy(sourceExpression)
    .orderBy(desc(sql`count(${events.id})`))
    .limit(12);

  return rows.map((row) => ({
    source: row.source,
    count: row.itemCount
  }));
}

async function listTopProductCategories(
  app: FastifyInstance,
  since: Date
): Promise<AdminProductAnalyticsTopCategoryResponse[]> {
  const rows = await app.db
    .select({
      categoryId: productCategories.id,
      categoryName: productCategories.name,
      categorySlug: productCategories.slug,
      viewCount: sql<number>`count(${events.id})::int`
    })
    .from(events)
    .innerJoin(productCategories, eq(events.entityId, productCategories.id))
    .where(
      and(
        eq(events.eventType, "product_category_viewed"),
        eq(events.entityType, "category"),
        gte(events.createdAt, since)
      )
    )
    .groupBy(productCategories.id, productCategories.name, productCategories.slug)
    .orderBy(desc(sql`count(${events.id})`))
    .limit(12);

  return rows;
}

async function listTopProductListings(
  app: FastifyInstance,
  since: Date
): Promise<AdminProductAnalyticsTopListingResponse[]> {
  const rows = await app.db
    .select({
      listingId: listings.id,
      title: listings.title,
      categoryId: productCategories.id,
      categoryName: productCategories.name,
      categorySlug: productCategories.slug,
      eventCount: sql<number>`count(${events.id})::int`
    })
    .from(events)
    .innerJoin(listings, eq(events.entityId, listings.id))
    .innerJoin(productCategories, eq(listings.categoryId, productCategories.id))
    .where(
      and(
        inArray(events.eventType, LISTING_PRODUCT_EVENT_TYPES),
        eq(events.entityType, "listing"),
        gte(events.createdAt, since)
      )
    )
    .groupBy(
      listings.id,
      listings.title,
      productCategories.id,
      productCategories.name,
      productCategories.slug
    )
    .orderBy(desc(sql`count(${events.id})`))
    .limit(12);

  return rows;
}

async function countSearchResultBuckets(
  app: FastifyInstance,
  since: Date
): Promise<AdminProductAnalyticsSearchBucketResponse[]> {
  const bucketExpression = sql<string>`coalesce(${events.metadata}->>'resultBucket', 'unknown')`;

  const rows = await app.db
    .select({
      resultBucket: bucketExpression,
      itemCount: sql<number>`count(${events.id})::int`
    })
    .from(events)
    .where(
      and(
        eq(events.eventType, "product_search_performed"),
        gte(events.createdAt, since)
      )
    )
    .groupBy(bucketExpression)
    .orderBy(desc(sql`count(${events.id})`));

  return rows.map((row) => ({
    resultBucket: row.resultBucket,
    count: row.itemCount
  }));
}

function stripProductPrefix(eventType: string): AdminProductAnalyticsEventName {
  const strippedValue = eventType.startsWith(PRODUCT_EVENT_PREFIX)
    ? eventType.slice(PRODUCT_EVENT_PREFIX.length)
    : eventType;

  return strippedValue as AdminProductAnalyticsEventName;
}
