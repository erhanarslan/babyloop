import { z } from "zod";

export const adminListingStatusValues = [
  "draft",
  "active",
  "reserved",
  "sold",
  "archived"
] as const;

export const adminListingImageReviewStatusValues = [
  "pending",
  "approved",
  "needs_review",
  "rejected"
] as const;

export const adminListingPublicationStateValues = [
  "awaiting_images",
  "ai_review",
  "admin_review",
  "scheduled",
  "published",
  "changes_requested"
] as const;

export const adminListingParamsSchema = z.object({
  listingId: z.string().uuid()
});

export const adminListingsQuerySchema = z.object({
  status: z.enum(adminListingStatusValues).optional(),
  imageReviewStatus: z.enum(adminListingImageReviewStatusValues).optional(),
  publicationState: z.enum(adminListingPublicationStateValues).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  categoryId: z.string().uuid().optional(),
  sort: z
    .enum(["newest", "oldest", "updated_desc", "updated_asc"])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

export const adminListingActionBodySchema = z.object({
  action: z.enum(["archive", "restore", "publish", "request_changes"]),
  reason: z.string().trim().min(10).max(1000)
});

export const adminListingPublicationSettingsBodySchema = z.object({
  adminReviewEnabled: z.boolean(),
  autoPublishDelaySeconds: z.number().int().min(5).max(86400)
});

export const adminListingImageParamsSchema = adminListingParamsSchema.extend({
  imageId: z.string().uuid()
});

export const adminListingImageActionBodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().trim().min(10).max(1000)
});

export type AdminListingActionBody = z.infer<typeof adminListingActionBodySchema>;
export type AdminListingActionValue = AdminListingActionBody["action"];
export type AdminListingImageActionBody = z.infer<typeof adminListingImageActionBodySchema>;
export type AdminListingImageActionValue = AdminListingImageActionBody["action"];
export type AdminListingImageParams = z.infer<typeof adminListingImageParamsSchema>;
export type AdminListingParams = z.infer<typeof adminListingParamsSchema>;
export type AdminListingStatusValue = (typeof adminListingStatusValues)[number];
export type AdminListingImageReviewStatusValue = (typeof adminListingImageReviewStatusValues)[number];
export type AdminListingPublicationStateValue = (typeof adminListingPublicationStateValues)[number];
export type AdminListingPublicationSettingsBody = z.infer<
  typeof adminListingPublicationSettingsBodySchema
>;
export type AdminListingsQuery = z.infer<typeof adminListingsQuerySchema>;
