import { z } from "zod";

const nonNegativeIntegerSchema = z.number().int().nonnegative();

export const adminDashboardSummaryResponseSchema = z.object({
  listings: z.object({
    totalListings: nonNegativeIntegerSchema,
    activeListings: nonNegativeIntegerSchema,
    archivedListings: nonNegativeIntegerSchema,
    soldListings: nonNegativeIntegerSchema,
    reservedListings: nonNegativeIntegerSchema,
    draftListings: nonNegativeIntegerSchema,
    listingsCreatedLast7Days: nonNegativeIntegerSchema,
    listingsUpdatedLast7Days: nonNegativeIntegerSchema,
    listingsWithRejectedImages: nonNegativeIntegerSchema
  }).strict(),
  images: z.object({
    totalListingImages: nonNegativeIntegerSchema,
    approvedListingImages: nonNegativeIntegerSchema,
    rejectedListingImages: nonNegativeIntegerSchema,
    imagesReviewedLast7Days: nonNegativeIntegerSchema
  }).strict(),
  moderation: z.object({
    totalModerationCases: nonNegativeIntegerSchema,
    openModerationCases: nonNegativeIntegerSchema,
    closedModerationCases: nonNegativeIntegerSchema,
    openHighPriorityCases: nonNegativeIntegerSchema,
    openNormalPriorityCases: nonNegativeIntegerSchema,
    openLowPriorityCases: nonNegativeIntegerSchema,
    casesCreatedLast7Days: nonNegativeIntegerSchema,
    pendingReports: nonNegativeIntegerSchema,
    reportsCreatedLast7Days: nonNegativeIntegerSchema,
    sensitiveAccessGrantedLast7Days: nonNegativeIntegerSchema,
    sensitiveAccessDeniedLast7Days: nonNegativeIntegerSchema
  }).strict(),
  actions: z.object({
    auditEventsLast7Days: nonNegativeIntegerSchema,
    profileEnforcementActionsLast7Days: nonNegativeIntegerSchema,
    listingActionsLast7Days: nonNegativeIntegerSchema,
    imageReviewActionsLast7Days: nonNegativeIntegerSchema,
    messageEnforcementActionsLast7Days: nonNegativeIntegerSchema
  }).strict(),
  profiles: z.object({
    restrictedProfiles: nonNegativeIntegerSchema,
    suspendedProfiles: nonNegativeIntegerSchema,
    highRiskProfiles: nonNegativeIntegerSchema,
    criticalRiskProfiles: nonNegativeIntegerSchema,
    profilesNeedingReview: nonNegativeIntegerSchema
  }).strict(),
  conversations: z.object({
    totalConversations: nonNegativeIntegerSchema,
    conversationsCreatedLast7Days: nonNegativeIntegerSchema,
    messagesCreatedLast7Days: nonNegativeIntegerSchema,
    reportedMessageCount: nonNegativeIntegerSchema,
    openMessageCases: nonNegativeIntegerSchema
  }).strict(),
  ai: z.object({
    moderationSummaryRunsLast7Days: nonNegativeIntegerSchema,
    moderationSummaryFailuresLast7Days: nonNegativeIntegerSchema,
    providerFailuresLast7Days: nonNegativeIntegerSchema,
    validationFailuresLast7Days: nonNegativeIntegerSchema
  }).strict()
}).strict();

export type AdminDashboardSummaryResponse = z.infer<
  typeof adminDashboardSummaryResponseSchema
>;
