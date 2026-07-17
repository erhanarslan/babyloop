import {
  analyticsEventNameValues,
  analyticsPlatformValues,
  analyticsSensitivePropertyKeys,
  getAllowedAnalyticsProperties,
  type AnalyticsEventName,
  type AnalyticsProperty
} from "@babyloop/shared";
import { z } from "zod";

const analyticsPropertySchema = z.union([
  z.string().max(240),
  z.number().finite(),
  z.boolean(),
  z.null()
]);

export const analyticsEventEnvelopeSchema = z
  .object({
    eventId: z.string().trim().min(12).max(120),
    eventName: z.enum(analyticsEventNameValues),
    eventVersion: z.number().int().min(1).max(20),
    occurredAt: z.string().datetime({ offset: true }),
    platform: z.enum(analyticsPlatformValues),
    sessionId: z.string().trim().min(8).max(160),
    anonymousId: z.string().trim().min(8).max(160),
    pagePath: z.string().trim().min(1).max(320).optional(),
    screenName: z.string().trim().min(1).max(120).optional(),
    appVersion: z.string().trim().min(1).max(80).optional(),
    properties: z.record(z.string().min(1).max(80), analyticsPropertySchema).optional()
  })
  .strict()
  .superRefine((event, context) => {
    const properties = event.properties ?? {};
    const allowedProperties = new Set(getAllowedAnalyticsProperties(event.eventName));

    for (const key of Object.keys(properties)) {
      if (analyticsSensitivePropertyKeys.includes(key as (typeof analyticsSensitivePropertyKeys)[number])) {
        context.addIssue({
          code: "custom",
          message: `Analytics property ${key} is sensitive and not allowed.`,
          path: ["properties", key]
        });
      }

      if (!allowedProperties.has(key)) {
        context.addIssue({
          code: "custom",
          message: `Analytics property ${key} is not allowed for ${event.eventName}.`,
          path: ["properties", key]
        });
      }
    }
  });

export const analyticsEventBatchSchema = z
  .object({
    events: z.array(analyticsEventEnvelopeSchema).min(1).max(50)
  })
  .strict();

export type AnalyticsEventEnvelopeInput = z.infer<typeof analyticsEventEnvelopeSchema>;
export type AnalyticsEventBatchInput = z.infer<typeof analyticsEventBatchSchema>;

export type AnalyticsBatchIngestResponse = {
  accepted: number;
  duplicated: number;
  rejected: Array<{
    eventId?: string;
    eventName?: AnalyticsEventName;
    reason: string;
  }>;
};

export function isAnalyticsPropertyRecord(value: unknown): value is Record<string, AnalyticsProperty> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
