import {
  listings,
  messages,
  moderationActions,
  moderationCases,
  profiles,
  reports,
  users
} from "@babyloop/database/schema";
import { and, desc, eq } from "drizzle-orm";
import {
  recordSensitiveAccessDenied,
  recordSensitiveAccessGranted,
  type SensitiveAccessAuditContext
} from "./admin-sensitive-access-audit.service.js";
import { createSafeTextPreview } from "./redaction.service.js";
import type { FastifyInstance } from "fastify";
import type { AdminSensitiveAccessField } from "../schemas/admin-moderation.schemas.js";

export type AdminModerationCaseStatus =
  | "pending"
  | "in_review"
  | "resolved"
  | "dismissed";

export type AdminModerationTargetType = "listing" | "profile" | "message";

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

export type AdminModerationSensitiveAccessCaseContext = SensitiveAccessAuditContext & {
  reportId: string | null;
};

export async function listAdminModerationCases(
  app: FastifyInstance,
  filters: {
    status?: AdminModerationCaseStatus;
    targetType?: AdminModerationTargetType;
    limit?: number;
  }
): Promise<AdminModerationCaseSummary[]> {
  const whereConditions = [
    filters.status ? eq(moderationCases.status, filters.status) : undefined,
    filters.targetType ? eq(moderationCases.targetType, filters.targetType) : undefined
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
    .orderBy(desc(moderationCases.createdAt))
    .limit(filters.limit ?? 50);

  const targetPreviews = await loadTargetPreviews(
    app,
    rows.map((row) => ({
      targetType: row.targetType,
      targetId: row.targetId
    }))
  );

  return rows.map((row) => ({
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
                redacted: true
              }
            : null
        }
      : null,
    targetPreview: targetPreviews.get(targetKey(row.targetType, row.targetId)) ?? null
  }));
}

export async function getAdminModerationCaseDetail(
  app: FastifyInstance,
  caseId: string
): Promise<
  | {
      status: "found";
      case: AdminModerationCaseSummary;
      actions: AdminModerationActionSummary[];
    }
  | { status: "not_found" }
> {
  const cases = await listAdminModerationCases(app, { limit: 100 });

  const foundCase = cases.find((item) => item.id === caseId);

  if (!foundCase) {
    return { status: "not_found" };
  }

  const actions = await listCaseActions(app, caseId);

  return {
    status: "found",
    case: foundCase,
    actions
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
          displayName: profiles.displayName
        })
        .from(profiles)
        .where(eq(profiles.id, target.targetId))
        .limit(1);

      if (profile) {
        previews.set(targetKey(target.targetType, target.targetId), {
          type: "profile",
          id: profile.id,
          displayName: createSafeTextPreview(profile.displayName, 80)
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
