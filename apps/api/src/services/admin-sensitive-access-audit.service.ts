import { events } from "@babyloop/database/schema";
import type { FastifyInstance } from "fastify";
import type { AdminSensitiveAccessField } from "../schemas/admin-moderation.schemas.js";

export type SensitiveAccessAuditContext = {
  caseId: string;
  targetType?: "listing" | "profile" | "message";
  targetId?: string;
};

type SensitiveAccessGrantedInput = {
  actorProfileId: string;
  context: SensitiveAccessAuditContext;
  requestedFields: string[];
  grantedFields: AdminSensitiveAccessField[];
  deniedFields?: string[] | undefined;
  reason: string;
};

type SensitiveAccessDeniedInput = {
  actorProfileId: string;
  context: SensitiveAccessAuditContext;
  requestedFields?: string[] | undefined;
  deniedFields?: string[] | undefined;
  denialReason: string;
};

const maxAuditFieldCount = 10;
const maxAuditFieldLength = 80;

export async function recordSensitiveAccessGranted(
  app: FastifyInstance,
  input: SensitiveAccessGrantedInput
): Promise<string> {
  const [auditEvent] = await app.db
    .insert(events)
    .values({
      actorProfileId: input.actorProfileId,
      eventType: "admin_sensitive_access_granted",
      entityType: "moderation_case",
      entityId: input.context.caseId,
      metadata: removeUndefinedMetadata({
        moderationCaseId: input.context.caseId,
        targetType: input.context.targetType,
        targetId: input.context.targetId,
        requestedFields: input.requestedFields,
        grantedFields: input.grantedFields,
        deniedFields: input.deniedFields,
        reason: input.reason
      })
    })
    .returning({
      id: events.id
    });

  if (!auditEvent) {
    throw new Error("Sensitive access granted audit event creation failed.");
  }

  return auditEvent.id;
}

export async function recordSensitiveAccessDenied(
  app: FastifyInstance,
  input: SensitiveAccessDeniedInput
): Promise<string> {
  const [auditEvent] = await app.db
    .insert(events)
    .values({
      actorProfileId: input.actorProfileId,
      eventType: "admin_sensitive_access_denied",
      entityType: "moderation_case",
      entityId: input.context.caseId,
      metadata: removeUndefinedMetadata({
        moderationCaseId: input.context.caseId,
        targetType: input.context.targetType,
        targetId: input.context.targetId,
        requestedFields: input.requestedFields,
        deniedFields: input.deniedFields,
        denialReason: input.denialReason
      })
    })
    .returning({
      id: events.id
    });

  if (!auditEvent) {
    throw new Error("Sensitive access denied audit event creation failed.");
  }

  return auditEvent.id;
}

export function collectRequestedFieldsForAudit(body: unknown): string[] | undefined {
  if (!body || typeof body !== "object" || !("fields" in body)) {
    return undefined;
  }

  const fields = (body as { fields?: unknown }).fields;

  if (!Array.isArray(fields)) {
    return undefined;
  }

  const normalizedFields = fields
    .filter((field): field is string => typeof field === "string")
    .map((field) => field.trim())
    .filter(Boolean)
    .map((field) => field.slice(0, maxAuditFieldLength))
    .slice(0, maxAuditFieldCount);

  return [...new Set(normalizedFields)];
}

function removeUndefinedMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined)
  );
}
