import {
  conversationParticipants,
  conversations,
  listings,
  messages,
  profiles
} from "@babyloop/database/schema";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { CurrentUser } from "../plugins/auth.plugin.js";
import type {
  CreateConversationBody,
  SendMessageBody
} from "../schemas/messaging.schemas.js";

const buyerProfiles = alias(profiles, "buyer_profiles");
const sellerProfiles = alias(profiles, "seller_profiles");
const senderProfiles = alias(profiles, "sender_profiles");

export type ConversationSummaryResponse = {
  id: string;
  listing: {
    id: string;
    title: string;
  };
  buyer: {
    id: string;
    displayName: string;
  };
  seller: {
    id: string;
    displayName: string;
  };
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
  listingId: string;
  listingTitle: string;
  buyerProfileId: string;
  buyerDisplayName: string;
  sellerProfileId: string;
  sellerDisplayName: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function createOrGetConversation(
  app: FastifyInstance,
  currentUser: CurrentUser,
  body: CreateConversationBody
): Promise<
  | { status: "created" | "existing"; conversation: ConversationSummaryResponse }
  | { status: "invalid_listing" | "cannot_message_self" }
> {
  const listing = await getListingForConversation(app, body.listing_id);

  if (!listing) {
    return { status: "invalid_listing" };
  }

  if (listing.sellerProfileId === currentUser.profile.id) {
    return { status: "cannot_message_self" };
  }

  const result = await app.db.transaction(async (tx) => {
    const [createdConversation] = await tx
      .insert(conversations)
      .values({
        listingId: listing.id,
        buyerProfileId: currentUser.profile.id
      })
      .onConflictDoNothing({
        target: [conversations.listingId, conversations.buyerProfileId]
      })
      .returning({
        id: conversations.id
      });

    const conversationId = createdConversation?.id
      ?? (await tx
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.listingId, listing.id),
            eq(conversations.buyerProfileId, currentUser.profile.id)
          )
        )
        .limit(1))[0]?.id;

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

    return {
      conversationId,
      created: Boolean(createdConversation)
    };
  });

  const conversation = await getConversationSummary(app, result.conversationId);

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
    .innerJoin(listings, eq(conversations.listingId, listings.id))
    .innerJoin(buyerProfiles, eq(conversations.buyerProfileId, buyerProfiles.id))
    .innerJoin(sellerProfiles, eq(listings.sellerProfileId, sellerProfiles.id))
    .where(eq(conversationParticipants.profileId, profileId))
    .orderBy(desc(conversations.updatedAt));

  return rows.map(mapConversationSummary);
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

  const [createdMessage] = await app.db
    .insert(messages)
    .values({
      conversationId,
      senderProfileId: currentUser.profile.id,
      body: body.body
    })
    .returning({
      id: messages.id,
      conversationId: messages.conversationId,
      senderProfileId: messages.senderProfileId,
      body: messages.body,
      createdAt: messages.createdAt,
      deletedAt: messages.deletedAt
    });

  if (!createdMessage) {
    throw new Error("Message insert failed.");
  }

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
  listingId: listings.id,
  listingTitle: listings.title,
  buyerProfileId: buyerProfiles.id,
  buyerDisplayName: buyerProfiles.displayName,
  sellerProfileId: sellerProfiles.id,
  sellerDisplayName: sellerProfiles.displayName,
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
    .where(eq(listings.id, listingId))
    .limit(1);

  return listing ?? null;
}

async function getConversationSummary(
  app: FastifyInstance,
  conversationId: string
): Promise<ConversationSummaryResponse | null> {
  const [row] = await app.db
    .select(conversationSummarySelection)
    .from(conversations)
    .innerJoin(listings, eq(conversations.listingId, listings.id))
    .innerJoin(buyerProfiles, eq(conversations.buyerProfileId, buyerProfiles.id))
    .innerJoin(sellerProfiles, eq(listings.sellerProfileId, sellerProfiles.id))
    .where(eq(conversations.id, conversationId))
    .limit(1);

  return row ? mapConversationSummary(row) : null;
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

function mapConversationSummary(row: ConversationSummaryRow): ConversationSummaryResponse {
  return {
    id: row.id,
    listing: {
      id: row.listingId,
      title: row.listingTitle
    },
    buyer: {
      id: row.buyerProfileId,
      displayName: row.buyerDisplayName
    },
    seller: {
      id: row.sellerProfileId,
      displayName: row.sellerDisplayName
    },
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
