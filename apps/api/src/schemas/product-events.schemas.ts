import { z } from "zod";

export const listingProductEventTypeSchema = z.enum([
  "listing_detail_viewed",
  "listing_card_clicked",
  "contact_seller_intent",
  "recently_viewed_listing_clicked"
]);

export const productEventTypeSchema = z.enum([
  "listing_detail_viewed",
  "listing_card_clicked",
  "contact_seller_intent",
  "recently_viewed_listing_clicked",
  "category_viewed",
  "search_performed"
]);

export const productEventSourceSchema = z.enum([
  "home",
  "browse",
  "category_landing",
  "listing_detail",
  "favorites",
  "recommendation",
  "recently_viewed"
]);

const listingProductEventBodySchema = z
  .object({
    eventType: listingProductEventTypeSchema,
    listingId: z.string().uuid(),
    categoryId: z.string().uuid().optional(),
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
    queryLength: z.number().int().min(2).max(80),
    resultCount: z.number().int().min(0).max(10000).optional(),
    categoryId: z.string().uuid().optional(),
    source: productEventSourceSchema.optional()
  })
  .strict();

export const productEventBodySchema = z.discriminatedUnion("eventType", [
  listingProductEventBodySchema,
  categoryProductEventBodySchema,
  searchProductEventBodySchema
]);

export type ProductEventBody = z.infer<typeof productEventBodySchema>;
export type ProductEventType = z.infer<typeof productEventTypeSchema>;
export type ProductEventSource = z.infer<typeof productEventSourceSchema>;
