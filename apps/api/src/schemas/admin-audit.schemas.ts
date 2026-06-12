import { z } from "zod";

export const adminAuditEventsQuerySchema = z.object({
  actorProfileId: z.string().uuid().optional(),
  entityType: z.string().trim().min(1).max(120).optional(),
  eventType: z.string().trim().min(1).max(120).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  sort: z.enum(["newest", "oldest"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

const safeMetadataValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.null()
]);

export const adminAuditEventResponseSchema = z.object({
  id: z.string().uuid(),
  eventType: z.string(),
  entityType: z.string(),
  entityId: z.string().uuid(),
  actorProfileId: z.string().uuid().nullable(),
  createdAt: z.string(),
  metadata: z.record(safeMetadataValueSchema)
}).strict();

export const adminAuditEventsResponseSchema = z.object({
  events: z.array(adminAuditEventResponseSchema)
}).strict();

export type AdminAuditEventsQuery = z.infer<typeof adminAuditEventsQuerySchema>;
