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
  "search_performed"
]);

const productEventSourceSchema = z.enum([
  "listing_detail",
  "listing_card",
  "listing_recommendations",
  "recently_viewed",
  "favorites",
  "category_grid",
  "search_results"
]);

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

export const productEventBodySchema = z.discriminatedUnion("eventType", [
  listingProductEventBodySchema,
  categoryProductEventBodySchema,
  searchProductEventBodySchema
]);

export type ProductEventBody = z.infer<typeof productEventBodySchema>;
