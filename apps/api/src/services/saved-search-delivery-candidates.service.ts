import type { FastifyInstance } from "fastify";
import {
  buildNotificationDeliveryLogRecord,
  canWriteNotificationDeliveryCandidateLog,
  createNotificationDeliveryCandidateLog,
  type NotificationDeliveryLogRecord
} from "./notification-delivery-log.service.js";
import {
  evaluateNotificationDeliveryPolicy,
  type NotificationDeliveryChannel,
  type NotificationDeliveryPolicyInput
} from "./notification-delivery-policy.service.js";

export type SavedSearchDeliverySavedSearchInput = {
  id: string;
  name?: string | null;
  queryText?: string | null;
  categoryId?: string | null;
  listingType?: string | null;
  condition?: string | null;
  priceMin?: string | null;
  priceMax?: string | null;
  hasImages?: boolean;
};

export type SavedSearchDeliveryListingInput = {
  id: string;
  categoryId?: string | null;
  categoryName?: string | null;
  title?: string | null;
  priceAmount?: string | null;
  currency?: string | null;
  listingType?: string | null;
  condition?: string | null;
};

export type SavedSearchDeliveryCandidate = {
  kind: "saved_search";
  sourceType: "saved_search";
  sourceId: string;
  profileId: string;
  savedSearchId: string;
  listingId: string;
  channel: NotificationDeliveryChannel;
  actionHref: string;
  status: "candidate" | "blocked";
  deliveryAllowed: false;
  draftOnly: true;
  canWriteLog: boolean;
  blockedReason: "frequency_window_active" | null;
  log: NotificationDeliveryLogRecord;
  note: "Bu kayıt saved-search eşleşmesi için delivery candidate üretir; email, push veya n8n gönderimi yapmaz.";
};

export type BuildSavedSearchDeliveryCandidateInput = {
  profileId: string;
  savedSearch: SavedSearchDeliverySavedSearchInput;
  listing: SavedSearchDeliveryListingInput;
  channel?: Extract<NotificationDeliveryChannel, "in_app" | "email_draft">;
  lastCandidateCreatedAt?: Date | string | null;
  now?: Date;
};

export type CreateSavedSearchDeliveryCandidateLogResult =
  | {
      status: "blocked";
      reason: "frequency_window_active";
      idempotencyKey: string;
    }
  | {
      status: "created" | "duplicate";
      idempotencyKey: string;
    };

export function buildSavedSearchDeliveryPolicyInput(
  input: Pick<BuildSavedSearchDeliveryCandidateInput, "profileId" | "savedSearch" | "listing" | "channel">
): NotificationDeliveryPolicyInput {
  const channel = input.channel ?? "in_app";

  return {
    profileId: input.profileId,
    kind: "saved_search",
    sourceType: "saved_search",
    sourceId: buildSavedSearchDeliverySourceId(input.savedSearch.id, input.listing.id),
    channel,
    actionHref: buildSavedSearchActionHref(input.savedSearch.id, input.listing.id)
  };
}

export function buildSavedSearchDeliveryCandidate(
  input: BuildSavedSearchDeliveryCandidateInput
): SavedSearchDeliveryCandidate {
  const policyInput = buildSavedSearchDeliveryPolicyInput(input);
  const policy = evaluateNotificationDeliveryPolicy(policyInput);
  const frequencyWindowInput: Parameters<typeof canWriteNotificationDeliveryCandidateLog>[0] = {
    frequencyWindowHours: policy.frequencyWindowHours
  };

  if (input.lastCandidateCreatedAt !== undefined) {
    frequencyWindowInput.lastLogCreatedAt = input.lastCandidateCreatedAt;
  }

  if (input.now !== undefined) {
    frequencyWindowInput.now = input.now;
  }

  const decision = canWriteNotificationDeliveryCandidateLog(frequencyWindowInput);
  const status = decision.canWrite ? "candidate" : "blocked";

  const logInput: Parameters<typeof buildNotificationDeliveryLogRecord>[0] = {
    profileId: input.profileId,
    policyInput,
    policy,
    status,
    metadata: {
      savedSearchId: input.savedSearch.id,
      listingId: input.listing.id,
      categoryId: input.listing.categoryId ?? input.savedSearch.categoryId ?? null,
      categoryName: input.listing.categoryName ?? null,
      listingType: input.listing.listingType ?? input.savedSearch.listingType ?? null,
      condition: input.listing.condition ?? input.savedSearch.condition ?? null,
      priceAmount: input.listing.priceAmount ?? null,
      currency: input.listing.currency ?? null,
      hasImages: input.savedSearch.hasImages ?? false,
      actionHref: policyInput.actionHref,
      savedSearchLabel: safeDeliveryText(input.savedSearch.name, "Kaydedilmiş arama", 120),
      listingLabel: safeDeliveryText(input.listing.title, "İlan", 160)
    }
  };

  if (input.now !== undefined) {
    logInput.now = input.now;
  }

  return {
    kind: "saved_search",
    sourceType: "saved_search",
    sourceId: policyInput.sourceId,
    profileId: input.profileId,
    savedSearchId: input.savedSearch.id,
    listingId: input.listing.id,
    channel: policyInput.channel,
    actionHref: policyInput.actionHref,
    status,
    deliveryAllowed: false,
    draftOnly: true,
    canWriteLog: decision.canWrite,
    blockedReason: decision.reason,
    log: buildNotificationDeliveryLogRecord(logInput),
    note: "Bu kayıt saved-search eşleşmesi için delivery candidate üretir; email, push veya n8n gönderimi yapmaz."
  };
}

export async function createSavedSearchDeliveryCandidateLog(
  app: FastifyInstance,
  input: BuildSavedSearchDeliveryCandidateInput
): Promise<CreateSavedSearchDeliveryCandidateLogResult> {
  const candidate = buildSavedSearchDeliveryCandidate(input);

  if (!candidate.canWriteLog) {
    return {
      status: "blocked",
      reason: "frequency_window_active",
      idempotencyKey: candidate.log.idempotencyKey
    };
  }

  const policyInput = buildSavedSearchDeliveryPolicyInput(input);
  const createInput: Parameters<typeof createNotificationDeliveryCandidateLog>[1] = {
    profileId: input.profileId,
    policyInput,
    policy: evaluateNotificationDeliveryPolicy(policyInput),
    metadata: candidate.log.metadata
  };

  if (input.now !== undefined) {
    createInput.now = input.now;
  }

  const result = await createNotificationDeliveryCandidateLog(app, createInput);

  return {
    status: result.created ? "created" : "duplicate",
    idempotencyKey: result.idempotencyKey
  };
}

export function buildSavedSearchDeliverySourceId(savedSearchId: string, listingId: string): string {
  return `${savedSearchId}:${listingId}`;
}

function buildSavedSearchActionHref(savedSearchId: string, listingId: string): string {
  const params = new URLSearchParams({
    savedSearchId
  });

  return `/listings/${encodeURIComponent(listingId)}?${params.toString()}`;
}

function safeDeliveryText(value: string | null | undefined, fallback: string, maxLength: number): string {
  const normalized = typeof value === "string" ? value.trim() : "";

  if (normalized.length === 0) {
    return fallback;
  }

  return normalized
    .replace(/[\u0000-\u001F\u007F]/gu, " ")
    .replace(/<[^>]*>/gu, "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[redacted-email]")
    .replace(/\b(?:accessToken|refreshToken|passwordHash|otpCode|authorization|cookie|set-cookie)\b/giu, "[redacted-secret]")
    .replace(/\s+/gu, " ")
    .slice(0, maxLength);
}
