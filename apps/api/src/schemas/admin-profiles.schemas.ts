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

export const adminProfilesResponseSchema = z.object({
  profiles: z.array(adminProfileSummarySchema)
}).strict();

export type AdminProfileParams = z.infer<typeof adminProfileParamsSchema>;
export type AdminProfilesQuery = z.infer<typeof adminProfilesQuerySchema>;
export type AdminProfileSummaryResponse = z.infer<typeof adminProfileSummarySchema>;
export type AdminProfilesResponse = z.infer<typeof adminProfilesResponseSchema>;
export type AdminProfileSafetyStatusValue = (typeof adminProfileSafetyStatusValues)[number];
export type AdminProfileRiskLevelValue = (typeof adminProfileRiskLevelValues)[number];
