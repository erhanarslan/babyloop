import type { ApiFailure } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";

const authUnavailableResponse: ApiFailure = {
  ok: false,
  error: {
    code: "AUTH_UNAVAILABLE",
    message:
      "Authentication is unavailable. Set DATABASE_URL and AUTH_SECRET to enable auth, or ALLOW_AUTH_UNAVAILABLE=true for local unavailable-mode testing."
  }
};

export function registerAuthUnavailableRoutes(app: FastifyInstance): void {
  app.post<{ Reply: ApiFailure }>("/auth/register", async (_request, reply) => {
    return reply.status(503).send(authUnavailableResponse);
  });

  app.post<{ Reply: ApiFailure }>("/auth/login", async (_request, reply) => {
    return reply.status(503).send(authUnavailableResponse);
  });

  app.post<{ Reply: ApiFailure }>(
    "/auth/account-deletion/request",
    async (_request, reply) => {
      return reply.status(503).send(authUnavailableResponse);
    }
  );

  app.post<{ Reply: ApiFailure }>(
    "/auth/account-deletion/confirm",
    async (_request, reply) => {
      return reply.status(503).send(authUnavailableResponse);
    }
  );

  app.get<{ Reply: ApiFailure }>("/auth/me", async (_request, reply) => {
    return reply.status(503).send(authUnavailableResponse);
  });
}
