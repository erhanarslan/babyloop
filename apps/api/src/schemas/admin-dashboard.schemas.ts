import { z } from "zod";

export const adminDashboardSummaryResponseSchema = z.object({
  listings: z.object({
    totalListings: z.number().int().nonnegative(),
    activeListings: z.number().int().nonnegative(),
    archivedListings: z.number().int().nonnegative(),
    soldListings: z.number().int().nonnegative(),
    reservedListings: z.number().int().nonnegative(),
    draftListings: z.number().int().nonnegative(),
    listingsCreatedLast7Days: z.number().int().nonnegative(),
    listingsUpdatedLast7Days: z.number().int().nonnegative(),
    listingsWithRejectedImages: z.number().int().nonnegative()
  }).strict(),
  images: z.object({
    totalListingImages: z.number().int().nonnegative(),
    approvedListingImages: z.number().int().nonnegative(),
    rejectedListingImages: z.number().int().nonnegative(),
    imagesReviewedLast7Days: z.number().int().nonnegative()
  }).strict(),
  moderation: z.object({
    totalModerationCases: z.number().int().nonnegative(),
    openModerationCases: z.number().int().nonnegative(),
    closedModerationCases: z.number().int().nonnegative(),
    casesCreatedLast7Days: z.number().int().nonnegative(),
    sensitiveAccessGrantedLast7Days: z.number().int().nonnegative(),
    sensitiveAccessDeniedLast7Days: z.number().int().nonnegative()
  }).strict(),
  actions: z.object({
    listingActionsLast7Days: z.number().int().nonnegative(),
    imageReviewActionsLast7Days: z.number().int().nonnegative()
  }).strict()
}).strict();

export type AdminDashboardSummaryResponse = z.infer<
  typeof adminDashboardSummaryResponseSchema
>;
