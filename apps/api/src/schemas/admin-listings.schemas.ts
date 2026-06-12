import { z } from "zod";

export const adminListingStatusValues = [
  "draft",
  "active",
  "reserved",
  "sold",
  "archived"
] as const;

export const adminListingParamsSchema = z.object({
  listingId: z.string().uuid()
});

export const adminListingsQuerySchema = z.object({
  status: z.enum(adminListingStatusValues).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  categoryId: z.string().uuid().optional(),
  sort: z
    .enum(["newest", "oldest", "updated_desc", "updated_asc"])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

export const adminListingActionBodySchema = z.object({
  action: z.enum(["archive", "restore"]),
  reason: z.string().trim().min(10).max(1000)
});

export type AdminListingActionBody = z.infer<typeof adminListingActionBodySchema>;
export type AdminListingActionValue = AdminListingActionBody["action"];
export type AdminListingParams = z.infer<typeof adminListingParamsSchema>;
export type AdminListingStatusValue = (typeof adminListingStatusValues)[number];
export type AdminListingsQuery = z.infer<typeof adminListingsQuerySchema>;
