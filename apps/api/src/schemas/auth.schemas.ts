import { z } from "zod";

export const registerBodySchema = z
  .object({
    email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
    password: z.string().min(8).max(128),
    displayName: z.string().trim().min(2).max(120),
    locationCity: z
      .string()
      .trim()
      .max(120)
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null))
  })
  .strict();

export const loginBodySchema = z
  .object({
    email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
    password: z.string().min(1).max(128)
  })
  .strict();

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;

