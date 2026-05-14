import type { ApiFailure } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";

const databaseUnavailableResponse: ApiFailure = {
  ok: false,
  error: {
    code: "DATABASE_UNAVAILABLE",
    message: "Database is unavailable. Set DATABASE_URL to enable marketplace API routes."
  }
};

export function registerDatabaseUnavailableRoutes(app: FastifyInstance): void {
  app.get<{ Reply: ApiFailure }>("/categories", async (_request, reply) => {
    return reply.status(503).send(databaseUnavailableResponse);
  });

  app.get<{ Reply: ApiFailure }>("/listings", async (_request, reply) => {
    return reply.status(503).send(databaseUnavailableResponse);
  });

  app.post<{ Reply: ApiFailure }>("/listings", async (_request, reply) => {
    return reply.status(503).send(databaseUnavailableResponse);
  });

  app.post<{ Reply: ApiFailure }>("/favorites", async (_request, reply) => {
    return reply.status(503).send(databaseUnavailableResponse);
  });

  app.delete<{ Reply: ApiFailure }>("/favorites", async (_request, reply) => {
    return reply.status(503).send(databaseUnavailableResponse);
  });

  app.get<{ Reply: ApiFailure }>("/profiles/:profileId/favorites", async (_request, reply) => {
    return reply.status(503).send(databaseUnavailableResponse);
  });

  app.get<{ Reply: ApiFailure }>("/listings/:id", async (_request, reply) => {
    return reply.status(503).send(databaseUnavailableResponse);
  });
}
