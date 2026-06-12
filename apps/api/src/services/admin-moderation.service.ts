import {
  events,
  listings,
  messages,
  moderationActions,
  moderationCases,
  profiles,
  reports,
  users
} from "@babyloop/database/schema";
import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import {
  recordSensitiveAccessDenied,
  recordSensitiveAccessGranted,
  type SensitiveAccessAuditContext
} from "./admin-sensitive-access-audit.service.js";
import { createSafeTextPreview } from "./redaction.service.js";
import type { FastifyInstance } from "fastify";
import type {
  AdminModerationEnforcementAction,
  AdminSensitiveAccessField
} from "../schemas/admin-moderation.schemas.js";

export type AdminModerationCaseStatus =
  | "pending"
  | "in_review"
  | "resolved"
  | "dismissed";

export type AdminModerationTargetType = "listing" | "profile" | "message";

export type AdminModerationSort =
  | "newest"
  | "oldest"
  | "updated_desc"
  | "updated_asc";

export type AdminModerationActionType =
  | "note"
  | "review_started"
  | "dismissed"
  | "resolved"
  | "action_taken";

export type AdminModerationCaseSummary = {
  id: string;
  targetType: AdminModerationTargetType;
  targetId: string;
  status: AdminModerationCaseStatus;
  priority: "low" | "normal" | "high";
  createdAt: string;
  updatedAt: string;
  report: {
    id: string;
    reason: string;
    status: string;
    createdAt: string;
    reporter: {
      redacted: true;
    } | null;
  } | null;
  targetPreview: AdminTargetPreview | null;
};

export type AdminModerationCasesSummary = {
  total: number;
  byStatus: {
    pending: number;
    inReview: number;
    resolved: number;
    dismissed: number;
  };
  byTargetType: {
    listing: number;
    profile: number;
    message: number;
  };
};

export type AdminModerationCaseListResult = {
  cases: AdminModerationCaseSummary[];
  summary: AdminModerationCasesSummary;
};

export type AdminTargetPreview =
  | {
      type: "listing";
      id: string;
      title: string;
      status: string;
    }
  | {
      type: "profile";
      id: string;
      displayName: string;
      safetyStatus: "active" | "restricted" | "suspended";
    }
  | {
      type: "message";
      id: string;
      bodyPreview: string;
      createdAt: string;
    };

export type AdminModerationActionSummary = {
  id: string;
  actionType: string;
  note: string | null;
  createdAt: string;
  actorProfile: {
    id: string;
    displayName: string;
  } | null;
};

export type AdminModerationTimelineItemType =
  | "audit_event"
  | "case_created"
  | "moderation_action"
  | "note"
  | "report_received"
  | "sensitive_access_denied"
  | "sensitive_access_granted"
  | "status_change";

export type AdminModerationTimelineMetadata = Record<
  string,
  string | number | boolean | string[] | null
>;

export type AdminModerationTimelineItem = {
  id: string;
  type: AdminModerationTimelineItemType;
  label: string;
  createdAt: string;
  actor: {
    id: string;
    displayName: string | null;
  } | null;
  metadata?: AdminModerationTimelineMetadata | undefined;
  note?: string | null | undefined;
};

export type AdminModerationSensitiveAccessResult =
  | {
      status: "granted";
      caseId: string;
      grantedFields: AdminSensitiveAccessField[];
      sensitive: {
        reporter?: {
          profileId: string;
          displayName: string | null;
          email: string | null;
        };
        message?: {
          id: string;
          body: string;
          senderProfileId: string;
          createdAt: string;
        };
      };
      auditEventId: string;
    }
  | { status: "not_found" };

export type AdminModerationEnforcementResult =
  | {
      status: "applied";
      caseId: string;
      action: AdminModerationEnforcementAction;
      targetType: AdminModerationTargetType;
      targetId: string;
      resultingStatus: string;
      moderationActionId: string;
      auditEventId: string;
    }
  | { status: "not_found" | "target_not_found" | "incompatible_action" | "invalid_transition" };

export type AdminModerationSensitiveAccessCaseContext = SensitiveAccessAuditContext & {
  reportId: string | null;
};

export async function listAdminModerationCases(
  app: FastifyInstance,
  filters: {
    status?: AdminModerationCaseStatus;
    targetType?: AdminModerationTargetType;
    q?: string;
    sort?: AdminModerationSort;
    limit?: number;
  }
): Promise<AdminModerationCaseListResult> {
  const whereConditions = [
    filters.status ? eq(moderationCases.status, filters.status) : undefined,
    filters.targetType ? eq(moderationCases.targetType, filters.targetType) : undefined,
    filters.q ? buildModerationCaseSearchCondition(filters.q) : undefined
  ].filter(Boolean);

  const rows = await app.db
    .select({
      id: moderationCases.id,
      targetType: moderationCases.targetType,
      targetId: moderationCases.targetId,
      status: moderationCases.status,
      priority: moderationCases.priority,
      createdAt: moderationCases.createdAt,
      updatedAt: moderationCases.updatedAt,
      reportId: reports.id,
      reportReason: reports.reason,
      reportStatus: reports.status,
      reportCreatedAt: reports.createdAt,
      reporterProfileId: reports.reporterProfileId
    })
    .from(moderationCases)
    .leftJoin(reports, eq(moderationCases.reportId, reports.id))
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .orderBy(getModerationCaseOrderBy(filters.sort))
    .limit(filters.limit ?? 50);

  const targetPreviews = await loadTargetPreviews(
    app,
    rows.map((row) => ({
      targetType: row.targetType,
      targetId: row.targetId
    }))
  );

  const cases = rows.map((row) => ({
    id: row.id,
    targetType: row.targetType,
    targetId: row.targetId,
    status: row.status,
    priority: row.priority,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    report: row.reportId
      ? {
          id: row.reportId,
          reason: row.reportReason ?? "other",
          status: row.reportStatus ?? "pending",
          createdAt: row.reportCreatedAt?.toISOString() ?? row.createdAt.toISOString(),
          reporter: row.reporterProfileId
            ? {
                redacted: true as const
              }
            : null
        }
      : null,
    targetPreview: targetPreviews.get(targetKey(row.targetType, row.targetId)) ?? null
  }));

  return {
    cases,
    summary: summarizeModerationCases(cases)
  };
}

function buildModerationCaseSearchCondition(query: string) {
  const pattern = `%${query.trim()}%`;

  return or(
    sql`${moderationCases.id}::text ilike ${pattern}`,
    sql`${moderationCases.targetId}::text ilike ${pattern}`,
    sql`${moderationCases.targetType}::text ilike ${pattern}`,
    sql`${moderationCases.status}::text ilike ${pattern}`,
    sql`${reports.id}::text ilike ${pattern}`,
    sql`${reports.reason}::text ilike ${pattern}`,
    sql`${reports.status}::text ilike ${pattern}`
  );
}

function getModerationCaseOrderBy(sort: AdminModerationSort | undefined) {
  switch (sort) {
    case "oldest":
      return asc(moderationCases.createdAt);
    case "updated_desc":
      return desc(moderationCases.updatedAt);
    case "updated_asc":
      return asc(moderationCases.updatedAt);
    case "newest":
    default:
      return desc(moderationCases.createdAt);
  }
}

function summarizeModerationCases(
  cases: AdminModerationCaseSummary[]
): AdminModerationCasesSummary {
  const summary: AdminModerationCasesSummary = {
    total: cases.length,
    byStatus: {
      pending: 0,
      inReview: 0,
      resolved: 0,
      dismissed: 0
    },
    byTargetType: {
      listing: 0,
      profile: 0,
      message: 0
    }
  };

  for (const moderationCase of cases) {
    if (moderationCase.status === "in_review") {
      summary.byStatus.inReview += 1;
    } else {
      summary.byStatus[moderationCase.status] += 1;
    }

    summary.byTargetType[moderationCase.targetType] += 1;
  }

  return summary;
}

export async function getAdminModerationCaseDetail(
  app: FastifyInstance,
  caseId: string
): Promise<
  | {
      status: "found";
      case: AdminModerationCaseSummary;
      actions: AdminModerationActionSummary[];
      timeline: AdminModerationTimelineItem[];
    }
  | { status: "not_found" }
> {
  const { cases } = await listAdminModerationCases(app, { limit: 100 });

  const foundCase = cases.find((item) => item.id === caseId);

  if (!foundCase) {
    return { status: "not_found" };
  }

  const actions = await listCaseActions(app, caseId);
  const auditEvents = await listCaseAuditEvents(app, caseId);

  return {
    status: "found",
    case: foundCase,
    actions,
    timeline: buildAdminModerationTimeline(foundCase, actions, auditEvents)
  };
}

export async function requestAdminModerationSensitiveAccess(
  app: FastifyInstance,
  params: {
    actorProfileId: string;
    caseId: string;
    fields: AdminSensitiveAccessField[];
    reason: string;
  }
): Promise<AdminModerationSensitiveAccessResult> {
  const moderationCase = await getAdminModerationSensitiveAccessCaseContext(
    app,
    params.caseId
  );

  if (!moderationCase) {
    return { status: "not_found" };
  }

  const requestedFields = [...new Set(params.fields)];
  const grantedFields: AdminSensitiveAccessField[] = [];
  const sensitive: Extract<AdminModerationSensitiveAccessResult, { status: "granted" }>["sensitive"] = {};

  if (requestedFields.includes("reporter") && moderationCase.reportId) {
    const reporter = await loadReporterSensitiveData(app, moderationCase.reportId);

    if (reporter) {
      sensitive.reporter = reporter;
      grantedFields.push("reporter");
    }
  }

  if (
    requestedFields.includes("message") &&
    moderationCase.targetType === "message" &&
    moderationCase.targetId
  ) {
    const message = await loadMessageSensitiveData(app, moderationCase.targetId);

    if (message) {
      sensitive.message = message;
      grantedFields.push("message");
    }
  }

  const deniedFields = requestedFields.filter(
    (field) => !grantedFields.includes(field)
  );

  if (deniedFields.length > 0) {
    await recordSensitiveAccessDenied(app, {
      actorProfileId: params.actorProfileId,
      context: moderationCase,
      requestedFields,
      deniedFields,
      denialReason: "field_not_available_for_case"
    });
  }

  const auditEventId = await recordSensitiveAccessGranted(app, {
    actorProfileId: params.actorProfileId,
    context: moderationCase,
    requestedFields,
    grantedFields,
    deniedFields: deniedFields.length > 0 ? deniedFields : undefined,
    reason: params.reason
  });

  return {
    status: "granted",
    caseId: moderationCase.caseId,
    grantedFields,
    sensitive,
    auditEventId
  };
}

export async function applyAdminModerationEnforcement(
  app: FastifyInstance,
  params: {
    actorProfileId: string;
    caseId: string;
    action: AdminModerationEnforcementAction;
    reason: string;
  }
): Promise<AdminModerationEnforcementResult> {
  const moderationCase = await getAdminModerationSensitiveAccessCaseContext(
    app,
    params.caseId
  );

  if (!moderationCase) {
    return { status: "not_found" };
  }

  if (!isEnforcementActionCompatible(moderationCase.targetType, params.action)) {
    return { status: "incompatible_action" };
  }

  if (params.action === "listing_hide" || params.action === "listing_restore") {
    return applyListingEnforcement(app, {
      actorProfileId: params.actorProfileId,
      caseId: params.caseId,
      action: params.action,
      reason: params.reason,
      targetId: moderationCase.targetId ?? "",
      targetType: "listing"
    });
  }

  if (params.action === "message_hide" || params.action === "message_mark_reviewed") {
    return applyMessageEnforcement(app, {
      actorProfileId: params.actorProfileId,
      caseId: params.caseId,
      action: params.action,
      reason: params.reason,
      targetId: moderationCase.targetId ?? "",
      targetType: "message"
    });
  }

  if (
    params.action === "profile_warn" ||
    params.action === "profile_restrict" ||
    params.action === "profile_suspend" ||
    params.action === "profile_restore"
  ) {
    return applyProfileEnforcement(app, {
      actorProfileId: params.actorProfileId,
      caseId: params.caseId,
      action: params.action,
      reason: params.reason,
      targetId: moderationCase.targetId ?? "",
      targetType: "profile"
    });
  }

  return { status: "incompatible_action" };
}

async function applyListingEnforcement(
  app: FastifyInstance,
  params: {
    actorProfileId: string;
    caseId: string;
    action: Extract<
      AdminModerationEnforcementAction,
      "listing_hide" | "listing_restore"
    >;
    reason: string;
    targetId: string;
    targetType: "listing";
  }
): Promise<AdminModerationEnforcementResult> {
  const [listing] = await app.db
    .select({
      id: listings.id,
      status: listings.status
    })
    .from(listings)
    .where(eq(listings.id, params.targetId))
    .limit(1);

  if (!listing) {
    return { status: "target_not_found" };
  }

  const resultingStatus =
    params.action === "listing_hide" ? "archived" : "active";

  const result = await app.db.transaction(async (tx) => {
    await tx
      .update(listings)
      .set({
        status: resultingStatus,
        updatedAt: new Date()
      })
      .where(eq(listings.id, params.targetId));

    const [moderationAction] = await tx
      .insert(moderationActions)
      .values({
        moderationCaseId: params.caseId,
        actorProfileId: params.actorProfileId,
        actionType: params.action,
        note: params.reason
      })
      .returning({
        id: moderationActions.id
      });

    const [auditEvent] = await tx
      .insert(events)
      .values({
        actorProfileId: params.actorProfileId,
        eventType: "admin_moderation_enforcement",
        entityType: "moderation_case",
        entityId: params.caseId,
        metadata: {
          enforcementAction: params.action,
          targetType: params.targetType,
          targetId: params.targetId,
          resultingStatus
        }
      })
      .returning({
        id: events.id
      });

    if (!moderationAction || !auditEvent) {
      throw new Error("Moderation enforcement audit creation failed.");
    }

    return {
      auditEventId: auditEvent.id,
      moderationActionId: moderationAction.id
    };
  });

  return {
    status: "applied",
    caseId: params.caseId,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    resultingStatus,
    moderationActionId: result.moderationActionId,
    auditEventId: result.auditEventId
  };
}

async function applyMessageEnforcement(
  app: FastifyInstance,
  params: {
    actorProfileId: string;
    caseId: string;
    action: Extract<
      AdminModerationEnforcementAction,
      "message_hide" | "message_mark_reviewed"
    >;
    reason: string;
    targetId: string;
    targetType: "message";
  }
): Promise<AdminModerationEnforcementResult> {
  const [message] = await app.db
    .select({
      id: messages.id,
      deletedAt: messages.deletedAt
    })
    .from(messages)
    .where(eq(messages.id, params.targetId))
    .limit(1);

  if (!message) {
    return { status: "target_not_found" };
  }

  const resultingStatus =
    params.action === "message_hide" ? "hidden" : "reviewed";

  const result = await app.db.transaction(async (tx) => {
    if (params.action === "message_hide") {
      await tx
        .update(messages)
        .set({
          deletedAt: message.deletedAt ?? new Date()
        })
        .where(eq(messages.id, params.targetId));
    }

    const [moderationAction] = await tx
      .insert(moderationActions)
      .values({
        moderationCaseId: params.caseId,
        actorProfileId: params.actorProfileId,
        actionType: params.action,
        note: params.reason
      })
      .returning({
        id: moderationActions.id
      });

    const [auditEvent] = await tx
      .insert(events)
      .values({
        actorProfileId: params.actorProfileId,
        eventType: "admin_moderation_enforcement",
        entityType: "moderation_case",
        entityId: params.caseId,
        metadata: {
          enforcementAction: params.action,
          targetType: params.targetType,
          targetId: params.targetId,
          resultingStatus
        }
      })
      .returning({
        id: events.id
      });

    if (!moderationAction || !auditEvent) {
      throw new Error("Moderation enforcement audit creation failed.");
    }

    return {
      auditEventId: auditEvent.id,
      moderationActionId: moderationAction.id
    };
  });

  return {
    status: "applied",
    caseId: params.caseId,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    resultingStatus,
    moderationActionId: result.moderationActionId,
    auditEventId: result.auditEventId
  };
}

async function applyProfileEnforcement(
  app: FastifyInstance,
  params: {
    actorProfileId: string;
    caseId: string;
    action: Extract<
      AdminModerationEnforcementAction,
      "profile_warn" | "profile_restrict" | "profile_suspend" | "profile_restore"
    >;
    reason: string;
    targetId: string;
    targetType: "profile";
  }
): Promise<AdminModerationEnforcementResult> {
  const [profile] = await app.db
    .select({
      id: profiles.id,
      safetyStatus: profiles.safetyStatus
    })
    .from(profiles)
    .where(eq(profiles.id, params.targetId))
    .limit(1);

  if (!profile) {
    return { status: "target_not_found" };
  }

  const nextSafetyStatus =
    params.action === "profile_warn"
      ? profile.safetyStatus
      : getNextProfileSafetyStatus(params.action);

  if (!nextSafetyStatus) {
    return { status: "incompatible_action" };
  }

  if (!isValidProfileSafetyTransition(profile.safetyStatus, params.action)) {
    return { status: "invalid_transition" };
  }

  const result = await app.db.transaction(async (tx) => {
    if (params.action !== "profile_warn") {
      await tx
        .update(profiles)
        .set({
          safetyStatus: nextSafetyStatus,
          safetyStatusUpdatedAt: new Date(),
          safetyStatusReasonCode: params.action,
          safetyStatusUpdatedByProfileId: params.actorProfileId,
          updatedAt: new Date()
        })
        .where(eq(profiles.id, params.targetId));
    }

    const [moderationAction] = await tx
      .insert(moderationActions)
      .values({
        moderationCaseId: params.caseId,
        actorProfileId: params.actorProfileId,
        actionType: params.action,
        note: params.reason
      })
      .returning({
        id: moderationActions.id
      });

    const [auditEvent] = await tx
      .insert(events)
      .values({
        actorProfileId: params.actorProfileId,
        eventType: "admin_profile_enforcement_applied",
        entityType: "moderation_case",
        entityId: params.caseId,
        metadata: {
          enforcementAction: params.action,
          targetType: params.targetType,
          targetId: params.targetId,
          previousSafetyStatus: profile.safetyStatus,
          nextSafetyStatus,
          reasonLength: params.reason.length,
          result: "applied"
        }
      })
      .returning({
        id: events.id
      });

    if (!moderationAction || !auditEvent) {
      throw new Error("Profile enforcement audit creation failed.");
    }

    return {
      auditEventId: auditEvent.id,
      moderationActionId: moderationAction.id
    };
  });

  return {
    status: "applied",
    caseId: params.caseId,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    resultingStatus: nextSafetyStatus,
    moderationActionId: result.moderationActionId,
    auditEventId: result.auditEventId
  };
}

function isEnforcementActionCompatible(
  targetType: AdminModerationTargetType | undefined,
  action: AdminModerationEnforcementAction
): boolean {
  if (targetType === "listing") {
    return action === "listing_hide" || action === "listing_restore";
  }

  if (targetType === "message") {
    return action === "message_hide" || action === "message_mark_reviewed";
  }

  if (targetType === "profile") {
    return (
      action === "profile_warn" ||
      action === "profile_restrict" ||
      action === "profile_suspend" ||
      action === "profile_restore"
    );
  }

  return false;
}

function getNextProfileSafetyStatus(
  action: Extract<
    AdminModerationEnforcementAction,
    "profile_restrict" | "profile_suspend" | "profile_restore"
  >
): "active" | "restricted" | "suspended" {
  switch (action) {
    case "profile_restrict":
      return "restricted";
    case "profile_suspend":
      return "suspended";
    case "profile_restore":
      return "active";
  }
}

function isValidProfileSafetyTransition(
  currentStatus: "active" | "restricted" | "suspended",
  action: Extract<
    AdminModerationEnforcementAction,
    "profile_warn" | "profile_restrict" | "profile_suspend" | "profile_restore"
  >
): boolean {
  switch (action) {
    case "profile_warn":
      return true;
    case "profile_restrict":
      return currentStatus !== "restricted";
    case "profile_suspend":
      return currentStatus !== "suspended";
    case "profile_restore":
      return currentStatus !== "active";
  }
}

export async function getAdminModerationSensitiveAccessCaseContext(
  app: FastifyInstance,
  caseId: string
): Promise<AdminModerationSensitiveAccessCaseContext | null> {
  const [moderationCase] = await app.db
    .select({
      id: moderationCases.id,
      targetType: moderationCases.targetType,
      targetId: moderationCases.targetId,
      reportId: moderationCases.reportId
    })
    .from(moderationCases)
    .where(eq(moderationCases.id, caseId))
    .limit(1);

  if (!moderationCase) {
    return null;
  }

  return {
    caseId: moderationCase.id,
    targetType: moderationCase.targetType,
    targetId: moderationCase.targetId,
    reportId: moderationCase.reportId
  };
}

export async function updateAdminModerationCaseStatus(
  app: FastifyInstance,
  params: {
    actorProfileId: string;
    caseId: string;
    status: AdminModerationCaseStatus;
    note?: string;
  }
): Promise<{ status: "updated"; caseId: string } | { status: "not_found" }> {
  const [updatedCase] = await app.db
    .update(moderationCases)
    .set({
      status: params.status,
      updatedAt: new Date()
    })
    .where(eq(moderationCases.id, params.caseId))
    .returning({
      id: moderationCases.id
    });

  if (!updatedCase) {
    return { status: "not_found" };
  }

  await app.db.insert(moderationActions).values({
    moderationCaseId: params.caseId,
    actorProfileId: params.actorProfileId,
    actionType: params.status,
    note: params.note
  });

  return {
    status: "updated",
    caseId: updatedCase.id
  };
}

export async function createAdminModerationAction(
  app: FastifyInstance,
  params: {
    actorProfileId: string;
    caseId: string;
    actionType: AdminModerationActionType;
    note?: string;
  }
): Promise<{ status: "created"; action: AdminModerationActionSummary } | { status: "not_found" }> {
  const [existingCase] = await app.db
    .select({
      id: moderationCases.id
    })
    .from(moderationCases)
    .where(eq(moderationCases.id, params.caseId))
    .limit(1);

  if (!existingCase) {
    return { status: "not_found" };
  }

  const [createdAction] = await app.db
    .insert(moderationActions)
    .values({
      moderationCaseId: params.caseId,
      actorProfileId: params.actorProfileId,
      actionType: params.actionType,
      note: params.note
    })
    .returning({
      id: moderationActions.id,
      actionType: moderationActions.actionType,
      note: moderationActions.note,
      createdAt: moderationActions.createdAt
    });

  if (!createdAction) {
    throw new Error("Moderation action creation failed.");
  }

  return {
    status: "created",
    action: {
      id: createdAction.id,
      actionType: createdAction.actionType,
      note: createdAction.note,
      createdAt: createdAction.createdAt.toISOString(),
      actorProfile: null
    }
  };
}

async function listCaseActions(
  app: FastifyInstance,
  caseId: string
): Promise<AdminModerationActionSummary[]> {
  const actorProfiles = profiles;

  const rows = await app.db
    .select({
      id: moderationActions.id,
      actionType: moderationActions.actionType,
      note: moderationActions.note,
      createdAt: moderationActions.createdAt,
      actorProfileId: actorProfiles.id,
      actorDisplayName: actorProfiles.displayName
    })
    .from(moderationActions)
    .leftJoin(actorProfiles, eq(moderationActions.actorProfileId, actorProfiles.id))
    .where(eq(moderationActions.moderationCaseId, caseId))
    .orderBy(desc(moderationActions.createdAt));

  return rows.map((row) => ({
    id: row.id,
    actionType: row.actionType,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    actorProfile: row.actorProfileId
      ? {
          id: row.actorProfileId,
          displayName: row.actorDisplayName ?? "Unknown admin"
        }
      : null
  }));
}

type AdminModerationAuditEventSummary = {
  id: string;
  eventType: string;
  createdAt: string;
  actor: {
    id: string;
    displayName: string | null;
  } | null;
  metadata: Record<string, unknown>;
};

async function listCaseAuditEvents(
  app: FastifyInstance,
  caseId: string
): Promise<AdminModerationAuditEventSummary[]> {
  const actorProfiles = profiles;

  const rows = await app.db
    .select({
      id: events.id,
      eventType: events.eventType,
      metadata: events.metadata,
      createdAt: events.createdAt,
      actorProfileId: actorProfiles.id,
      actorDisplayName: actorProfiles.displayName
    })
    .from(events)
    .leftJoin(actorProfiles, eq(events.actorProfileId, actorProfiles.id))
    .where(
      and(
        eq(events.entityType, "moderation_case"),
        eq(events.entityId, caseId),
        or(
          eq(events.eventType, "admin_moderation_enforcement"),
          eq(events.eventType, "admin_profile_enforcement_applied"),
          eq(events.eventType, "admin_sensitive_access_granted"),
          eq(events.eventType, "admin_sensitive_access_denied")
        )
      )
    )
    .orderBy(desc(events.createdAt));

  return rows.map((row) => ({
    id: row.id,
    eventType: row.eventType,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    actor: row.actorProfileId
      ? {
          id: row.actorProfileId,
          displayName: row.actorDisplayName ?? "Unknown admin"
        }
      : null
  }));
}

function buildAdminModerationTimeline(
  moderationCase: AdminModerationCaseSummary,
  actions: AdminModerationActionSummary[],
  auditEvents: AdminModerationAuditEventSummary[]
): AdminModerationTimelineItem[] {
  const timeline: AdminModerationTimelineItem[] = [
    {
      id: `${moderationCase.id}:case-created`,
      type: "case_created",
      label: "Case created",
      createdAt: moderationCase.createdAt,
      actor: null,
      metadata: sanitizeAdminModerationTimelineMetadata({
        targetType: moderationCase.targetType,
        targetId: moderationCase.targetId,
        status: moderationCase.status
      })
    }
  ];

  if (moderationCase.report) {
    timeline.push({
      id: `${moderationCase.report.id}:report-received`,
      type: "report_received",
      label: "Report received",
      createdAt: moderationCase.report.createdAt,
      actor: null,
      metadata: sanitizeAdminModerationTimelineMetadata({
        reportId: moderationCase.report.id,
        status: moderationCase.report.status
      })
    });
  }

  for (const action of actions) {
    const actionType = action.actionType;

    timeline.push({
      id: action.id,
      type: getTimelineTypeForAction(actionType),
      label: getTimelineLabelForAction(actionType),
      createdAt: action.createdAt,
      actor: action.actorProfile,
      note: action.note,
      metadata: sanitizeAdminModerationTimelineMetadata({
        actionType,
        ...(isModerationStatusAction(actionType) ? { status: actionType } : {})
      })
    });
  }

  for (const auditEvent of auditEvents) {
    timeline.push({
      id: auditEvent.id,
      type: getTimelineTypeForAuditEvent(auditEvent.eventType),
      label: getTimelineLabelForAuditEvent(auditEvent.eventType),
      createdAt: auditEvent.createdAt,
      actor: auditEvent.actor,
      metadata: sanitizeAdminModerationTimelineMetadata(auditEvent.metadata)
    });
  }

  return timeline.sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
}

export function sanitizeAdminModerationTimelineMetadata(
  metadata: Record<string, unknown>
): AdminModerationTimelineMetadata | undefined {
  const safeMetadata: AdminModerationTimelineMetadata = {};
  const allowedKeys = [
    "actionType",
    "riskLevel",
    "recommendedAction",
    "promptVersion",
    "providerName",
    "confidenceScore",
    "aiModelRunId",
    "denialReason",
    "deniedFields",
    "enforcementAction",
    "grantedFields",
    "moderationCaseId",
    "nextSafetyStatus",
    "previousSafetyStatus",
    "profileId",
    "reasonLength",
    "reportId",
    "requestedFields",
    "result",
    "resultingStatus",
    "status",
    "targetId",
    "targetType"
  ];

  for (const key of allowedKeys) {
    const value = metadata[key];

    if (isSafeTimelineMetadataValue(value)) {
      safeMetadata[key] = value;
    }
  }

  return Object.keys(safeMetadata).length > 0 ? safeMetadata : undefined;
}

function isSafeTimelineMetadataValue(
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

function getTimelineTypeForAuditEvent(
  eventType: string
): AdminModerationTimelineItemType {
  if (eventType === "admin_sensitive_access_granted") {
    return "sensitive_access_granted";
  }

  if (eventType === "admin_sensitive_access_denied") {
    return "sensitive_access_denied";
  }

  return "audit_event";
}

function getTimelineLabelForAuditEvent(eventType: string): string {
  if (eventType === "admin_sensitive_access_granted") {
    return "Sensitive access granted";
  }

  if (eventType === "admin_sensitive_access_denied") {
    return "Sensitive access denied";
  }

  if (eventType === "admin_moderation_enforcement") {
    return "Enforcement applied";
  }

  if (eventType === "admin_profile_enforcement_applied") {
    return "Profile enforcement applied";
  }

  if (eventType === "admin_ai_moderation_summary_generated") {
    return "AI moderation summary generated";
  }

  return "Audit event";
}

function getTimelineTypeForAction(
  actionType: string
): AdminModerationTimelineItemType {
  if (actionType === "note") {
    return "note";
  }

  if (isModerationStatusAction(actionType)) {
    return "status_change";
  }

  return "moderation_action";
}

function getTimelineLabelForAction(actionType: string): string {
  switch (actionType) {
    case "note":
      return "Internal note";
    case "pending":
      return "Status changed to pending";
    case "in_review":
      return "Status changed to in review";
    case "review_started":
      return "Review started";
    case "listing_hide":
      return "Listing hidden";
    case "listing_restore":
      return "Listing restored";
    case "message_hide":
      return "Message hidden";
    case "message_mark_reviewed":
      return "Message marked reviewed";
    case "profile_warn":
      return "Profile warned";
    case "profile_restrict":
      return "Profile restricted";
    case "profile_suspend":
      return "Profile suspended";
    case "profile_restore":
      return "Profile restored";
    case "dismissed":
      return "Status changed to dismissed";
    case "resolved":
      return "Status changed to resolved";
    case "action_taken":
      return "Action taken";
    default:
      return "Moderation action";
  }
}

function isModerationStatusAction(
  actionType: string
): actionType is AdminModerationCaseStatus {
  return (
    actionType === "pending" ||
    actionType === "in_review" ||
    actionType === "resolved" ||
    actionType === "dismissed"
  );
}

async function loadTargetPreviews(
  app: FastifyInstance,
  targets: Array<{ targetType: AdminModerationTargetType; targetId: string }>
): Promise<Map<string, AdminTargetPreview>> {
  const previews = new Map<string, AdminTargetPreview>();

  for (const target of targets) {
    if (previews.has(targetKey(target.targetType, target.targetId))) {
      continue;
    }

    if (target.targetType === "listing") {
      const [listing] = await app.db
        .select({
          id: listings.id,
          title: listings.title,
          status: listings.status
        })
        .from(listings)
        .where(eq(listings.id, target.targetId))
        .limit(1);

      if (listing) {
        previews.set(targetKey(target.targetType, target.targetId), {
          type: "listing",
          id: listing.id,
          title: createSafeTextPreview(listing.title, 80),
          status: listing.status
        });
      }

      continue;
    }

    if (target.targetType === "profile") {
      const [profile] = await app.db
        .select({
          id: profiles.id,
          displayName: profiles.displayName,
          safetyStatus: profiles.safetyStatus
        })
        .from(profiles)
        .where(eq(profiles.id, target.targetId))
        .limit(1);

      if (profile) {
        previews.set(targetKey(target.targetType, target.targetId), {
          type: "profile",
          id: profile.id,
          displayName: createSafeTextPreview(profile.displayName, 80),
          safetyStatus: profile.safetyStatus
        });
      }

      continue;
    }

    const [message] = await app.db
      .select({
        id: messages.id,
        body: messages.body,
        createdAt: messages.createdAt
      })
      .from(messages)
      .where(eq(messages.id, target.targetId))
      .limit(1);

    if (message) {
      previews.set(targetKey(target.targetType, target.targetId), {
        type: "message",
        id: message.id,
        bodyPreview: createSafeTextPreview(message.body),
        createdAt: message.createdAt.toISOString()
      });
    }
  }

  return previews;
}

async function loadReporterSensitiveData(
  app: FastifyInstance,
  reportId: string
): Promise<{
  profileId: string;
  displayName: string | null;
  email: string | null;
} | null> {
  const [reporter] = await app.db
    .select({
      profileId: profiles.id,
      displayName: profiles.displayName,
      email: users.email
    })
    .from(reports)
    .innerJoin(profiles, eq(profiles.id, reports.reporterProfileId))
    .leftJoin(users, eq(users.id, profiles.userId))
    .where(eq(reports.id, reportId))
    .limit(1);

  if (!reporter) {
    return null;
  }

  return {
    profileId: reporter.profileId,
    displayName: reporter.displayName,
    email: reporter.email
  };
}

async function loadMessageSensitiveData(
  app: FastifyInstance,
  messageId: string
): Promise<{
  id: string;
  body: string;
  senderProfileId: string;
  createdAt: string;
} | null> {
  const [message] = await app.db
    .select({
      id: messages.id,
      body: messages.body,
      senderProfileId: messages.senderProfileId,
      createdAt: messages.createdAt
    })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);

  if (!message) {
    return null;
  }

  return {
    id: message.id,
    body: message.body,
    senderProfileId: message.senderProfileId,
    createdAt: message.createdAt.toISOString()
  };
}

function targetKey(targetType: string, targetId: string): string {
  return `${targetType}:${targetId}`;
}
