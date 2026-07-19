import { z } from "zod";
import {
  listingConditionValues,
  listingSortValues,
  listingTypeValues
} from "./listings.schemas.js";

const DECIMAL_PRICE_PATTERN = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;

const optionalTrimmedText = z
  .string()
  .trim()
  .max(120)
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

const optionalPrice = z
  .union([z.literal(""), z.string().trim().regex(DECIMAL_PRICE_PATTERN)])
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

export const savedSearchParamsSchema = z
  .object({
    savedSearchId: z.string().uuid()
  })
  .strict();

export const createSavedSearchBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    q: optionalTrimmedText,
    city: optionalTrimmedText,
    categoryId: z.string().uuid().optional(),
    listingType: z.enum(listingTypeValues).optional(),
    condition: z.enum(listingConditionValues).optional(),
    priceMin: optionalPrice,
    priceMax: optionalPrice,
    hasImages: z.boolean().optional().default(false),
    sort: z.enum(listingSortValues).optional().default("newest"),
    notificationsEnabled: z.boolean().optional().default(false)
  })
  .strict();

export const updateSavedSearchNotificationsBodySchema = z
  .object({
    notificationsEnabled: z.boolean()
  })
  .strict();

export type CreateSavedSearchBody = z.infer<typeof createSavedSearchBodySchema>;
export type UpdateSavedSearchNotificationsBody = z.infer<typeof updateSavedSearchNotificationsBodySchema>;
export type SavedSearchParams = z.infer<typeof savedSearchParamsSchema>;
