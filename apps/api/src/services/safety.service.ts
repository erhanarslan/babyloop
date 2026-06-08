import {
  blockedProfiles,
  conversationParticipants,
  listings,
  messages,
  moderationCases,
  profiles,
  reports,
  userSafetyEvents
} from "@babyloop/database/schema";
import { and, eq, or } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ReportBody } from "../schemas/safety.schemas.js";

export type SafetyTargetType = "listing" | "profile" | "message";

export type ReportResponse = {
  id: string;
  targetType: SafetyTargetType;
  targetId: string;
  status: string;
  created: boolean;
};

export type BlockedProfileResponse = {
  id: string;
  displayName: string;
  blockedAt: string;
};

export async function createSafetyReport(
  app: FastifyInstance,
  reporterProfileId: string,
  targetType: SafetyTargetType,
  targetId: string,
  body: ReportBody
): Promise<
  | { status: "reported"; report: ReportResponse }
  | { status: "not_found" | "forbidden" | "cannot_report_self" }
> {
  const target = await validateReportTarget(app, reporterProfileId, targetType, targetId);

  if (target.status !== "ok") {
    return target;
  }

  const result = await app.db.transaction(async (tx) => {
    const [createdReport] = await tx
      .insert(reports)
      .values({
        reporterProfileId,
        targetType,
        targetId,
        reason: body.reason,
        details: body.details
      })
      .onConflictDoNothing({
        target: [reports.reporterProfileId, reports.targetType, reports.targetId]
      })
      .returning({
        id: reports.id,
        targetType: reports.targetType,
        targetId: reports.targetId,
        status: reports.status
      });

    if (createdReport) {
      await tx.insert(moderationCases).values({
        reportId: createdReport.id,
        targetType,
        targetId
      });

      await tx.insert(userSafetyEvents).values({
        profileId: reporterProfileId,
        eventType: "report_created",
        metadata: {
          reportId: createdReport.id,
          targetId,
          targetType
        }
      });

      return {
        created: true,
        report: createdReport
      };
    }

    const [existingReport] = await tx
      .select({
        id: reports.id,
        targetType: reports.targetType,
        targetId: reports.targetId,
        status: reports.status
      })
      .from(reports)
      .where(
        and(
          eq(reports.reporterProfileId, reporterProfileId),
          eq(reports.targetType, targetType),
          eq(reports.targetId, targetId)
        )
      )
      .limit(1);

    if (!existingReport) {
      throw new Error("Report lookup failed.");
    }

    return {
      created: false,
      report: existingReport
    };
  });

  return {
    status: "reported",
    report: {
      id: result.report.id,
      targetType: result.report.targetType,
      targetId: result.report.targetId,
      status: result.report.status,
      created: result.created
    }
  };
}

export async function blockProfile(
  app: FastifyInstance,
  blockerProfileId: string,
  blockedProfileId: string
): Promise<
  | { status: "blocked"; profile: BlockedProfileResponse; created: boolean }
  | { status: "not_found" | "cannot_block_self" }
> {
  if (blockerProfileId === blockedProfileId) {
    return { status: "cannot_block_self" };
  }

  const profile = await getProfileSummary(app, blockedProfileId);

  if (!profile) {
    return { status: "not_found" };
  }

  const created = await app.db.transaction(async (tx) => {
    const [createdBlock] = await tx
      .insert(blockedProfiles)
      .values({
        blockerProfileId,
        blockedProfileId
      })
      .onConflictDoNothing({
        target: [blockedProfiles.blockerProfileId, blockedProfiles.blockedProfileId]
      })
      .returning({
        id: blockedProfiles.id
      });

    if (createdBlock) {
      await tx.insert(userSafetyEvents).values({
        profileId: blockerProfileId,
        eventType: "profile_blocked",
        metadata: {
          blockedProfileId
        }
      });
    }

    return Boolean(createdBlock);
  });

  return {
    status: "blocked",
    created,
    profile: {
      id: profile.id,
      displayName: profile.displayName,
      blockedAt: new Date().toISOString()
    }
  };
}

export async function unblockProfile(
  app: FastifyInstance,
  blockerProfileId: string,
  blockedProfileId: string
): Promise<
  | { status: "unblocked"; removed: boolean }
  | { status: "not_found" | "cannot_block_self" }
> {
  if (blockerProfileId === blockedProfileId) {
    return { status: "cannot_block_self" };
  }

  if (!(await getProfileSummary(app, blockedProfileId))) {
    return { status: "not_found" };
  }

  const [deletedBlock] = await app.db
    .delete(blockedProfiles)
    .where(
      and(
        eq(blockedProfiles.blockerProfileId, blockerProfileId),
        eq(blockedProfiles.blockedProfileId, blockedProfileId)
      )
    )
    .returning({
      id: blockedProfiles.id
    });

  if (deletedBlock) {
    await app.db.insert(userSafetyEvents).values({
      profileId: blockerProfileId,
      eventType: "profile_unblocked",
      metadata: {
        blockedProfileId
      }
    });
  }

  return {
    status: "unblocked",
    removed: Boolean(deletedBlock)
  };
}

export async function listBlockedProfiles(
  app: FastifyInstance,
  blockerProfileId: string
): Promise<BlockedProfileResponse[]> {
  const rows = await app.db
    .select({
      id: profiles.id,
      displayName: profiles.displayName,
      blockedAt: blockedProfiles.createdAt
    })
    .from(blockedProfiles)
    .innerJoin(profiles, eq(blockedProfiles.blockedProfileId, profiles.id))
    .where(eq(blockedProfiles.blockerProfileId, blockerProfileId));

  return rows.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    blockedAt: row.blockedAt.toISOString()
  }));
}

export async function isProfilePairBlocked(
  app: FastifyInstance,
  firstProfileId: string,
  secondProfileId: string
): Promise<boolean> {
  const [block] = await app.db
    .select({ id: blockedProfiles.id })
    .from(blockedProfiles)
    .where(
      or(
        and(
          eq(blockedProfiles.blockerProfileId, firstProfileId),
          eq(blockedProfiles.blockedProfileId, secondProfileId)
        ),
        and(
          eq(blockedProfiles.blockerProfileId, secondProfileId),
          eq(blockedProfiles.blockedProfileId, firstProfileId)
        )
      )
    )
    .limit(1);

  return Boolean(block);
}

async function validateReportTarget(
  app: FastifyInstance,
  reporterProfileId: string,
  targetType: SafetyTargetType,
  targetId: string
): Promise<{ status: "ok" } | { status: "not_found" | "forbidden" | "cannot_report_self" }> {
  if (targetType === "profile") {
    const profile = await getProfileSummary(app, targetId);

    if (!profile) {
      return { status: "not_found" };
    }

    return profile.id === reporterProfileId ? { status: "cannot_report_self" } : { status: "ok" };
  }

  if (targetType === "listing") {
    const [listing] = await app.db
      .select({
        id: listings.id,
        sellerProfileId: listings.sellerProfileId
      })
      .from(listings)
      .where(eq(listings.id, targetId))
      .limit(1);

    if (!listing) {
      return { status: "not_found" };
    }

    return listing.sellerProfileId === reporterProfileId ? { status: "forbidden" } : { status: "ok" };
  }

  const [message] = await app.db
    .select({
      id: messages.id,
      conversationId: messages.conversationId
    })
    .from(messages)
    .where(eq(messages.id, targetId))
    .limit(1);

  if (!message) {
    return { status: "not_found" };
  }

  const [participant] = await app.db
    .select({ id: conversationParticipants.id })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, message.conversationId),
        eq(conversationParticipants.profileId, reporterProfileId)
      )
    )
    .limit(1);

  return participant ? { status: "ok" } : { status: "forbidden" };
}

async function getProfileSummary(
  app: FastifyInstance,
  profileId: string
): Promise<{ id: string; displayName: string } | null> {
  const [profile] = await app.db
    .select({
      id: profiles.id,
      displayName: profiles.displayName
    })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);

  return profile ?? null;
}
