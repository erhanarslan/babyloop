import { z } from "zod";
import { validatePlainText } from "../services/text-safety.service.js";

export const createConversationBodySchema = z
  .object({
    listingId: z.string().uuid()
  })
  .strict();

export const conversationParamsSchema = z.object({
  id: z.string().uuid()
});

export const sendMessageBodySchema = z
  .object({
    body: z
      .string()
      .transform((value, context) => {
        const result = validatePlainText(value, {
          allowMultiline: true,
          maxLength: 5000,
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
  })
  .strict();

export type CreateConversationBody = z.infer<typeof createConversationBodySchema>;
export type SendMessageBody = z.infer<typeof sendMessageBodySchema>;
