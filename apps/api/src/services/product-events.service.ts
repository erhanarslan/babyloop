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

export async function recordProductEvent(
  app: FastifyInstance,
  input: RecordProductEventInput
): Promise<RecordedProductEvent> {
  const metadata = buildProductEventMetadata(input);

  const [createdEvent] = await app.db
    .insert(events)
    .values({
      ...(input.actorProfileId ? { actorProfileId: input.actorProfileId } : {}),
      entityId: input.listingId,
      entityType: "listing",
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

function buildProductEventMetadata(
  input: RecordProductEventInput
): Record<string, string> {
  const metadata: Record<string, string> = {
    listingId: input.listingId
  };

  if (input.categoryId) {
    metadata.categoryId = input.categoryId;
  }

  if (input.source) {
    metadata.source = input.source;
  }

  return metadata;
}
