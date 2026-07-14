import type { ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import { resolveShortLink } from "../services/short-links.service.js";

type ShareLinkResolveParams = {
  code: string;
};

type ShareLinkResolveResponse = ApiResponse<{
  targetPath: string;
}>;

export function registerShareLinkRoutes(app: FastifyInstance): void {
  app.get<{ Params: ShareLinkResolveParams; Reply: ShareLinkResolveResponse }>(
    "/share-links/:code/resolve",
    async (request, reply) => {
      const result = await resolveShortLink(app.db, request.params.code);

      if (result.status === "not_found") {
        return reply.status(404).send({
          ok: false,
          error: {
            code: "SHORT_LINK_NOT_FOUND",
            message: "Short link was not found."
          }
        });
      }

      return reply.send({
        ok: true,
        data: {
          targetPath: result.targetPath
        }
      });
    }
  );
}
