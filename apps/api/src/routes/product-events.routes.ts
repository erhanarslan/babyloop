import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { CurrentUser } from "../plugins/auth.plugin.js";
import { productEventBodySchema } from "../schemas/product-events.schemas.js";
import { recordProductEvent } from "../services/product-events.service.js";

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

      return {
        ok: true,
        data: {
          event
        }
      };
    }
  );
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
