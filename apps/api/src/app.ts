import { API_PREFIX } from "@babyloop/config";
import Fastify, { type FastifyInstance } from "fastify";
import { readApiRuntimeConfig, type ApiRuntimeConfig } from "./config/env.js";
import { registerDatabasePlugin } from "./plugins/database.plugin.js";
import { registerCategoryRoutes } from "./routes/categories.routes.js";
import { registerDatabaseUnavailableRoutes } from "./routes/database-unavailable.routes.js";
import { registerHealthRoutes } from "./routes/health.routes.js";
import { registerListingRoutes } from "./routes/listings.routes.js";

type CreateAppOptions = {
  config?: ApiRuntimeConfig;
};

export function createApp(options: CreateAppOptions = {}): FastifyInstance {
  const config = options.config ?? readApiRuntimeConfig();
  const app = Fastify({
    logger: true
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    const isDatabaseUnavailable = isDatabaseConnectionError(error);
    const statusCode = isDatabaseUnavailable ? 503 : getStatusCode(error);
    const message = error instanceof Error ? error.message : "Request failed";

    return reply.status(statusCode).send({
      ok: false,
      error: {
        code: getPublicErrorCode(statusCode, isDatabaseUnavailable),
        message: getPublicErrorMessage(statusCode, isDatabaseUnavailable, message)
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

  if (config.databaseUrl) {
    registerDatabasePlugin(app, {
      databaseUrl: config.databaseUrl
    });
    app.register(registerCategoryRoutes, { prefix: API_PREFIX });
    app.register(registerListingRoutes, { prefix: API_PREFIX });
  } else {
    app.log.warn("DATABASE_URL is not set. Marketplace API routes will return 503.");
    app.register(registerDatabaseUnavailableRoutes, { prefix: API_PREFIX });
  }

  return app;
}

function getPublicErrorCode(statusCode: number, isDatabaseUnavailable: boolean): string {
  if (isDatabaseUnavailable) {
    return "DATABASE_UNAVAILABLE";
  }

  if (statusCode === 500) {
    return "INTERNAL_SERVER_ERROR";
  }

  return "REQUEST_ERROR";
}

function getPublicErrorMessage(
  statusCode: number,
  isDatabaseUnavailable: boolean,
  message: string
): string {
  if (isDatabaseUnavailable) {
    return "Database is unavailable.";
  }

  if (statusCode === 500) {
    return "Internal server error";
  }

  return message;
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

function isDatabaseConnectionError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return [
    "ECONNREFUSED",
    "ECONNRESET",
    "EPERM",
    "ENOTFOUND",
    "ETIMEDOUT",
    "57P01",
    "57P02",
    "57P03"
  ].includes(String(error.code));
}
