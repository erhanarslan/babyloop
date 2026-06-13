import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import {
  childProfileParamsSchema,
  createChildProfileBodySchema,
  updateChildProfileBodySchema
} from "../schemas/child-profiles.schemas.js";
import { requireCurrentUser } from "../services/auth-context.service.js";
import {
  createChildProfile,
  deleteChildProfile,
  listChildProfiles,
  listLifecycleRecommendations,
  type ChildProfileResponse,
  type LifecycleRecommendationResponse,
  updateChildProfile
} from "../services/child-profiles.service.js";

type ChildProfilesResponse = ApiResponse<{
  childProfiles: ChildProfileResponse[];
}>;

type ChildProfileResponseBody = ApiResponse<{
  childProfile: ChildProfileResponse;
}>;

type LifecycleRecommendationsResponse = ApiResponse<{
  groups: LifecycleRecommendationResponse[];
}>;

type DeleteChildProfileResponse = ApiResponse<{
  deleted: true;
}>;

export function registerChildProfileRoutes(app: FastifyInstance): void {
  app.get<{ Reply: ChildProfilesResponse | ApiFailure }>("/child-profiles", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    return {
      ok: true,
      data: {
        childProfiles: await listChildProfiles(app, currentUser.profile.id)
      }
    };
  });

  app.post<{ Body: unknown; Reply: ChildProfileResponseBody | ApiFailure }>(
    "/child-profiles",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedBody = createChildProfileBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send(invalidChildProfileRequest());
      }

      return reply.status(201).send({
        ok: true,
        data: {
          childProfile: await createChildProfile(app, currentUser.profile.id, parsedBody.data)
        }
      });
    }
  );

  app.get<{ Reply: LifecycleRecommendationsResponse | ApiFailure }>(
    "/child-profiles/lifecycle-recommendations",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      return {
        ok: true,
        data: {
          groups: await listLifecycleRecommendations(app, currentUser.profile.id)
        }
      };
    }
  );

  app.patch<{
    Params: unknown;
    Body: unknown;
    Reply: ChildProfileResponseBody | ApiFailure;
  }>("/child-profiles/:childProfileId", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    const parsedParams = childProfileParamsSchema.safeParse(request.params);
    const parsedBody = updateChildProfileBodySchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      return reply.status(400).send(invalidChildProfileRequest());
    }

    const result = await updateChildProfile(
      app,
      currentUser.profile.id,
      parsedParams.data.childProfileId,
      parsedBody.data
    );

    if (result.status === "not_found") {
      return reply.status(404).send(childProfileNotFound());
    }

    return {
      ok: true,
      data: {
        childProfile: result.childProfile
      }
    };
  });

  app.delete<{
    Params: unknown;
    Reply: DeleteChildProfileResponse | ApiFailure;
  }>("/child-profiles/:childProfileId", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    const parsedParams = childProfileParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send(invalidChildProfileRequest());
    }

    const result = await deleteChildProfile(
      app,
      currentUser.profile.id,
      parsedParams.data.childProfileId
    );

    if (result === "not_found") {
      return reply.status(404).send(childProfileNotFound());
    }

    return {
      ok: true,
      data: {
        deleted: true
      }
    };
  });
}

function invalidChildProfileRequest(): ApiFailure {
  return {
    ok: false,
    error: {
      code: "INVALID_CHILD_PROFILE_REQUEST",
      message: "Child profile request is invalid."
    }
  };
}

function childProfileNotFound(): ApiFailure {
  return {
    ok: false,
    error: {
      code: "CHILD_PROFILE_NOT_FOUND",
      message: "Child profile was not found."
    }
  };
}
