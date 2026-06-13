import { events } from "@babyloop/database/schema";
import type { FastifyInstance } from "fastify";
import type { ProductEventBody } from "../schemas/product-events.schemas.js";

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
  type: "listing" | "category" | "search";
} {
  if ("listingId" in input) {
    return {
      id: input.listingId,
      type: "listing"
    };
  }

  if (input.eventType === "category_viewed") {
    return {
      id: input.categoryId,
      type: "category"
    };
  }

  return {
    id: SEARCH_EVENT_ENTITY_ID,
    type: "search"
  };
}

function buildProductEventMetadata(
  input: RecordProductEventInput
): Record<string, number | string> {
  const metadata: Record<string, number | string> = {};

  if ("listingId" in input) {
    metadata.listingId = input.listingId;
  }

  if ("categoryId" in input && input.categoryId) {
    metadata.categoryId = input.categoryId;
  }

  if (input.source) {
    metadata.source = input.source;
  }

  if (input.eventType === "search_performed") {
    metadata.queryLength = input.queryLength;

    if (typeof input.resultCount === "number") {
      metadata.resultCount = input.resultCount;
      metadata.resultBucket = buildResultBucket(input.resultCount);
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
