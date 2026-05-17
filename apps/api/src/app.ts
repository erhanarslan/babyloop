import { API_PREFIX } from "@babyloop/config";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { readApiRuntimeConfig, type ApiRuntimeConfig } from "./config/env.js";
import { registerAuthPlugin } from "./plugins/auth.plugin.js";
import { registerDatabasePlugin } from "./plugins/database.plugin.js";
import { registerAiListingSuggestionRoutes } from "./routes/ai-listing-suggestions.routes.js";
import { registerAuthRoutes } from "./routes/auth.routes.js";
import { registerAuthUnavailableRoutes } from "./routes/auth-unavailable.routes.js";
import { registerCategoryRoutes } from "./routes/categories.routes.js";
import { registerDatabaseUnavailableRoutes } from "./routes/database-unavailable.routes.js";
import { registerFavoriteRoutes } from "./routes/favorites.routes.js";
import { registerHealthRoutes } from "./routes/health.routes.js";
import { registerListingRoutes } from "./routes/listings.routes.js";
import { registerMessagingRoutes } from "./routes/messaging.routes.js";

type CreateAppOptions = {
  config?: ApiRuntimeConfig;
};

export function createApp(options: CreateAppOptions = {}): FastifyInstance {
  const config = options.config ?? readApiRuntimeConfig();
  assertAuthConfig(config);
  const app = Fastify({
    logger: true
  });

  app.register(cors, {
    origin: config.corsOrigins
  });
  app.register(rateLimit, {
    errorResponseBuilder: (_request, context) => {
      const error = new Error("Too many auth attempts. Try again later.") as Error & {
        statusCode: number;
      };
      error.statusCode = context.statusCode;
      return error;
    },
    global: false,
    hook: "preHandler"
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
    if (config.authSecret) {
      registerAuthPlugin(app, {
        authSecret: config.authSecret
      });
      app.register(registerAuthRoutes, {
        authRateLimitMax: config.authRateLimitMax,
        authRateLimitWindowSeconds: config.authRateLimitWindowSeconds,
        authSecret: config.authSecret,
        authTokenTtlSeconds: config.authTokenTtlSeconds,
        prefix: API_PREFIX
      });
    } else {
      app.log.warn("AUTH_SECRET is not set. Auth API routes will return 503.");
      app.register(registerAuthUnavailableRoutes, { prefix: API_PREFIX });
    }
    app.register(registerAiListingSuggestionRoutes, { prefix: API_PREFIX });
    app.register(registerCategoryRoutes, { prefix: API_PREFIX });
    app.register(registerFavoriteRoutes, { prefix: API_PREFIX });
    app.register(registerListingRoutes, { prefix: API_PREFIX });
    app.register(registerMessagingRoutes, { prefix: API_PREFIX });
  } else {
    app.log.warn("DATABASE_URL is not set. Marketplace API routes will return 503.");
    app.register(registerAiListingSuggestionRoutes, { prefix: API_PREFIX });
    if (config.allowAuthUnavailable) {
      app.register(registerAuthUnavailableRoutes, { prefix: API_PREFIX });
    }
    app.register(registerDatabaseUnavailableRoutes, { prefix: API_PREFIX });
  }

  return app;
}

function assertAuthConfig(config: ApiRuntimeConfig): void {
  if (config.databaseUrl && !config.authSecret && !config.allowAuthUnavailable) {
    throw new Error(
      "AUTH_SECRET is required when DATABASE_URL is configured. Set ALLOW_AUTH_UNAVAILABLE=true only for local unavailable-mode testing."
    );
  }
}

function getPublicErrorCode(statusCode: number, isDatabaseUnavailable: boolean): string {
  if (isDatabaseUnavailable) {
    return "DATABASE_UNAVAILABLE";
  }

  if (statusCode === 500) {
    return "INTERNAL_SERVER_ERROR";
  }

  if (statusCode === 429) {
    return "RATE_LIMITED";
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
