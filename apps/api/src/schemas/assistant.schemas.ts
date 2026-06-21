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

export const assistantMessageBodySchema = z
  .object({
    message: z.string().trim().min(1).max(1000),
    locale: z.enum(["tr", "en"]).optional().default("tr")
  })
  .strict();

export const assistantMessageSourceSchema = z
  .object({
    title: z.string(),
    sourcePath: z.string(),
    section: z.string().optional(),
    topic: z.string().optional()
  })
  .strict();

export const assistantMessageResponseDataSchema = z
  .object({
    answer: z.string(),
    actions: z
      .array(
        z
          .object({
            label: z.string(),
            href: z.string()
          })
          .strict()
      )
      .optional(),
    sources: z.array(assistantMessageSourceSchema).optional(),
    mode: z.enum(["rag", "boundary", "no_sources"]).optional(),
    grounded: z.boolean().optional(),
    intent: z
      .enum([
        "unsafe_medical",
        "prompt_injection",
        "rag_knowledge",
        "listing_search",
        "listing_help",
        "babyloop_usage",
        "child_needs",
        "unknown"
      ])
      .optional()
  })
  .strict();

export type AssistantMode = z.infer<typeof assistantModeSchema>;
export type AssistantChatBody = z.infer<typeof assistantChatBodySchema>;
export type AssistantMessageBody = z.infer<typeof assistantMessageBodySchema>;
export type AssistantMessageResponseData = z.infer<typeof assistantMessageResponseDataSchema>;
