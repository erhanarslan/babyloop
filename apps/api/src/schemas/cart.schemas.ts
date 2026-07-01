import { z } from "zod";

export const addCartItemBodySchema = z
  .object({
    listingId: z.string().uuid()
  })
  .strict();

export const mockIyzicoCheckoutBodySchema = z
  .object({
    scenario: z.enum(["success", "failure"]).optional().default("success")
  })
  .strict();

export type AddCartItemBody = z.infer<typeof addCartItemBodySchema>;
export type MockIyzicoCheckoutBody = z.infer<typeof mockIyzicoCheckoutBodySchema>;
