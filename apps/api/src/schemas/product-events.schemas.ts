import { z } from "zod";

export const listingProductEventTypeSchema = z.enum([
  "listing_detail_viewed",
  "listing_card_clicked",
  "listing_recommendation_impression",
  "contact_seller_intent",
  "recently_viewed_listing_clicked"
]);

export const productEventTypeSchema = z.enum([
  "listing_detail_viewed",
  "listing_card_clicked",
  "listing_recommendation_impression",
  "contact_seller_intent",
  "recently_viewed_listing_clicked",
  "category_viewed",
  "search_performed",
  "saved_search_created",
  "saved_search_deleted",
  "favorite_added",
  "favorite_removed",
  "listing_status_changed", "listing_updated",
  "browse_filter_applied",
  "message_sent"
]);

const productEventSourceSchema = z.enum([
  "listing_detail",
  "listing_card",
  "listing_recommendations",
  "recently_viewed",
  "favorites",
  "category_grid",
  "search_results",
  "account_saved_searches",
  "seller_dashboard",
  "browse_filters",
  "conversation"
]);

const safeCitySchema = z.string().trim().min(1).max(120).optional();
const safeSortSchema = z.enum(["newest", "oldest", "price_asc", "price_desc", "relevance"]).optional();

const listingProductEventBodySchema = z
  .object({
    eventType: listingProductEventTypeSchema,
    listingId: z.string().uuid(),
    source: productEventSourceSchema.optional()
  })
  .strict();

const categoryProductEventBodySchema = z
  .object({
    eventType: z.literal("category_viewed"),
    categoryId: z.string().uuid(),
    source: productEventSourceSchema.optional()
  })
  .strict();

const searchProductEventBodySchema = z
  .object({
    eventType: z.literal("search_performed"),
    queryLength: z.number().int().min(1).max(200),
    resultCount: z.number().int().min(0).max(10_000).optional(),
    source: productEventSourceSchema.optional()
  })
  .strict();

const savedSearchProductEventBodySchema = z
  .object({
    eventType: z.enum(["saved_search_created", "saved_search_deleted"]),
    savedSearchId: z.string().uuid(),
    categoryId: z.string().uuid().optional(),
    city: safeCitySchema,
    sort: safeSortSchema,
    source: productEventSourceSchema.optional()
  })
  .strict();

const favoriteProductEventBodySchema = z
  .object({
    eventType: z.enum(["favorite_added", "favorite_removed"]),
    listingId: z.string().uuid(),
    categoryId: z.string().uuid().optional(),
    source: productEventSourceSchema.optional()
  })
  .strict();

const listingStatusProductEventBodySchema = z
  .object({
    eventType: z.literal("listing_status_changed"),
    listingId: z.string().uuid(),
    status: z.enum(["active", "reserved", "sold", "archived"]),
    source: productEventSourceSchema.optional()
  })
  .strict();

const browseFilterProductEventBodySchema = z
  .object({
    eventType: z.literal("browse_filter_applied"),
    categoryId: z.string().uuid().optional(),
    city: safeCitySchema,
    listingType: z.enum(["sale", "swap", "donation"]).optional(),
    condition: z.enum(["new", "like_new", "good", "fair", "needs_repair"]).optional(),
    sort: safeSortSchema,
    limit: z.number().int().min(1).max(80).optional(),
    offset: z.number().int().min(0).max(10_000).optional(),
    source: productEventSourceSchema.optional()
  })
  .strict();

const messageSentProductEventBodySchema = z
  .object({
    eventType: z.literal("message_sent"),
    conversationId: z.string().uuid(),
    listingId: z.string().uuid().optional(),
    source: productEventSourceSchema.optional()
  })
  .strict();

export const productEventBodySchema = z.discriminatedUnion("eventType", [
  z.object({
    eventType: z.literal("listing_updated"),
    listingId: z.string().uuid(),
    source: productEventSourceSchema.optional()
  }),
  listingProductEventBodySchema,
  categoryProductEventBodySchema,
  searchProductEventBodySchema,
  savedSearchProductEventBodySchema,
  favoriteProductEventBodySchema,
  listingStatusProductEventBodySchema,
  browseFilterProductEventBodySchema,
  messageSentProductEventBodySchema
]);

export type ProductEventBody = z.infer<typeof productEventBodySchema>;
