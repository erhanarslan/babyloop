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

export const childProfileParamsSchema = z
  .object({
    childProfileId: z.string().uuid()
  })
  .strict();

export const createChildProfileBodySchema = z
  .object({
    label: z.string().trim().min(1).max(80).optional().default("Child profile"),
    ageBand: childAgeBandSchema,
    isActive: z.boolean().optional().default(true)
  })
  .strict();

export const updateChildProfileBodySchema = z
  .object({
    label: z.string().trim().min(1).max(80).optional(),
    ageBand: childAgeBandSchema.optional(),
    isActive: z.boolean().optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one child profile field must be provided."
  });

export type ChildAgeBand = z.infer<typeof childAgeBandSchema>;
export type ChildProfileParams = z.infer<typeof childProfileParamsSchema>;
export type CreateChildProfileBody = z.infer<typeof createChildProfileBodySchema>;
export type UpdateChildProfileBody = z.infer<typeof updateChildProfileBodySchema>;
