import { z } from "zod";

export const childAgeBandSchema = z.enum([
  "expecting",
  "newborn_0_3",
  "infant_3_6",
  "infant_6_12",
  "toddler_12_24",
  "preschool_24_36",
  "child_3_plus"
]);

export const childProfileGenderSchema = z.enum([
  "female",
  "male",
  "prefer_not_to_say"
]);

export const childProfileNotificationCadenceSchema = z.enum([
  "off",
  "weekly",
  "monthly",
  "yearly"
]);

const nullableOptionalIntSchema = (min: number, max: number) =>
  z.preprocess(
    (value) => (value === "" ? null : value),
    z.coerce.number().int().min(min).max(max).nullable().optional()
  );

const childProfileOptionalDetailsSchema = {
  ageMonths: nullableOptionalIntSchema(0, 96),
  birthMonth: nullableOptionalIntSchema(1, 12),
  birthYear: nullableOptionalIntSchema(2016, 2035),
  gender: childProfileGenderSchema.nullable().optional(),
  notificationCadence: childProfileNotificationCadenceSchema.optional().default("off")
};

export const childProfileParamsSchema = z
  .object({
    childProfileId: z.string().uuid()
  })
  .strict();

export const createChildProfileBodySchema = z
  .object({
    label: z.string().trim().min(1).max(80).optional().default("Çocuğum"),
    ageBand: childAgeBandSchema,
    ...childProfileOptionalDetailsSchema,
    isActive: z.boolean().optional().default(true)
  })
  .strict()
  .refine(hasCompleteBirthMonthYear, {
    message: "Birth month and birth year must be provided together."
  });

export const updateChildProfileBodySchema = z
  .object({
    label: z.string().trim().min(1).max(80).optional(),
    ageBand: childAgeBandSchema.optional(),
    ageMonths: nullableOptionalIntSchema(0, 96),
    birthMonth: nullableOptionalIntSchema(1, 12),
    birthYear: nullableOptionalIntSchema(2016, 2035),
    gender: childProfileGenderSchema.nullable().optional(),
    notificationCadence: childProfileNotificationCadenceSchema.optional(),
    isActive: z.boolean().optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one child profile field must be provided."
  })
  .refine(hasCompleteBirthMonthYear, {
    message: "Birth month and birth year must be provided together."
  });

export type ChildAgeBand = z.infer<typeof childAgeBandSchema>;
export type ChildProfileGender = z.infer<typeof childProfileGenderSchema>;
export type ChildProfileNotificationCadence = z.infer<typeof childProfileNotificationCadenceSchema>;
export type ChildProfileParams = z.infer<typeof childProfileParamsSchema>;
export type CreateChildProfileBody = z.infer<typeof createChildProfileBodySchema>;
export type UpdateChildProfileBody = z.infer<typeof updateChildProfileBodySchema>;

function hasCompleteBirthMonthYear(value: {
  birthMonth?: number | null | undefined;
  birthYear?: number | null | undefined;
}): boolean {
  const hasBirthMonth = value.birthMonth !== undefined && value.birthMonth !== null;
  const hasBirthYear = value.birthYear !== undefined && value.birthYear !== null;

  return hasBirthMonth === hasBirthYear;
}
