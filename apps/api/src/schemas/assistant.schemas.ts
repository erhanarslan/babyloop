import { z } from "zod";

export const assistantModeSchema = z.enum([
  "find_products",
  "sell_help",
  "age_needs",
  "safe_buying",
  "platform_help"
]);

export const assistantChatBodySchema = z
  .object({
    mode: assistantModeSchema,
    content: z.string().trim().min(1).max(1000)
  })
  .strict();

export type AssistantMode = z.infer<typeof assistantModeSchema>;
export type AssistantChatBody = z.infer<typeof assistantChatBodySchema>;
