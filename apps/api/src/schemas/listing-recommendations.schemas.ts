import { z } from "zod";

export const listingRecommendationsParamsSchema = z
  .object({
    listingId: z.string().uuid()
  })
  .strict();

export const listingRecommendationsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(12).optional().default(8)
  })
  .strict();

export type ListingRecommendationsParams = z.infer<typeof listingRecommendationsParamsSchema>;
export type ListingRecommendationsQuery = z.infer<typeof listingRecommendationsQuerySchema>;
