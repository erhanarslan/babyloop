import { events } from "@babyloop/database/schema";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { AdminAuditEventsQuery } from "../schemas/admin-audit.schemas.js";

export type AdminAuditEventSummary = {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actorProfileId: string | null;
  createdAt: string;
  metadata: Record<string, string | number | boolean | string[] | null>;
};

const SAFE_AUDIT_METADATA_KEYS = [
  "action",
  "riskLevel",
  "recommendedAction",
  "promptVersion",
  "providerName",
  "confidenceScore",
  "aiModelRunId",
  "caseId",
  "denialReason",
  "deniedFields",
  "enforcementAction",
  "grantedFields",
  "imageId",
  "listingId",
  "moderationActionId",
  "nextReviewStatus",
  "nextSafetyStatus",
  "nextStatus",
  "previousReviewStatus",
  "previousSafetyStatus",
  "previousStatus",
  "profileId",
  "reasonLength",
  "requestedFields",
  "result",
  "resultingStatus",
  "targetId",
  "targetType"
] as const;

export async function listAdminAuditEvents(
  app: FastifyInstance,
  query: AdminAuditEventsQuery
): Promise<AdminAuditEventSummary[]> {
  const whereClauses: SQL[] = [];
  const normalizedQuery = query.q?.trim() ?? "";

  if (query.eventType) {
    whereClauses.push(eq(events.eventType, query.eventType));
  }

  if (query.entityType) {
    whereClauses.push(eq(events.entityType, query.entityType));
  }

  if (query.actorProfileId) {
    whereClauses.push(eq(events.actorProfileId, query.actorProfileId));
  }

  if (normalizedQuery) {
    const pattern = `%${normalizedQuery}%`;

    whereClauses.push(
      or(
        sql`${events.id}::text ilike ${pattern}`,
        ilike(events.eventType, pattern),
        ilike(events.entityType, pattern),
        sql`${events.entityId}::text ilike ${pattern}`,
        sql`${events.actorProfileId}::text ilike ${pattern}`
      )!
    );
  }

  const rows = await app.db
    .select({
      id: events.id,
      eventType: events.eventType,
      entityType: events.entityType,
      entityId: events.entityId,
      actorProfileId: events.actorProfileId,
      metadata: events.metadata,
      createdAt: events.createdAt
    })
    .from(events)
    .where(whereClauses.length > 0 ? and(...whereClauses) : undefined)
    .orderBy(query.sort === "oldest" ? asc(events.createdAt) : desc(events.createdAt))
    .limit(query.limit ?? 50);

  return rows.map((row) => ({
    id: row.id,
    eventType: row.eventType,
    entityType: row.entityType,
    entityId: row.entityId,
    actorProfileId: row.actorProfileId,
    createdAt: row.createdAt.toISOString(),
    metadata: sanitizeAuditMetadata(row.metadata)
  }));
}

export function sanitizeAuditMetadata(
  metadata: Record<string, unknown>
): Record<string, string | number | boolean | string[] | null> {
  const safeMetadata: Record<string, string | number | boolean | string[] | null> = {};

  for (const key of SAFE_AUDIT_METADATA_KEYS) {
    const value = metadata[key];

    if (isSafeAuditMetadataValue(value)) {
      safeMetadata[key] = value;
    }
  }

  return safeMetadata;
}

function isSafeAuditMetadataValue(
  value: unknown
): value is string | number | boolean | string[] | null {
  if (value === null) {
    return true;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
