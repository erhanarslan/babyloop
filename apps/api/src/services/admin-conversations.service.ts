import {
  conversationListingContexts,
  conversations,
  listings,
  messages,
  moderationActions,
  moderationCases,
  profiles,
  reports
} from "@babyloop/database/schema";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { FastifyInstance } from "fastify";
import type { AdminConversationsQuery } from "../schemas/admin-conversations.schemas.js";

const lowProfiles = alias(profiles, "admin_conversation_low_profiles");
const highProfiles = alias(profiles, "admin_conversation_high_profiles");
const senderProfiles = alias(profiles, "admin_conversation_sender_profiles");

type AdminConversationProfileSummary = {
  profileId: string;
  displayName: string;
  safetyStatus: "active" | "restricted" | "suspended";
};

type AdminConversationListingSummary = {
  listingId: string;
  title: string;
  status: string;
};

type AdminConversationMessagePreview = {
  messageId: string;
  senderProfileId: string;
  bodyPreview: string;
  isHidden: boolean;
  createdAt: string;
};

export type AdminConversationSummary = {
  conversationId: string;
  status: string;
  participants: [AdminConversationProfileSummary, AdminConversationProfileSummary];
  contextListing: AdminConversationListingSummary | null;
  latestMessage: AdminConversationMessagePreview | null;
  messageCount: number;
  reportedMessageCount: number;
  openCaseCount: number;
  enforcementCount: number;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminConversationMessageSummary = {
  messageId: string;
  sender: AdminConversationProfileSummary;
  bodyPreview: string;
  isHidden: boolean;
  reportCount: number;
  openCaseCount: number;
  enforcementCount: number;
  createdAt: string;
};

export type AdminConversationCaseSummary = {
  caseId: string;
  reportId: string | null;
  targetType: "message";
  targetId: string;
  status: "pending" | "in_review" | "resolved" | "dismissed";
  priority: "low" | "normal" | "high";
  reason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminConversationEnforcementSummary = {
  actionId: string;
  caseId: string | null;
  messageId: string | null;
  actionType: string;
  createdAt: string;
};

export type AdminConversationDetail = AdminConversationSummary & {
  messages: AdminConversationMessageSummary[];
  relatedModerationCases: AdminConversationCaseSummary[];
  enforcementHistory: AdminConversationEnforcementSummary[];
};

type ConversationRow = {
  conversationId: string;
  profileLowId: string;
  profileLowDisplayName: string;
  profileLowSafetyStatus: "active" | "restricted" | "suspended";
  profileHighId: string;
  profileHighDisplayName: string;
  profileHighSafetyStatus: "active" | "restricted" | "suspended";
  status: string;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function listAdminConversations(
  app: FastifyInstance,
  filters: AdminConversationsQuery
): Promise<AdminConversationSummary[]> {
  const limit = filters.limit ?? 50;
  const rows = await selectAdminConversationRows(app, filters, limit);

  return Promise.all(rows.map((row) => hydrateConversationSummary(app, row)));
}

export async function getAdminConversationDetail(
  app: FastifyInstance,
  conversationId: string
): Promise<AdminConversationDetail | null> {
  const [row] = await selectAdminConversationRows(app, { q: conversationId }, 1);

  if (!row || row.conversationId !== conversationId) {
    return null;
  }

  const summary = await hydrateConversationSummary(app, row);
  const messageRows = await loadConversationMessages(app, conversationId);
  const messageIds = messageRows.map((message) => message.messageId);
  const [relatedModerationCases, enforcementHistory] = await Promise.all([
    loadMessageModerationCases(app, messageIds),
    loadMessageEnforcementHistory(app, messageIds)
  ]);

  return {
    ...summary,
    messages: messageRows,
    relatedModerationCases,
    enforcementHistory
  };
}

async function selectAdminConversationRows(
  app: FastifyInstance,
  filters: AdminConversationsQuery,
  limit: number
): Promise<ConversationRow[]> {
  const conditions = buildConversationConditions(filters);
  const query = app.db
    .select({
      conversationId: conversations.id,
      profileLowId: conversations.profileLowId,
      profileLowDisplayName: lowProfiles.displayName,
      profileLowSafetyStatus: lowProfiles.safetyStatus,
      profileHighId: conversations.profileHighId,
      profileHighDisplayName: highProfiles.displayName,
      profileHighSafetyStatus: highProfiles.safetyStatus,
      status: conversations.status,
      lastMessageAt: conversations.lastMessageAt,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt
    })
    .from(conversations)
    .innerJoin(lowProfiles, eq(conversations.profileLowId, lowProfiles.id))
    .innerJoin(highProfiles, eq(conversations.profileHighId, highProfiles.id))
    .where(conditions)
    .orderBy(...conversationOrderBy(filters.sort))
    .limit(limit);

  return query;
}

function buildConversationConditions(filters: AdminConversationsQuery): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters.status) {
    conditions.push(eq(conversations.status, filters.status));
  }

  if (filters.q) {
    const q = filters.q.trim();
    const pattern = `%${q}%`;
    const maybeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(q);
    const qConditions: SQL[] = [
      ilike(lowProfiles.displayName, pattern),
      ilike(highProfiles.displayName, pattern)
    ];

    if (maybeUuid) {
      qConditions.push(eq(conversations.id, q));
      qConditions.push(eq(conversations.profileLowId, q));
      qConditions.push(eq(conversations.profileHighId, q));
    }

    conditions.push(or(...qConditions)!);
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

function conversationOrderBy(sort: AdminConversationsQuery["sort"]): SQL[] {
  switch (sort) {
    case "latest_asc":
      return [asc(conversations.lastMessageAt), asc(conversations.createdAt)];
    case "newest":
      return [desc(conversations.createdAt)];
    case "oldest":
      return [asc(conversations.createdAt)];
    case "latest_desc":
    default:
      return [desc(conversations.lastMessageAt), desc(conversations.updatedAt)];
  }
}

async function hydrateConversationSummary(
  app: FastifyInstance,
  row: ConversationRow
): Promise<AdminConversationSummary> {
  const [contextListing, latestMessage, messageCount, reportedMessageCount, openCaseCount, enforcementCount] = await Promise.all([
    loadLatestConversationListing(app, row.conversationId),
    loadLatestConversationMessagePreview(app, row.conversationId),
    countMessagesForConversation(app, row.conversationId),
    countReportedMessagesForConversation(app, row.conversationId),
    countOpenCasesForConversation(app, row.conversationId),
    countEnforcementsForConversation(app, row.conversationId)
  ]);

  return {
    conversationId: row.conversationId,
    status: row.status,
    participants: [
      {
        profileId: row.profileLowId,
        displayName: row.profileLowDisplayName,
        safetyStatus: row.profileLowSafetyStatus
      },
      {
        profileId: row.profileHighId,
        displayName: row.profileHighDisplayName,
        safetyStatus: row.profileHighSafetyStatus
      }
    ],
    contextListing,
    latestMessage,
    messageCount,
    reportedMessageCount,
    openCaseCount,
    enforcementCount,
    lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

async function loadLatestConversationListing(
  app: FastifyInstance,
  conversationId: string
): Promise<AdminConversationListingSummary | null> {
  const [row] = await app.db
    .select({
      listingId: listings.id,
      title: listings.title,
      status: listings.status
    })
    .from(conversationListingContexts)
    .innerJoin(listings, eq(conversationListingContexts.listingId, listings.id))
    .where(eq(conversationListingContexts.conversationId, conversationId))
    .orderBy(desc(conversationListingContexts.createdAt))
    .limit(1);

  return row ?? null;
}

async function loadLatestConversationMessagePreview(
  app: FastifyInstance,
  conversationId: string
): Promise<AdminConversationMessagePreview | null> {
  const [row] = await app.db
    .select({
      messageId: messages.id,
      senderProfileId: messages.senderProfileId,
      bodyText: messages.body,
      createdAt: messages.createdAt,
      deletedAt: messages.deletedAt
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(1);

  return row
    ? {
        messageId: row.messageId,
        senderProfileId: row.senderProfileId,
        bodyPreview: createRedactedMessagePreview(row.bodyText),
        isHidden: Boolean(row.deletedAt),
        createdAt: row.createdAt.toISOString()
      }
    : null;
}

async function loadConversationMessages(
  app: FastifyInstance,
  conversationId: string
): Promise<AdminConversationMessageSummary[]> {
  const rows = await app.db
    .select({
      messageId: messages.id,
      senderProfileId: messages.senderProfileId,
      senderDisplayName: senderProfiles.displayName,
      senderSafetyStatus: senderProfiles.safetyStatus,
      bodyText: messages.body,
      createdAt: messages.createdAt,
      deletedAt: messages.deletedAt
    })
    .from(messages)
    .innerJoin(senderProfiles, eq(messages.senderProfileId, senderProfiles.id))
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(50);

  const messageIds = rows.map((row) => row.messageId);
  const [reportCounts, openCaseCounts, enforcementCounts] = await Promise.all([
    countReportsByMessageId(app, messageIds),
    countOpenCasesByMessageId(app, messageIds),
    countEnforcementsByMessageId(app, messageIds)
  ]);

  return rows.map((row) => ({
    messageId: row.messageId,
    sender: {
      profileId: row.senderProfileId,
      displayName: row.senderDisplayName,
      safetyStatus: row.senderSafetyStatus
    },
    bodyPreview: createRedactedMessagePreview(row.bodyText),
    isHidden: Boolean(row.deletedAt),
    reportCount: reportCounts.get(row.messageId) ?? 0,
    openCaseCount: openCaseCounts.get(row.messageId) ?? 0,
    enforcementCount: enforcementCounts.get(row.messageId) ?? 0,
    createdAt: row.createdAt.toISOString()
  }));
}

async function loadMessageModerationCases(
  app: FastifyInstance,
  messageIds: string[]
): Promise<AdminConversationCaseSummary[]> {
  if (messageIds.length === 0) {
    return [];
  }

  const rows = await app.db
    .select({
      caseId: moderationCases.id,
      reportId: moderationCases.reportId,
      targetId: moderationCases.targetId,
      status: moderationCases.status,
      priority: moderationCases.priority,
      reason: reports.reason,
      createdAt: moderationCases.createdAt,
      updatedAt: moderationCases.updatedAt
    })
    .from(moderationCases)
    .leftJoin(reports, eq(moderationCases.reportId, reports.id))
    .where(
      and(
        eq(moderationCases.targetType, "message"),
        inArray(moderationCases.targetId, messageIds)
      )
    )
    .orderBy(desc(moderationCases.updatedAt))
    .limit(50);

  return rows.map((row) => ({
    caseId: row.caseId,
    reportId: row.reportId,
    targetType: "message",
    targetId: row.targetId,
    status: row.status,
    priority: row.priority,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }));
}

async function loadMessageEnforcementHistory(
  app: FastifyInstance,
  messageIds: string[]
): Promise<AdminConversationEnforcementSummary[]> {
  if (messageIds.length === 0) {
    return [];
  }

  const rows = await app.db
    .select({
      actionId: moderationActions.id,
      caseId: moderationActions.moderationCaseId,
      messageId: moderationCases.targetId,
      actionType: moderationActions.actionType,
      createdAt: moderationActions.createdAt
    })
    .from(moderationActions)
    .innerJoin(moderationCases, eq(moderationActions.moderationCaseId, moderationCases.id))
    .where(
      and(
        eq(moderationCases.targetType, "message"),
        inArray(moderationCases.targetId, messageIds)
      )
    )
    .orderBy(desc(moderationActions.createdAt))
    .limit(50);

  return rows.map((row) => ({
    actionId: row.actionId,
    caseId: row.caseId,
    messageId: row.messageId,
    actionType: row.actionType,
    createdAt: row.createdAt.toISOString()
  }));
}

async function countMessagesForConversation(app: FastifyInstance, conversationId: string): Promise<number> {
  const [row] = await app.db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .where(eq(messages.conversationId, conversationId));

  return row?.count ?? 0;
}

async function countReportedMessagesForConversation(app: FastifyInstance, conversationId: string): Promise<number> {
  const [row] = await app.db
    .select({ count: sql<number>`count(distinct ${reports.targetId})::int` })
    .from(reports)
    .innerJoin(messages, eq(reports.targetId, messages.id))
    .where(and(eq(reports.targetType, "message"), eq(messages.conversationId, conversationId)));

  return row?.count ?? 0;
}

async function countOpenCasesForConversation(app: FastifyInstance, conversationId: string): Promise<number> {
  const [row] = await app.db
    .select({ count: sql<number>`count(*)::int` })
    .from(moderationCases)
    .innerJoin(messages, eq(moderationCases.targetId, messages.id))
    .where(
      and(
        eq(moderationCases.targetType, "message"),
        eq(messages.conversationId, conversationId),
        inArray(moderationCases.status, ["pending", "in_review"])
      )
    );

  return row?.count ?? 0;
}

async function countEnforcementsForConversation(app: FastifyInstance, conversationId: string): Promise<number> {
  const [row] = await app.db
    .select({ count: sql<number>`count(*)::int` })
    .from(moderationActions)
    .innerJoin(moderationCases, eq(moderationActions.moderationCaseId, moderationCases.id))
    .innerJoin(messages, eq(moderationCases.targetId, messages.id))
    .where(and(eq(moderationCases.targetType, "message"), eq(messages.conversationId, conversationId)));

  return row?.count ?? 0;
}

async function countReportsByMessageId(app: FastifyInstance, messageIds: string[]): Promise<Map<string, number>> {
  if (messageIds.length === 0) {
    return new Map();
  }

  const rows = await app.db
    .select({ messageId: reports.targetId, count: sql<number>`count(*)::int` })
    .from(reports)
    .where(and(eq(reports.targetType, "message"), inArray(reports.targetId, messageIds)))
    .groupBy(reports.targetId);

  return new Map(rows.map((row) => [row.messageId, row.count]));
}

async function countOpenCasesByMessageId(app: FastifyInstance, messageIds: string[]): Promise<Map<string, number>> {
  if (messageIds.length === 0) {
    return new Map();
  }

  const rows = await app.db
    .select({ messageId: moderationCases.targetId, count: sql<number>`count(*)::int` })
    .from(moderationCases)
    .where(
      and(
        eq(moderationCases.targetType, "message"),
        inArray(moderationCases.targetId, messageIds),
        inArray(moderationCases.status, ["pending", "in_review"])
      )
    )
    .groupBy(moderationCases.targetId);

  return new Map(rows.map((row) => [row.messageId, row.count]));
}

async function countEnforcementsByMessageId(app: FastifyInstance, messageIds: string[]): Promise<Map<string, number>> {
  if (messageIds.length === 0) {
    return new Map();
  }

  const rows = await app.db
    .select({ messageId: moderationCases.targetId, count: sql<number>`count(*)::int` })
    .from(moderationActions)
    .innerJoin(moderationCases, eq(moderationActions.moderationCaseId, moderationCases.id))
    .where(and(eq(moderationCases.targetType, "message"), inArray(moderationCases.targetId, messageIds)))
    .groupBy(moderationCases.targetId);

  return new Map(rows.map((row) => [row.messageId, row.count]));
}

function createRedactedMessagePreview(input: string): string {
  const normalized = input.replace(/\s+/g, " ").trim();
  const redacted = normalized
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-contact]")
    .replace(/(?:\+?\d[\s().-]?){8,}\d/g, "[redacted-contact]");

  if (redacted.length <= 160) {
    return redacted;
  }

  return `${redacted.slice(0, 157)}...`;
}
