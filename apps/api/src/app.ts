import Fastify, { type FastifyInstance } from "fastify";
import { registerHealthRoutes } from "./routes/health.routes.js";

export function createApp(): FastifyInstance {
  const app = Fastify({
    logger: true
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    const statusCode = getStatusCode(error);
    const message = error instanceof Error ? error.message : "Request failed";

    return reply.status(statusCode).send({
      ok: false,
      error: {
        code: statusCode === 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR",
        message: statusCode === 500 ? "Internal server error" : message
      }
    });
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: `Route ${request.method} ${request.url} was not found`
      }
    });
  });

  registerHealthRoutes(app);

  return app;
}

function getStatusCode(error: unknown): number {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    error.statusCode >= 400
  ) {
    return error.statusCode;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number" &&
    error.status >= 400
  ) {
    return error.status;
  }

  return 500;
}
