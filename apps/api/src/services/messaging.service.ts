import {
  conversationListingContexts,
  conversationParticipants,
  conversations,
  listings,
  messages,
  profiles
} from "@babyloop/database/schema";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { FastifyInstance } from "fastify";
import type { CurrentUser } from "../plugins/auth.plugin.js";
import type {
  CreateConversationBody,
  SendMessageBody
} from "../schemas/messaging.schemas.js";

const profileLowProfiles = alias(profiles, "profile_low_profiles");
const profileHighProfiles = alias(profiles, "profile_high_profiles");
const senderProfiles = alias(profiles, "sender_profiles");
const MESSAGEABLE_LISTING_STATUSES: Array<"active" | "reserved"> = ["active", "reserved"];

export type ConversationSummaryResponse = {
  id: string;
  otherProfile: {
    id: string;
    displayName: string;
  };
  contextListing: {
    id: string;
    title: string;
  } | null;
  latestMessage: {
    body: string;
    senderProfileId: string;
    createdAt: string;
  } | null;
  unreadCount: number;
  status: string;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MessageResponse = {
  id: string;
  conversationId: string;
  sender: {
    id: string;
    displayName: string;
  };
  body: string;
  createdAt: string;
  deletedAt: string | null;
};

type ConversationSummaryRow = {
  id: string;
  profileLowId: string;
  profileLowDisplayName: string;
  profileHighId: string;
  profileHighDisplayName: string;
  createdByProfileId: string;
  status: string;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ListingContextResponse = {
  id: string;
  title: string;
} | null;

type LatestMessageResponse = {
  body: string;
  senderProfileId: string;
  createdAt: string;
} | null;

type MessagingTransaction = Pick<FastifyInstance["db"], "insert" | "select">;

export async function createOrGetConversation(
  app: FastifyInstance,
  currentUser: CurrentUser,
  body: CreateConversationBody
): Promise<
  | { status: "created" | "existing"; conversation: ConversationSummaryResponse }
  | { status: "invalid_listing" | "cannot_message_self" }
> {
  const listing = await getListingForConversation(app, body.listingId);

  if (!listing) {
    return { status: "invalid_listing" };
  }

  if (listing.sellerProfileId === currentUser.profile.id) {
    return { status: "cannot_message_self" };
  }

  const { profileLowId, profileHighId } = normalizeProfilePair(
    currentUser.profile.id,
    listing.sellerProfileId
  );

  const result = await app.db.transaction(async (tx) => {
    const existingConversationId = await findConversationIdForProfilePair(
      tx,
      profileLowId,
      profileHighId
    );
    const [createdConversation] = existingConversationId
      ? []
      : await tx
          .insert(conversations)
          .values({
            profileLowId,
            profileHighId,
            createdByProfileId: currentUser.profile.id
          })
          .onConflictDoNothing({
            target: [conversations.profileLowId, conversations.profileHighId]
          })
          .returning({
            id: conversations.id
          });

    const conversationId =
      existingConversationId ??
      createdConversation?.id ??
      await findConversationIdForProfilePair(tx, profileLowId, profileHighId);

    if (!conversationId) {
      throw new Error("Conversation lookup failed.");
    }

    await tx
      .insert(conversationParticipants)
      .values([
        {
          conversationId,
          profileId: currentUser.profile.id
        },
        {
          conversationId,
          profileId: listing.sellerProfileId
        }
      ])
      .onConflictDoNothing({
        target: [
          conversationParticipants.conversationId,
          conversationParticipants.profileId
        ]
      });

    await ensureConversationListingContext(
      tx,
      conversationId,
      listing.id,
      currentUser.profile.id
    );

    return {
      conversationId,
      created: !existingConversationId && Boolean(createdConversation)
    };
  });

  const conversation = await getConversationSummary(
    app,
    result.conversationId,
    currentUser.profile.id
  );

  if (!conversation) {
    throw new Error("Conversation summary lookup failed.");
  }

  return {
    status: result.created ? "created" : "existing",
    conversation
  };
}

export async function listConversationsForProfile(
  app: FastifyInstance,
  profileId: string
): Promise<ConversationSummaryResponse[]> {
  const rows = await app.db
    .select(conversationSummarySelection)
    .from(conversationParticipants)
    .innerJoin(conversations, eq(conversationParticipants.conversationId, conversations.id))
    .innerJoin(profileLowProfiles, eq(conversations.profileLowId, profileLowProfiles.id))
    .innerJoin(profileHighProfiles, eq(conversations.profileHighId, profileHighProfiles.id))
    .where(eq(conversationParticipants.profileId, profileId))
    .orderBy(desc(conversations.updatedAt));

  return Promise.all(
    rows.map(async (row) => {
      const [contextListing, latestMessage] = await Promise.all([
        getLatestListingContext(app, row.id),
        getLatestMessage(app, row.id)
      ]);

      const unreadCount = await getUnreadMessageCountForConversation(app, row.id, profileId);

      return mapConversationSummary(row, profileId, contextListing, latestMessage, unreadCount);
    })
  );
}

export async function getConversationForProfile(
  app: FastifyInstance,
  conversationId: string,
  profileId: string
): Promise<
  | { status: "ok"; conversation: ConversationSummaryResponse }
  | { status: "not_found" | "forbidden" }
> {
  const access = await getConversationAccess(app, conversationId, profileId);

  if (access.status !== "ok") {
    return access;
  }

  const conversation = await getConversationSummary(app, conversationId, profileId);

  if (!conversation) {
    return { status: "not_found" };
  }

  return {
    status: "ok",
    conversation
  };
}

export async function getConversationSummaryForProfile(
  app: FastifyInstance,
  conversationId: string,
  profileId: string
): Promise<ConversationSummaryResponse | null> {
  return getConversationSummary(app, conversationId, profileId);
}

export async function listConversationParticipantProfileIds(
  app: FastifyInstance,
  conversationId: string
): Promise<string[]> {
  const rows = await app.db
    .select({
      profileId: conversationParticipants.profileId
    })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.conversationId, conversationId));

  return rows.map((row) => row.profileId);
}

export async function getConversationNotificationContext(
  app: FastifyInstance,
  conversationId: string
): Promise<ListingContextResponse> {
  return getLatestListingContext(app, conversationId);
}

export async function listMessagesForConversation(
  app: FastifyInstance,
  currentUser: CurrentUser,
  conversationId: string
): Promise<
  | { status: "ok"; messages: MessageResponse[] }
  | { status: "not_found" | "forbidden" }
> {
  const access = await getConversationAccess(app, conversationId, currentUser.profile.id);

  if (access.status !== "ok") {
    return access;
  }

  const rows = await app.db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      senderProfileId: messages.senderProfileId,
      senderDisplayName: senderProfiles.displayName,
      body: messages.body,
      createdAt: messages.createdAt,
      deletedAt: messages.deletedAt
    })
    .from(messages)
    .innerJoin(senderProfiles, eq(messages.senderProfileId, senderProfiles.id))
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));

  return {
    status: "ok",
    messages: rows.map(mapMessage)
  };
}

export async function markConversationReadForProfile(
  app: FastifyInstance,
  currentUser: CurrentUser,
  conversationId: string
): Promise<
  | { status: "ok"; conversation: ConversationSummaryResponse; unreadConversationCount: number }
  | { status: "not_found" | "forbidden" }
> {
  const access = await getConversationAccess(app, conversationId, currentUser.profile.id);

  if (access.status !== "ok") {
    return access;
  }

  await app.db
    .update(conversationParticipants)
    .set({ lastReadAt: new Date() })
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.profileId, currentUser.profile.id)
      )
    );

  const [conversation, unreadConversationCount] = await Promise.all([
    getConversationSummary(app, conversationId, currentUser.profile.id),
    getUnreadConversationCountForProfile(app, currentUser.profile.id)
  ]);

  if (!conversation) {
    return { status: "not_found" };
  }

  return {
    status: "ok",
    conversation,
    unreadConversationCount
  };
}

export async function sendMessage(
  app: FastifyInstance,
  currentUser: CurrentUser,
  conversationId: string,
  body: SendMessageBody
): Promise<
  | { status: "sent"; message: MessageResponse }
  | { status: "not_found" | "forbidden" }
> {
  const access = await getConversationAccess(app, conversationId, currentUser.profile.id);

  if (access.status !== "ok") {
    return access;
  }

  const now = new Date();

  const createdMessage = await app.db.transaction(async (tx) => {
    const [insertedMessage] = await tx
      .insert(messages)
      .values({
        conversationId,
        senderProfileId: currentUser.profile.id,
        body: body.body,
        createdAt: now
      })
      .returning({
        id: messages.id,
        conversationId: messages.conversationId,
        senderProfileId: messages.senderProfileId,
        body: messages.body,
        createdAt: messages.createdAt,
        deletedAt: messages.deletedAt
      });

    if (!insertedMessage) {
      throw new Error("Message insert failed.");
    }

    await tx
      .update(conversations)
      .set({
        lastMessageAt: now,
        updatedAt: now
      })
      .where(eq(conversations.id, conversationId));

    return insertedMessage;
  });

  return {
    status: "sent",
    message: mapMessage({
      ...createdMessage,
      senderDisplayName: currentUser.profile.displayName
    })
  };
}

const conversationSummarySelection = {
  id: conversations.id,
  profileLowId: conversations.profileLowId,
  profileLowDisplayName: profileLowProfiles.displayName,
  profileHighId: conversations.profileHighId,
  profileHighDisplayName: profileHighProfiles.displayName,
  createdByProfileId: conversations.createdByProfileId,
  status: conversations.status,
  lastMessageAt: conversations.lastMessageAt,
  createdAt: conversations.createdAt,
  updatedAt: conversations.updatedAt
};

async function getListingForConversation(
  app: FastifyInstance,
  listingId: string
): Promise<{ id: string; sellerProfileId: string } | null> {
  const [listing] = await app.db
    .select({
      id: listings.id,
      sellerProfileId: listings.sellerProfileId
    })
    .from(listings)
    .where(and(eq(listings.id, listingId), inArray(listings.status, MESSAGEABLE_LISTING_STATUSES)))
    .limit(1);

  return listing ?? null;
}

async function findConversationIdForProfilePair(
  tx: MessagingTransaction,
  profileLowId: string,
  profileHighId: string
): Promise<string | null> {
  const [conversation] = await tx
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.profileLowId, profileLowId),
        eq(conversations.profileHighId, profileHighId)
      )
    )
    .limit(1);

  return conversation?.id ?? null;
}

async function ensureConversationListingContext(
  tx: MessagingTransaction,
  conversationId: string,
  listingId: string,
  addedByProfileId: string
): Promise<void> {
  const [existingContext] = await tx
    .select({ id: conversationListingContexts.id })
    .from(conversationListingContexts)
    .where(
      and(
        eq(conversationListingContexts.conversationId, conversationId),
        eq(conversationListingContexts.listingId, listingId)
      )
    )
    .limit(1);

  if (existingContext) {
    return;
  }

  await tx
    .insert(conversationListingContexts)
    .values({
      conversationId,
      listingId,
      addedByProfileId
    })
    .onConflictDoNothing({
      target: [
        conversationListingContexts.conversationId,
        conversationListingContexts.listingId
      ]
    });
}

async function getConversationSummary(
  app: FastifyInstance,
  conversationId: string,
  viewerProfileId: string
): Promise<ConversationSummaryResponse | null> {
  const [row] = await app.db
    .select(conversationSummarySelection)
    .from(conversations)
    .innerJoin(profileLowProfiles, eq(conversations.profileLowId, profileLowProfiles.id))
    .innerJoin(profileHighProfiles, eq(conversations.profileHighId, profileHighProfiles.id))
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!row) {
    return null;
  }

  const [contextListing, latestMessage] = await Promise.all([
    getLatestListingContext(app, conversationId),
    getLatestMessage(app, conversationId)
  ]);
  const unreadCount = await getUnreadMessageCountForConversation(app, conversationId, viewerProfileId);

  return mapConversationSummary(row, viewerProfileId, contextListing, latestMessage, unreadCount);
}

async function getLatestListingContext(
  app: FastifyInstance,
  conversationId: string
): Promise<ListingContextResponse> {
  const [row] = await app.db
    .select({
      id: listings.id,
      title: listings.title
    })
    .from(conversationListingContexts)
    .innerJoin(listings, eq(conversationListingContexts.listingId, listings.id))
    .where(eq(conversationListingContexts.conversationId, conversationId))
    .orderBy(desc(conversationListingContexts.createdAt))
    .limit(1);

  return row ?? null;
}

async function getLatestMessage(
  app: FastifyInstance,
  conversationId: string
): Promise<LatestMessageResponse> {
  const [row] = await app.db
    .select({
      body: messages.body,
      senderProfileId: messages.senderProfileId,
      createdAt: messages.createdAt
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(1);

  return row
    ? {
        body: row.body,
        senderProfileId: row.senderProfileId,
        createdAt: row.createdAt.toISOString()
      }
    : null;
}

async function getConversationAccess(
  app: FastifyInstance,
  conversationId: string,
  profileId: string
): Promise<{ status: "ok" } | { status: "not_found" | "forbidden" }> {
  const [conversation] = await app.db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!conversation) {
    return { status: "not_found" };
  }

  const [participant] = await app.db
    .select({ id: conversationParticipants.id })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.profileId, profileId)
      )
    )
    .limit(1);

  return participant ? { status: "ok" } : { status: "forbidden" };
}

export async function getUnreadConversationCountForProfile(
  app: FastifyInstance,
  profileId: string
): Promise<number> {
  const [row] = await app.db
    .select({
      count: sql<number>`count(distinct ${conversationParticipants.conversationId})::int`
    })
    .from(conversationParticipants)
    .innerJoin(messages, eq(conversationParticipants.conversationId, messages.conversationId))
    .where(
      and(
        eq(conversationParticipants.profileId, profileId),
        ne(messages.senderProfileId, profileId),
        sql`${messages.deletedAt} is null`,
        sql`(${conversationParticipants.lastReadAt} is null or ${messages.createdAt} > ${conversationParticipants.lastReadAt})`
      )
    );

  return row?.count ?? 0;
}

async function getUnreadMessageCountForConversation(
  app: FastifyInstance,
  conversationId: string,
  profileId: string
): Promise<number> {
  const [row] = await app.db
    .select({
      count: sql<number>`count(${messages.id})::int`
    })
    .from(conversationParticipants)
    .innerJoin(messages, eq(conversationParticipants.conversationId, messages.conversationId))
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.profileId, profileId),
        ne(messages.senderProfileId, profileId),
        sql`${messages.deletedAt} is null`,
        sql`(${conversationParticipants.lastReadAt} is null or ${messages.createdAt} > ${conversationParticipants.lastReadAt})`
      )
    );

  return row?.count ?? 0;
}

function normalizeProfilePair(
  firstProfileId: string,
  secondProfileId: string
): { profileLowId: string; profileHighId: string } {
  return firstProfileId < secondProfileId
    ? { profileLowId: firstProfileId, profileHighId: secondProfileId }
    : { profileLowId: secondProfileId, profileHighId: firstProfileId };
}

function mapConversationSummary(
  row: ConversationSummaryRow,
  viewerProfileId: string,
  contextListing: ListingContextResponse,
  latestMessage: LatestMessageResponse,
  unreadCount: number
): ConversationSummaryResponse {
  const otherProfile =
    row.profileLowId === viewerProfileId
      ? {
          id: row.profileHighId,
          displayName: row.profileHighDisplayName
        }
      : {
          id: row.profileLowId,
          displayName: row.profileLowDisplayName
        };

  return {
    id: row.id,
    otherProfile,
    contextListing,
    latestMessage,
    unreadCount,
    status: row.status,
    lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function mapMessage(row: {
  id: string;
  conversationId: string;
  senderProfileId: string;
  senderDisplayName: string;
  body: string;
  createdAt: Date;
  deletedAt: Date | null;
}): MessageResponse {
  return {
    id: row.id,
    conversationId: row.conversationId,
    sender: {
      id: row.senderProfileId,
      displayName: row.senderDisplayName
    },
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null
  };
}
