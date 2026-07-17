import type { AnalyticsEventName, ApiFailure, ApiResponse } from "@babyloop/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { CurrentUser } from "../plugins/auth.plugin.js";
import { productEventBodySchema, type ProductEventBody } from "../schemas/product-events.schemas.js";
import { recordProductEvent } from "../services/product-events.service.js";
import { trackServerAnalyticsEvent } from "../services/product-analytics.service.js";

type ProductEventResponse = ApiResponse<{
  event: {
    id: string;
  };
}>;

export function registerProductEventRoutes(app: FastifyInstance): void {
  app.post<{ Body: unknown; Reply: ProductEventResponse | ApiFailure }>(
    "/product-events",
    async (request, reply) => {
      const parsedBody = productEventBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send(invalidRequest("Product event body is invalid."));
      }

      const currentUser = await getOptionalCurrentUser(app, request);
      const event = await recordProductEvent(app, {
        ...(currentUser ? { actorProfileId: currentUser.profile.id } : {}),
        ...parsedBody.data
      });
      void trackProductEventAnalyticsBridge(app, parsedBody.data, currentUser);

      return {
        ok: true,
        data: {
          event
        }
      };
    }
  );
}

async function trackProductEventAnalyticsBridge(
  app: FastifyInstance,
  input: ProductEventBody,
  currentUser: CurrentUser | null
): Promise<void> {
  const mappedEventName = mapLegacyProductEventName(input.eventType);

  if (!mappedEventName) {
    return;
  }

  const properties: Record<string, string | number | boolean | null> = {
    sourceSurface: "source" in input && input.source ? input.source : "legacy_product_events"
  };

  if ("listingId" in input && typeof input.listingId === "string") {
    properties.listingId = input.listingId;
  }

  if ("categoryId" in input && input.categoryId) {
    properties.categoryId = input.categoryId;
  }

  if ("conversationId" in input && input.conversationId) {
    properties.conversationId = input.conversationId;
  }

  if (input.eventType === "search_performed") {
    properties.queryLengthBucket = bucketCount(input.queryLength);

    if (typeof input.resultCount === "number") {
      properties.resultCountBucket = bucketCount(input.resultCount);
    }
  }

  await trackServerAnalyticsEvent(app, {
    anonymousId: currentUser ? `user-${currentUser.userId}` : "legacy-product-events-anonymous",
    eventName: mappedEventName,
    platform: "web",
    profileId: currentUser?.profile.id ?? null,
    properties,
    sessionId: currentUser?.sessionId ?? "legacy-product-events",
    userId: currentUser?.userId ?? null
  });
}

function mapLegacyProductEventName(eventType: ProductEventBody["eventType"]): AnalyticsEventName | null {
  switch (eventType) {
    case "listing_detail_viewed":
    case "listing_card_clicked":
    case "recently_viewed_listing_clicked":
      return "listing_opened";
    case "listing_recommendation_impression":
      return "listing_impression";
    case "contact_seller_intent":
      return "seller_contact_clicked";
    case "category_viewed":
      return "category_viewed";
    case "search_performed":
      return "search_submitted";
    case "favorite_added":
      return "listing_favorited";
    case "favorite_removed":
      return "listing_unfavorited";
    case "saved_search_created":
      return "saved_search_created";
    case "listing_updated":
      return "listing_updated";
    case "listing_status_changed":
      return "listing_status_changed";
    case "message_sent":
      return "message_sent";
    default:
      return null;
  }
}

function bucketCount(value: number): string {
  if (value === 0) {
    return "0";
  }

  if (value <= 5) {
    return "1-5";
  }

  if (value <= 20) {
    return "6-20";
  }

  if (value <= 100) {
    return "21-100";
  }

  return "100+";
}

async function getOptionalCurrentUser(
  app: FastifyInstance,
  request: FastifyRequest
): Promise<CurrentUser | null> {
  if (typeof app.authenticate !== "function") {
    return null;
  }

  try {
    return await app.authenticate(request);
  } catch {
    return null;
  }
}

function invalidRequest(message: string): ApiFailure {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message
    }
  };
}
