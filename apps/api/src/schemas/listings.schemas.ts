import { z } from "zod";
import { validatePlainText } from "../services/text-safety.service.js";

const DECIMAL_PRICE_PATTERN = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
export const listingStatusValues = ["active", "reserved", "sold", "archived"] as const;
export const listingTypeValues = ["sale", "swap", "donation"] as const;
export const listingConditionValues = ["new", "like_new", "good", "fair", "needs_repair"] as const;
export const listingSortValues = ["newest", "oldest", "price_asc", "price_desc"] as const;


export const listingParamsSchema = z.object({
  id: z.string().uuid()
});

export const listingImageParamsSchema = z.object({
  id: z.string().uuid(),
  imageId: z.string().uuid()
});

export const listingUploadParamsSchema = z.object({
  filename: z.string().regex(/^[a-f0-9-]+\.(jpg|png|webp)$/i),
  listingId: z.string().uuid()
});

export const reorderListingImagesBodySchema = z
  .object({
    imageIds: z.array(z.string().uuid()).max(5)
  })
  .strict();

const optionalTrimmedQueryParam = z
  .string()
  .trim()
  .max(120)
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

const optionalUuidQueryParam = z
  .union([z.literal(""), z.string().uuid()])
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const optionalPriceQueryParam = z
  .union([z.literal(""), z.string().trim().regex(DECIMAL_PRICE_PATTERN)])
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const optionalBooleanQueryParam = z
  .union([z.literal(""), z.literal("true"), z.literal("false")])
  .optional()
  .transform((value) => (value === "true" ? true : value === "false" ? false : undefined));

function optionalEnumQueryParam<const Values extends readonly [string, ...string[]]>(values: Values) {
  return z
    .union([z.literal(""), z.enum(values)])
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));
}

export const listingsQuerySchema = z
  .object({
    q: optionalTrimmedQueryParam,
    search: optionalTrimmedQueryParam,
    categoryId: optionalUuidQueryParam,
    listingType: optionalEnumQueryParam(listingTypeValues),
    condition: optionalEnumQueryParam(listingConditionValues),
    priceMin: optionalPriceQueryParam,
    priceMax: optionalPriceQueryParam,
    hasImages: optionalBooleanQueryParam,
    sort: z.enum(listingSortValues).optional().default("newest"),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
    offset: z.coerce.number().int().min(0).max(10000).optional().default(0)
  })
  .strict();

export const createListingBodySchema = z
  .object({
    categoryId: z.string().uuid(),
    title: plainTextField({ maxLength: 160, minLength: 4 }),
    description: optionalPlainTextField({ allowMultiline: true, maxLength: 2000 }),
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
    condition: z.enum(["new", "like_new", "good", "fair", "needs_repair"])
  })
  .strict();

export const updateListingBodySchema = z
  .object({
    categoryId: z.string().uuid().optional(),
    title: plainTextField({ maxLength: 160, minLength: 4 }).optional(),
    description: optionalPlainTextField({ allowMultiline: true, maxLength: 2000 }, "undefined"),
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
    condition: z.enum(["new", "like_new", "good", "fair", "needs_repair"]).optional()
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
export type ListingImageParams = z.infer<typeof listingImageParamsSchema>;
export type ListingStatusValue = (typeof listingStatusValues)[number];
export type ListingsQuery = z.infer<typeof listingsQuerySchema>;
export type ReorderListingImagesBody = z.infer<typeof reorderListingImagesBodySchema>;
export type UpdateListingBody = z.infer<typeof updateListingBodySchema>;
export type UpdateListingStatusBody = z.infer<typeof updateListingStatusBodySchema>;

function plainTextField(options: {
  allowMultiline?: boolean;
  maxLength: number;
  minLength: number;
}) {
  return z.string().transform((value, context) => {
    const result = validatePlainText(value, options);

    if (!result.ok) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.message
      });
      return z.NEVER;
    }

    return result.value;
  });
}

function optionalPlainTextField(
  options: {
    allowMultiline?: boolean;
    maxLength: number;
  },
  emptyValue: "null" | "undefined" = "null"
) {
  return z
    .string()
    .transform((value, context) => {
      if (value.trim().length === 0) {
        return emptyValue === "null" ? null : undefined;
      }

      const result = validatePlainText(value, {
        ...options,
        minLength: 1
      });

      if (!result.ok) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: result.message
        });
        return z.NEVER;
      }

      return result.value;
    })
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return emptyValue === "null" ? null : undefined;
      }

      return value;
    });
}

