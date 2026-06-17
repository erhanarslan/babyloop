import { z } from "zod";
import {
  listingConditionValues,
  listingTypeValues
} from "./listings.schemas.js";

const DECIMAL_PRICE_PATTERN = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;

const optionalTrimmedText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));

export const aiListingDraftFieldsSchema = z
  .object({
    categoryId: z
      .string()
      .trim()
      .uuid()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    listingType: z.enum(listingTypeValues).optional(),
    title: optionalTrimmedText(160),
    description: optionalTrimmedText(2000),
    condition: z.enum(listingConditionValues).optional(),
    priceAmount: z
      .string()
      .trim()
      .regex(DECIMAL_PRICE_PATTERN)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    currency: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .pipe(z.literal("TRY"))
      .optional()
      .default("TRY"),
    city: optionalTrimmedText(120),
    locale: z.literal("tr").optional().default("tr")
  })
  .strict();

export type AiListingDraftFields = z.infer<typeof aiListingDraftFieldsSchema>;
