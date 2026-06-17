import { API_PREFIX } from "@babyloop/config";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { readApiRuntimeConfig, type ApiRuntimeConfig } from "./config/env.js";
import { registerAuthPlugin } from "./plugins/auth.plugin.js";
import {
  isBackofficeCsrfRequestValid,
  shouldEnforceBackofficeCsrf
} from "./utils/backoffice-csrf.js";
import {
  isPublicCsrfRequestValid,
  shouldEnforcePublicCsrf
} from "./utils/public-csrf.js";
import { registerDatabasePlugin } from "./plugins/database.plugin.js";
import { registerAiListingSuggestionRoutes } from "./routes/ai-listing-suggestions.routes.js";
import { registerAiPriceSuggestionRoutes } from "./routes/ai-price-suggestions.routes.js";
import { registerAssistantRoutes } from "./routes/assistant.routes.js";
import { registerAuthRoutes } from "./routes/auth.routes.js";
import { registerAuthUnavailableRoutes } from "./routes/auth-unavailable.routes.js";
import { registerCategoryRoutes } from "./routes/categories.routes.js";
import { registerChildProfileRoutes } from "./routes/child-profiles.routes.js";
import { registerDatabaseUnavailableRoutes } from "./routes/database-unavailable.routes.js";
import { registerFavoriteRoutes } from "./routes/favorites.routes.js";
import { registerHealthRoutes } from "./routes/health.routes.js";
import { registerListingRoutes } from "./routes/listings.routes.js";
import { registerListingRecommendationRoutes } from "./routes/listing-recommendations.routes.js";
import { registerMessagingRoutes } from "./routes/messaging.routes.js";
import { registerNotificationRoutes } from "./routes/notifications.routes.js";
import { registerProductEventRoutes } from "./routes/product-events.routes.js";
import { registerSearchSuggestionRoutes } from "./routes/search-suggestions.routes.js";
import { registerSafetyRoutes } from "./routes/safety.routes.js";
import { registerSavedSearchRoutes } from "./routes/saved-searches.routes.js";
import { registerSellerDashboardRoutes } from "./routes/seller-dashboard.routes.js";
import { registerUploadRoutes } from "./routes/uploads.routes.js";
import { registerRealtime } from "./realtime/socket.js";
import {
  MAX_LISTING_IMAGE_BYTES,
  MAX_LISTING_IMAGES
} from "./services/image-safety.service.js";
import {
  createEmailDeliveryService,
  type EmailDeliveryService
} from "./services/email-delivery.service.js";
import type { GoogleOAuthClient } from "./services/google-oauth.service.js";
import { registerAdminConversationRoutes } from "./routes/admin-conversations.routes.js";
import { registerAdminDashboardRoutes } from "./routes/admin-dashboard.routes.js";
import { registerAdminModerationRoutes } from "./routes/admin-moderation.routes.js";
import { registerAdminProductAnalyticsRoutes } from "./routes/admin-product-analytics.routes.js";
import { registerAdminProfileRoutes } from "./routes/admin-profiles.routes.js";
import { registerAdminListingRoutes } from "./routes/admin-listings.routes.js";
import { registerAdminAuditRoutes } from "./routes/admin-audit.routes.js";
import { registerAdminAiOpsRoutes } from "./routes/admin-ai-ops.routes.js";
import { createAdminModerationAiSummaryProvider } from "./services/admin-moderation-ai-provider.service.js";
import { createAssistantMessageProvider } from "./services/assistant-ai-provider.service.js";
import { createListingDraftAiProvider } from "./services/listing-draft-ai-provider.service.js";
import type {
  AssistantMessageProvider,
  ListingDraftSuggestionProvider,
  ModerationSummaryProvider
} from "@babyloop/ai-core";

type CreateAppOptions = {
  assistantProvider?: AssistantMessageProvider | null;
  config?: ApiRuntimeConfig;
  emailDelivery?: EmailDeliveryService;
  googleOAuthClient?: GoogleOAuthClient;
  listingDraftSuggestionProvider?: ListingDraftSuggestionProvider | null;
  moderationSummaryProvider?: ModerationSummaryProvider;
};

export function createApp(options: CreateAppOptions = {}): FastifyInstance {
  const config = options.config ?? readApiRuntimeConfig();

  assertAuthConfig(config);

  const moderationSummaryProvider =
    options.moderationSummaryProvider ??
    createAdminModerationAiSummaryProvider(config.aiModerationSummary);
  const assistantProvider =
    options.assistantProvider ??
    createAssistantMessageProvider(config.assistant);
  const listingDraftSuggestionProvider =
    options.listingDraftSuggestionProvider ??
    createListingDraftAiProvider(config.aiListingDraft);

  const emailDelivery =
    options.emailDelivery ??
    createEmailDeliveryService({
      ...(config.emailFrom ? { emailFrom: config.emailFrom } : {}),
      mode: config.emailDeliveryMode,
      webAppUrl: config.webAppUrl
    });

  const app = Fastify({
    logger: true
  });

  app.register(cors, {
    credentials: true,
    origin: config.corsOrigins,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-babyloop-csrf-token"],
    exposedHeaders: ["Set-Cookie"]
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

  app.register(multipart, {
    limits: {
      fileSize: MAX_LISTING_IMAGE_BYTES,
      files: MAX_LISTING_IMAGES
    }
  });

  app.addHook("onRequest", async (_request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    reply.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  });

  app.addHook("preHandler", async (request, reply) => {
    if (shouldEnforceBackofficeCsrf(request, { apiPrefix: API_PREFIX })) {
      if (isBackofficeCsrfRequestValid(request)) {
        return;
      }

      return reply.status(403).send({
        ok: false,
        error: {
          code: "CSRF_TOKEN_REQUIRED",
          message: "A valid CSRF token is required for backoffice mutations."
        }
      });
    }

    if (!shouldEnforcePublicCsrf(request, { apiPrefix: API_PREFIX })) {
      return;
    }

    if (isPublicCsrfRequestValid(request)) {
      return;
    }

    return reply.status(403).send({
      ok: false,
      error: {
        code: "PUBLIC_CSRF_TOKEN_REQUIRED",
        message: "A valid CSRF token is required for authenticated public mutations."
      }
    });
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

      registerRealtime(app, {
        authSecret: config.authSecret,
        corsOrigins: config.corsOrigins
      });

      const authRouteOptions = {
        authRateLimitMax: config.authRateLimitMax,
        authRateLimitWindowSeconds: config.authRateLimitWindowSeconds,
        authSecret: config.authSecret,
        authTokenTtlSeconds: config.authTokenTtlSeconds,
        emailDelivery,
        prefix: API_PREFIX,
        webAppUrl: config.webAppUrl
      };

      app.register(registerAuthRoutes, {
        ...authRouteOptions,
        ...(config.googleOAuth ? { googleOAuth: config.googleOAuth } : {}),
        ...(options.googleOAuthClient ? { googleOAuthClient: options.googleOAuthClient } : {})
      });
    } else {
      app.log.warn("AUTH_SECRET is not set. Auth API routes will return 503.");
      app.register(registerAuthUnavailableRoutes, { prefix: API_PREFIX });
    }

    app.register(registerAiListingSuggestionRoutes, { prefix: API_PREFIX });
    app.register(registerAiPriceSuggestionRoutes, { prefix: API_PREFIX });
    app.register(registerAssistantRoutes, { assistantProvider, prefix: API_PREFIX });
    app.register(registerCategoryRoutes, { prefix: API_PREFIX });
    app.register(registerChildProfileRoutes, { prefix: API_PREFIX });
    app.register(registerFavoriteRoutes, { prefix: API_PREFIX });
    app.register(registerListingRoutes, {
      listingDraftSuggestionProvider,
      prefix: API_PREFIX,
      uploadRoot: config.uploadRoot
    });
    app.register(registerListingRecommendationRoutes, { prefix: API_PREFIX });
    app.register(registerMessagingRoutes, { prefix: API_PREFIX });
    app.register(registerNotificationRoutes, { prefix: API_PREFIX });
    app.register(registerProductEventRoutes, { prefix: API_PREFIX });
    app.register(registerSearchSuggestionRoutes, { prefix: API_PREFIX });
    app.register(registerSafetyRoutes, { prefix: API_PREFIX });
    app.register(registerSavedSearchRoutes, { prefix: API_PREFIX });
    app.register(registerSellerDashboardRoutes, { prefix: API_PREFIX });
    app.register(registerAdminAuditRoutes, { prefix: API_PREFIX });
    app.register(registerAdminAiOpsRoutes, { prefix: API_PREFIX });
    app.register(registerAdminConversationRoutes, { prefix: API_PREFIX });
    app.register(registerAdminDashboardRoutes, { prefix: API_PREFIX });
    app.register(registerAdminListingRoutes, { prefix: API_PREFIX });
    app.register(registerAdminProfileRoutes, { prefix: API_PREFIX });
    app.register(registerAdminProductAnalyticsRoutes, { prefix: API_PREFIX });
    app.register(registerAdminModerationRoutes, {
      aiSummaryProvider: moderationSummaryProvider,
      prefix: API_PREFIX
    });
    app.register(registerUploadRoutes, { prefix: API_PREFIX, uploadRoot: config.uploadRoot });
  } else {
    app.log.warn("DATABASE_URL is not set. Marketplace API routes will return 503.");
    app.register(registerAiListingSuggestionRoutes, { prefix: API_PREFIX });
    app.register(registerAiPriceSuggestionRoutes, { prefix: API_PREFIX });
    app.register(registerAssistantRoutes, { assistantProvider, prefix: API_PREFIX });

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
