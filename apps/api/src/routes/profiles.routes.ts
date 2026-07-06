import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  getPublicSellerProfileSummary,
  type PublicSellerProfileSummary
} from "../services/public-profiles.service.js";

type ProfileParams = {
  profileId: string;
};

type PublicProfileResponse = ApiResponse<{
  profile: PublicSellerProfileSummary;
}>;

const profileParamsSchema = z
  .object({
    profileId: z.string().uuid()
  })
  .strict();

export function registerProfileRoutes(app: FastifyInstance): void {
  app.get<{ Params: ProfileParams; Reply: PublicProfileResponse | ApiFailure }>(
    "/profiles/:profileId",
    async (request, reply) => {
      const parsedParams = profileParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "INVALID_PROFILE_REQUEST",
            message: "Profile id must be a valid UUID."
          }
        });
      }

      const profile = await getPublicSellerProfileSummary(app, parsedParams.data.profileId);

      if (!profile) {
        return reply.status(404).send({
          ok: false,
          error: {
            code: "PROFILE_NOT_FOUND",
            message: "Profile was not found."
          }
        });
      }

      return {
        ok: true,
        data: {
          profile
        }
      };
    }
  );
}
