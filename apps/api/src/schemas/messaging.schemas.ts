import { z } from "zod";

export const createConversationBodySchema = z
  .object({
    listing_id: z.string().uuid()
  })
  .strict();

export const conversationParamsSchema = z.object({
  id: z.string().uuid()
});

export const sendMessageBodySchema = z
  .object({
    body: z.string().trim().min(1).max(5000)
  })
  .strict();

export type CreateConversationBody = z.infer<typeof createConversationBodySchema>;
export type SendMessageBody = z.infer<typeof sendMessageBodySchema>;
