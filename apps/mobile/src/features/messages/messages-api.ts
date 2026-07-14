import { isRecord } from "../../api/client";
import { mobileAuthFetch } from "../auth/auth-api";

export type MobileConversationSummary = {
  id: string;
  title: string;
  subtitle: string;
  latestMessageText: string;
  unreadCount: number;
  updatedAt: string | null;
};


export type MobileConversationDetail = MobileConversationSummary & {
  listingId: string | null;
  listingTitle: string | null;
  listingStatus?: string | null;
  otherProfileDisplayName: string | null;
};

export type MobileConversationMessage = {
  id: string;
  body: string;
  createdAt: string | null;
  senderProfileId: string | null;
  senderDisplayName: string | null;
};

type ApiConversationList = {
  conversations?: unknown;
  items?: unknown;
};

export async function fetchMobileConversations(): Promise<MobileConversationSummary[]> {
  const response = await mobileAuthFetch("/api/v1/conversations");
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message = extractApiError(payload);
    throw new Error(message ?? "Mesajlar şu an yüklenemedi.");
  }

  const data = unwrapApiData<ApiConversationList | unknown[]>(payload);
  const rawConversations = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data.conversations)
      ? data.conversations
      : isRecord(data) && Array.isArray(data.items)
        ? data.items
        : [];

  return rawConversations.map(normalizeConversation).filter(isConversationSummary);
}


export async function startMobileConversationForListing(
  listingId: string
): Promise<MobileConversationDetail> {
  const response = await mobileAuthFetch("/api/v1/conversations", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      listingId
    })
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message = extractApiError(payload);
    throw new Error(message ?? "Konuşma başlatılamadı.");
  }

  return normalizeConversationDetail(extractConversationObject(unwrapApiData(payload)));
}


export async function fetchMobileConversationDetail(
  conversationId: string
): Promise<MobileConversationDetail> {
  const response = await mobileAuthFetch(`/api/v1/conversations/${encodeURIComponent(conversationId)}`);
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message = extractApiError(payload);
    throw new Error(message ?? "Konuşma detayı yüklenemedi.");
  }

  return normalizeConversationDetail(extractConversationObject(unwrapApiData(payload)));
}

export async function fetchMobileConversationMessages(
  conversationId: string
): Promise<MobileConversationMessage[]> {
  const response = await mobileAuthFetch(
    `/api/v1/conversations/${encodeURIComponent(conversationId)}/messages`
  );
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message = extractApiError(payload);
    throw new Error(message ?? "Mesajlar yüklenemedi.");
  }

  const data = unwrapApiData<unknown>(payload);
  const rawMessages = extractMessageArray(data);

  return rawMessages.map(normalizeMessage).filter(isConversationMessage);
}

export async function sendMobileConversationMessage(
  conversationId: string,
  body: string
): Promise<MobileConversationMessage> {
  const response = await mobileAuthFetch(
    `/api/v1/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        body
      })
    }
  );
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message = extractApiError(payload);
    throw new Error(message ?? "Mesaj gönderilemedi.");
  }

  return normalizeMessage(extractMessageObject(unwrapApiData(payload))) ?? {
    id: `local-${Date.now()}`,
    body,
    createdAt: new Date().toISOString(),
    senderProfileId: null,
    senderDisplayName: null
  };
}


function extractConversationObject(payload: unknown): unknown {
  if (isRecord(payload) && isRecord(payload.conversation)) {
    return payload.conversation;
  }

  if (isRecord(payload) && isRecord(payload.data)) {
    return extractConversationObject(payload.data);
  }

  return payload;
}

function extractMessageArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.messages)) {
    return payload.messages;
  }

  if (Array.isArray(payload.items)) {
    return payload.items;
  }

  if (isRecord(payload.data)) {
    return extractMessageArray(payload.data);
  }

  return [];
}

function extractMessageObject(payload: unknown): unknown {
  if (isRecord(payload) && isRecord(payload.message)) {
    return payload.message;
  }

  if (isRecord(payload) && isRecord(payload.data)) {
    return extractMessageObject(payload.data);
  }

  return payload;
}

function normalizeConversationDetail(value: unknown): MobileConversationDetail {
  const record = isRecord(value) ? value : {};
  const summary = normalizeConversation(record) ?? {
    id: pickString(record, ["id", "conversationId"]) ?? "conversation",
    title: "Konuşma",
    subtitle: "BabyLoop mesajlaşma",
    latestMessageText: "Henüz mesaj yok.",
    unreadCount: 0,
    updatedAt: getStringDate(record.updatedAt) ?? getStringDate(record.createdAt)
  };

  const contextListing = isRecord(record.contextListing) ? record.contextListing : null;
  const listing = isRecord(record.listing) ? record.listing : contextListing;
  const otherProfile = isRecord(record.otherProfile) ? record.otherProfile : null;

  return {
    ...summary,
    listingId: pickString(record, ["listingId"]) ?? pickString(listing ?? {}, ["id", "listingId"]),
    listingTitle: pickString(listing ?? {}, ["title", "name"]),
    listingStatus: pickString(listing ?? {}, ["status"]),
    otherProfileDisplayName: pickString(otherProfile ?? {}, ["displayName", "name"])
  };
}

function normalizeMessage(value: unknown): MobileConversationMessage | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = pickString(value, ["id", "messageId"]);
  const body = pickString(value, ["body", "text", "content", "message"]);
  const senderProfile = isRecord(value.senderProfile) ? value.senderProfile : null;
  const sender = isRecord(value.sender) ? value.sender : senderProfile;

  if (!id || !body) {
    return null;
  }

  return {
    id,
    body,
    createdAt: getStringDate(value.createdAt) ?? getStringDate(value.created_at),
    senderProfileId:
      pickString(value, ["senderProfileId", "profileId", "senderId"]) ??
      pickString(sender ?? {}, ["id", "profileId"]),
    senderDisplayName: pickString(sender ?? {}, ["displayName", "name"])
  };
}

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function isConversationMessage(value: MobileConversationMessage | null): value is MobileConversationMessage {
  return value !== null;
}

function normalizeConversation(value: unknown): MobileConversationSummary | null {
  if (!isRecord(value) || typeof value.id !== "string") {
    return null;
  }

  const contextListing = isRecord(value.contextListing) ? value.contextListing : null;
  const otherProfile = isRecord(value.otherProfile) ? value.otherProfile : null;
  const latestMessage = isRecord(value.latestMessage) ? value.latestMessage : null;

  const listingTitle = typeof contextListing?.title === "string" ? contextListing.title.trim() : "";
  const displayName = typeof otherProfile?.displayName === "string" ? otherProfile.displayName.trim() : "";
  const latestBody = typeof latestMessage?.body === "string" ? latestMessage.body.trim() : "";
  const unreadCount =
    typeof value.unreadCount === "number" && Number.isFinite(value.unreadCount)
      ? Math.max(0, value.unreadCount)
      : 0;

  return {
    id: value.id,
    title: listingTitle || displayName || "Konuşma",
    subtitle: listingTitle && displayName ? displayName : "BabyLoop mesajlaşma",
    latestMessageText: latestBody || "Henüz mesaj yok.",
    unreadCount,
    updatedAt: getStringDate(value.lastMessageAt) ?? getStringDate(value.updatedAt) ?? getStringDate(value.createdAt)
  };
}

function unwrapApiData<T>(payload: unknown): T {
  if (isRecord(payload) && "data" in payload) {
    return payload.data as T;
  }

  return payload as T;
}

function extractApiError(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  if (typeof payload.error === "string") {
    return payload.error;
  }

  if (isRecord(payload.error) && typeof payload.error.message === "string") {
    return payload.error.message;
  }

  return null;
}

function getStringDate(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function isConversationSummary(value: MobileConversationSummary | null): value is MobileConversationSummary {
  return value !== null;
}
