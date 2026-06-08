import type { FastifyInstance } from "fastify";
import { listingUploadParamsSchema } from "../schemas/listings.schemas.js";
import { resolveStoredListingImage } from "../services/local-image-storage.service.js";

type UploadRouteOptions = {
  uploadRoot: string;
};

type ListingUploadParams = {
  filename: string;
  listingId: string;
};

export function registerUploadRoutes(
  app: FastifyInstance,
  options: UploadRouteOptions
): void {
  app.get<{ Params: ListingUploadParams }>(
    "/uploads/listings/:listingId/:filename",
    async (request, reply) => {
      const parsedParams = listingUploadParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(404).send({
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "Uploaded image was not found."
          }
        });
      }

      const image = await resolveStoredListingImage({
        filename: parsedParams.data.filename,
        listingId: parsedParams.data.listingId,
        uploadRoot: options.uploadRoot
      });

      if (!image) {
        return reply.status(404).send({
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "Uploaded image was not found."
          }
        });
      }

      reply.header("Content-Type", image.contentType);
      reply.header("Cache-Control", "public, max-age=31536000, immutable");
      reply.header("X-Content-Type-Options", "nosniff");

      return reply.send(image.stream);
    }
  );
}
