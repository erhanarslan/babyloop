import { z } from "zod";

export const productEventTypeSchema = z.enum([
  "listing_detail_viewed",
  "listing_card_clicked",
  "contact_seller_intent"
]);

export const productEventSourceSchema = z.enum([
  "home",
  "browse",
  "listing_detail",
  "favorites",
  "recommendation"
]);

export const productEventBodySchema = z
  .object({
    eventType: productEventTypeSchema,
    listingId: z.string().uuid(),
    categoryId: z.string().uuid().optional(),
    source: productEventSourceSchema.optional()
  })
  .strict();

export type ProductEventBody = z.infer<typeof productEventBodySchema>;
export type ProductEventType = z.infer<typeof productEventTypeSchema>;
export type ProductEventSource = z.infer<typeof productEventSourceSchema>;
