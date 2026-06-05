import { z } from "zod";

const DECIMAL_PRICE_PATTERN = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
export const listingStatusValues = ["active", "reserved", "sold", "archived"] as const;

export const listingParamsSchema = z.object({
  id: z.string().uuid()
});

export const listingsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  search: z.string().trim().max(120).optional()
});

export const createListingBodySchema = z
  .object({
    categoryId: z.string().uuid(),
    title: z.string().trim().min(4).max(160),
    description: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null)),
    priceAmount: z
      .union([z.literal(""), z.string().trim().regex(DECIMAL_PRICE_PATTERN)])
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null)),
    currency: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .refine((value) => CURRENCY_PATTERN.test(value), "Currency must be a 3-letter code.")
      .optional()
      .default("TRY"),
    listingType: z.enum(["sale", "swap", "donation"]),
    condition: z.enum(["new", "like_new", "good", "fair", "needs_repair"]),
    imageUrls: z.array(z.string().trim().url().max(1000)).max(5).optional().default([])
  })
  .strict();

export const updateListingBodySchema = z
  .object({
    categoryId: z.string().uuid().optional(),
    title: z.string().trim().min(4).max(160).optional(),
    description: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .transform((value) => (value && value.length > 0 ? value : value === "" ? null : undefined)),
    priceAmount: z
      .union([z.literal(""), z.string().trim().regex(DECIMAL_PRICE_PATTERN)])
      .optional()
      .transform((value) => (value && value.length > 0 ? value : value === "" ? null : undefined)),
    currency: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .refine((value) => CURRENCY_PATTERN.test(value), "Currency must be a 3-letter code.")
      .optional(),
    listingType: z.enum(["sale", "swap", "donation"]).optional(),
    condition: z.enum(["new", "like_new", "good", "fair", "needs_repair"]).optional(),
    imageUrls: z.array(z.string().trim().url().max(1000)).max(5).optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one listing field must be provided."
  });

export const updateListingStatusBodySchema = z
  .object({
    status: z.enum(listingStatusValues)
  })
  .strict();

export type CreateListingBody = z.infer<typeof createListingBodySchema>;
export type ListingStatusValue = (typeof listingStatusValues)[number];
export type ListingsQuery = z.infer<typeof listingsQuerySchema>;
export type UpdateListingBody = z.infer<typeof updateListingBodySchema>;
export type UpdateListingStatusBody = z.infer<typeof updateListingStatusBodySchema>;
