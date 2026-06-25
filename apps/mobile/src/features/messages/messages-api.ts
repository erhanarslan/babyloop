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
