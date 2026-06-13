import { z } from "zod";

const DECIMAL_PRICE_PATTERN = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export const aiPriceSuggestionBodySchema = z
  .object({
    title: optionalTrimmedString(160),
    categoryName: optionalTrimmedString(120),
    condition: z.enum(["new", "like_new", "good", "fair", "needs_repair"]).optional(),
    listingType: z.enum(["sale", "swap", "donation"]).optional(),
    currentPriceAmount: z
      .union([z.literal(""), z.string().trim().regex(DECIMAL_PRICE_PATTERN)])
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined)),
    currency: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .refine((value) => CURRENCY_PATTERN.test(value), "Currency must be a 3-letter code.")
      .optional()
      .default("TRY")
  })
  .strict()
  .refine(
    (value) =>
      Boolean(
        value.title ??
          value.categoryName ??
          value.condition ??
          value.listingType ??
          value.currentPriceAmount
      ),
    "At least one pricing signal is required."
  );

export type AiPriceSuggestionBody = z.infer<typeof aiPriceSuggestionBodySchema>;

function optionalTrimmedString(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));
}
