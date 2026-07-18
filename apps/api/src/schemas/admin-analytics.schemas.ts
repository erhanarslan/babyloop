import { z } from "zod";

export const adminAnalyticsQuerySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional(),
    platform: z.enum(["web", "mobile"]).optional()
  })
  .strict()
  .superRefine((query, context) => {
    if (!query.from || !query.to) {
      return;
    }

    const from = new Date(`${query.from}T00:00:00.000Z`);
    const to = new Date(`${query.to}T00:00:00.000Z`);

    if (from > to) {
      context.addIssue({
        code: "custom",
        message: "from must be before to.",
        path: ["from"]
      });
      return;
    }

    if (to.getTime() - from.getTime() > 370 * 24 * 60 * 60 * 1000) {
      context.addIssue({
        code: "custom",
        message: "Analytics date range cannot exceed 370 days.",
        path: ["to"]
      });
    }
  });

export type AdminAnalyticsQueryInput = z.infer<typeof adminAnalyticsQuerySchema>;
