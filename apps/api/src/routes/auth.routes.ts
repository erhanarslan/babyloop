import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  RouteShorthandOptions
} from "fastify";
import { loginBodySchema, registerBodySchema } from "../schemas/auth.schemas.js";
import { requireCurrentUser } from "../services/auth-context.service.js";
import {
  attachAccessToken,
  buildAuthMeResponse,
  buildLogoutAuthResponse,
  createAuthSession,
  invalidAuthRequest,
  loginUser,
  refreshAuthSession,
  registerUser,
  revokeAuthSession,
  unauthorizedAuthRequest,
  type AuthMeResponse,
  type AuthResponse,
  type LogoutAuthResponse,
  type AuthSessionRequestMeta,
  type AuthTokenOptions
} from "../services/auth.service.js";
import {
  readRefreshTokenCookie,
  serializeExpiredRefreshTokenCookie,
  serializeRefreshTokenCookie
} from "../utils/refresh-token.js";

export function registerAuthRoutes(app: FastifyInstance, options: AuthTokenOptions): void {
  app.post<{ Body: unknown; Reply: AuthResponse }>(
    "/auth/register",
    authRateLimitOptions(options),
    async (request, reply) => {
      const parsedBody = registerBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send(invalidAuthRequest());
      }

      const result = await registerUser(app, parsedBody.data);

      if (result.status === "duplicate") {
        return reply.status(409).send(result.response);
      }

      const response = attachAccessToken(result.response, options);
      const session = await createAuthSession(
        app,
        response.data.user.id,
        buildAuthSessionRequestMeta(request)
      );

      setRefreshTokenCookie(reply, session.refreshToken, session.expiresAt);

      return reply.status(201).send(response);
    }
  );

  app.post<{ Body: unknown; Reply: AuthResponse }>(
    "/auth/login",
    authRateLimitOptions(options),
    async (request, reply) => {
      const parsedBody = loginBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send(invalidAuthRequest());
      }

      const result = await loginUser(app, parsedBody.data);

      if (result.status === "invalid") {
        return reply.status(401).send(result.response);
      }

      const response = attachAccessToken(result.response, options);
      const session = await createAuthSession(
        app,
        response.data.user.id,
        buildAuthSessionRequestMeta(request)
      );

      setRefreshTokenCookie(reply, session.refreshToken, session.expiresAt);

      return reply.status(200).send(response);
    }
  );

  app.post<{ Reply: AuthResponse }>(
    "/auth/refresh",
    authRateLimitOptions(options),
    async (request, reply) => {
      const refreshToken = readRefreshTokenCookie(request.headers.cookie);

      if (!refreshToken) {
        return reply.status(401).send(unauthorizedAuthRequest());
      }

      const result = await refreshAuthSession(
        app,
        refreshToken,
        buildAuthSessionRequestMeta(request)
      );

      if (result.status === "invalid") {
        return reply.status(401).send(result.response);
      }

      const response = attachAccessToken(result.response, options);

      setRefreshTokenCookie(reply, result.refreshToken, result.expiresAt);

      return reply.status(200).send(response);
    }
  );

  app.post<{ Reply: LogoutAuthResponse }>("/auth/logout", async (request, reply) => {
    const refreshToken = readRefreshTokenCookie(request.headers.cookie);

    if (refreshToken) {
      await revokeAuthSession(app, refreshToken);
    }

    clearRefreshTokenCookie(reply);

    return reply.status(200).send(buildLogoutAuthResponse());
  });

  app.get<{ Reply: AuthMeResponse }>("/auth/me", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    return buildAuthMeResponse(currentUser);
  });
}

function authRateLimitOptions(options: AuthTokenOptions): RouteShorthandOptions {
  return {
    config: {
      rateLimit: {
        max: options.authRateLimitMax,
        timeWindow: options.authRateLimitWindowSeconds * 1000
      }
    }
  };
}

function buildAuthSessionRequestMeta(request: FastifyRequest): AuthSessionRequestMeta {
  return {
    ipAddress: request.ip ?? null,
    userAgent: normalizeHeaderValue(request.headers["user-agent"])
  };
}

function normalizeHeaderValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return value ?? null;
}

function setRefreshTokenCookie(reply: FastifyReply, refreshToken: string, expiresAt: Date): void {
  reply.header(
    "set-cookie",
    serializeRefreshTokenCookie(refreshToken, {
      expiresAt
    })
  );
}

function clearRefreshTokenCookie(reply: FastifyReply): void {
  reply.header("set-cookie", serializeExpiredRefreshTokenCookie());
}
