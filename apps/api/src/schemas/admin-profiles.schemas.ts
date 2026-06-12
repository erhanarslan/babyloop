import { z } from "zod";

export const adminProfileSafetyStatusValues = ["active", "restricted", "suspended"] as const;
export const adminProfileRiskLevelValues = ["low", "medium", "high", "critical"] as const;

export const adminProfileParamsSchema = z.object({
  profileId: z.string().uuid()
});

export const adminProfilesQuerySchema = z.object({
  safetyStatus: z.enum(adminProfileSafetyStatusValues).optional(),
  riskLevel: z.enum(adminProfileRiskLevelValues).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  sort: z
    .enum(["risk_desc", "risk_asc", "trust_desc", "trust_asc", "newest", "oldest"])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

const adminProfileTrustSnapshotSchema = z.object({
  profileId: z.string().uuid(),
  trustScore: z.number().int().min(0).max(100),
  riskScore: z.number().int().min(0).max(100),
  riskLevel: z.enum(adminProfileRiskLevelValues),
  safetyStatus: z.enum(adminProfileSafetyStatusValues),
  openCaseCount: z.number().int().nonnegative(),
  totalCaseCount: z.number().int().nonnegative(),
  recentReportCount: z.number().int().nonnegative(),
  recentEnforcementCount: z.number().int().nonnegative(),
  sensitiveAccessCount: z.number().int().nonnegative(),
  aiSummaryCount: z.number().int().nonnegative(),
  lastReportAt: z.string().datetime().nullable(),
  lastEnforcementAt: z.string().datetime().nullable(),
  computedAt: z.string().datetime()
}).strict();

export const adminProfileSummarySchema = z.object({
  profileId: z.string().uuid(),
  displayName: z.string().min(1),
  locationCity: z.string().nullable(),
  safetyStatus: z.enum(adminProfileSafetyStatusValues),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  listingCount: z.number().int().nonnegative(),
  trustSnapshot: adminProfileTrustSnapshotSchema.nullable()
}).strict();

const adminProfileListingSummarySchema = z.object({
  listingId: z.string().uuid(),
  title: z.string().min(1),
  status: z.string().min(1),
  listingType: z.string().min(1),
  condition: z.string().min(1),
  price: z.object({
    amount: z.string(),
    currency: z.string().length(3)
  }).nullable(),
  category: z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    slug: z.string().min(1)
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

const adminProfileModerationCaseSummarySchema = z.object({
  caseId: z.string().uuid(),
  reportId: z.string().uuid().nullable(),
  targetType: z.enum(["listing", "profile", "message"]),
  targetId: z.string().uuid(),
  status: z.enum(["pending", "in_review", "resolved", "dismissed"]),
  priority: z.enum(["low", "normal", "high"]),
  reason: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

const adminProfileEnforcementSummarySchema = z.object({
  actionId: z.string().uuid(),
  caseId: z.string().uuid().nullable(),
  actionType: z.string().min(1),
  createdAt: z.string().datetime()
}).strict();

const adminProfileDetailStatsSchema = z.object({
  totalListings: z.number().int().nonnegative(),
  activeListings: z.number().int().nonnegative(),
  archivedListings: z.number().int().nonnegative(),
  soldListings: z.number().int().nonnegative(),
  reservedListings: z.number().int().nonnegative(),
  draftListings: z.number().int().nonnegative(),
  totalCases: z.number().int().nonnegative(),
  openCases: z.number().int().nonnegative(),
  enforcementActions: z.number().int().nonnegative()
}).strict();

export const adminProfileDetailSchema = adminProfileSummarySchema.extend({
  stats: adminProfileDetailStatsSchema,
  listings: z.array(adminProfileListingSummarySchema),
  relatedModerationCases: z.array(adminProfileModerationCaseSummarySchema),
  enforcementHistory: z.array(adminProfileEnforcementSummarySchema)
}).strict();

export const adminProfilesResponseSchema = z.object({
  profiles: z.array(adminProfileSummarySchema)
}).strict();

export const adminProfileDetailResponseSchema = z.object({
  profile: adminProfileDetailSchema
}).strict();

export type AdminProfileParams = z.infer<typeof adminProfileParamsSchema>;
export type AdminProfilesQuery = z.infer<typeof adminProfilesQuerySchema>;
export type AdminProfileSummaryResponse = z.infer<typeof adminProfileSummarySchema>;
export type AdminProfileDetailResponse = z.infer<typeof adminProfileDetailSchema>;
export type AdminProfilesResponse = z.infer<typeof adminProfilesResponseSchema>;
export type AdminProfileSafetyStatusValue = (typeof adminProfileSafetyStatusValues)[number];
export type AdminProfileRiskLevelValue = (typeof adminProfileRiskLevelValues)[number];
