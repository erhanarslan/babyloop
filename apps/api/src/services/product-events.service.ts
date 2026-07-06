import { events } from "@babyloop/database/schema";
import type { FastifyInstance } from "fastify";
import type { ProductEventBody } from "../schemas/product-events.schemas.js";

type SafeProductEventMetadataValue = string | number;
type SafeProductEventMetadata = Record<string, SafeProductEventMetadataValue>;

function isSafeProductEventMetadataValue(value: unknown): value is SafeProductEventMetadataValue {
  return typeof value === "string" || typeof value === "number";
}

function setDefinedProductEventMetadataValue(
  target: SafeProductEventMetadata,
  key: string | undefined,
  value: unknown
): void {
  if (typeof key !== "string" || key.length === 0) {
    return;
  }

  if (!isSafeProductEventMetadataValue(value)) {
    return;
  }

  target[key] = value;
}

export type RecordProductEventInput = ProductEventBody & {
  actorProfileId?: string;
};

export type RecordedProductEvent = {
  id: string;
};

const PRODUCT_EVENT_PREFIX = "product_";
const SEARCH_EVENT_ENTITY_ID = "00000000-0000-0000-0000-000000000000";

export async function recordProductEvent(
  app: FastifyInstance,
  input: RecordProductEventInput
): Promise<RecordedProductEvent> {
  const entity = resolveProductEventEntity(input);
  const metadata = buildProductEventMetadata(input);

  const [createdEvent] = await app.db
    .insert(events)
    .values({
      ...(input.actorProfileId ? { actorProfileId: input.actorProfileId } : {}),
      entityId: entity.id,
      entityType: entity.type,
      eventType: `${PRODUCT_EVENT_PREFIX}${input.eventType}`,
      metadata
    })
    .returning({
      id: events.id
    });

  if (!createdEvent) {
    throw new Error("Product event could not be recorded.");
  }

  return {
    id: createdEvent.id
  };
}

function resolveProductEventEntity(input: RecordProductEventInput): {
  id: string;
  type: "listing" | "category" | "conversation" | "search";
} {
  if ("listingId" in input && typeof input.listingId === "string" && input.listingId.length > 0) {
    return {
      id: input.listingId,
      type: "listing"
    };
  }

  if (
    input.eventType === "category_viewed" &&
    "categoryId" in input &&
    typeof input.categoryId === "string" &&
    input.categoryId.length > 0
  ) {
    return {
      id: input.categoryId,
      type: "category"
    };
  }

  if ("conversationId" in input && typeof input.conversationId === "string" && input.conversationId.length > 0) {
    return {
      id: input.conversationId,
      type: "conversation"
    };
  }

  return {
    id: SEARCH_EVENT_ENTITY_ID,
    type: "search"
  };
}

function buildProductEventMetadata(input: RecordProductEventInput): SafeProductEventMetadata {
  const metadata: SafeProductEventMetadata = {};

  if ("listingId" in input) {
    setDefinedProductEventMetadataValue(metadata, "listingId", input.listingId);
  }

  if ("categoryId" in input) {
    setDefinedProductEventMetadataValue(metadata, "categoryId", input.categoryId);
  }

  if ("savedSearchId" in input) {
    setDefinedProductEventMetadataValue(metadata, "savedSearchId", input.savedSearchId);
  }

  if ("conversationId" in input) {
    setDefinedProductEventMetadataValue(metadata, "conversationId", input.conversationId);
  }

  if ("city" in input) {
    setDefinedProductEventMetadataValue(metadata, "city", input.city);
  }

  if ("status" in input) {
    setDefinedProductEventMetadataValue(metadata, "status", input.status);
  }

  if ("sort" in input) {
    setDefinedProductEventMetadataValue(metadata, "sort", input.sort);
  }

  if ("listingType" in input) {
    setDefinedProductEventMetadataValue(metadata, "listingType", input.listingType);
  }

  if ("condition" in input) {
    setDefinedProductEventMetadataValue(metadata, "condition", input.condition);
  }

  if ("limit" in input) {
    setDefinedProductEventMetadataValue(metadata, "limit", input.limit);
  }

  if ("offset" in input) {
    setDefinedProductEventMetadataValue(metadata, "offset", input.offset);
  }

  if ("source" in input) {
    setDefinedProductEventMetadataValue(metadata, "source", input.source);
  }

  if (input.eventType === "search_performed") {
    setDefinedProductEventMetadataValue(metadata, "queryLength", input.queryLength);

    if (typeof input.resultCount === "number") {
      setDefinedProductEventMetadataValue(metadata, "resultCount", input.resultCount);
      setDefinedProductEventMetadataValue(metadata, "resultBucket", buildResultBucket(input.resultCount));
    }
  }

  return metadata;
}

function buildResultBucket(resultCount: number): string {
  if (resultCount === 0) {
    return "0";
  }

  if (resultCount <= 5) {
    return "1-5";
  }

  if (resultCount <= 20) {
    return "6-20";
  }

  if (resultCount <= 100) {
    return "21-100";
  }

  return "100+";
}
