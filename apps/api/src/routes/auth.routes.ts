import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  RouteShorthandOptions
} from "fastify";
import {
  emailVerificationConfirmSchema,
  emailVerificationRequestSchema,
  loginBodySchema,
  passwordChangeSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  registerBodySchema
} from "../schemas/auth.schemas.js";
import { requireCurrentUser } from "../services/auth-context.service.js";
import {
  attachAccessToken,
  authenticateGoogleUser,
  buildAuthMeResponse,
  buildLogoutAuthResponse,
  changePassword,
  confirmEmailVerification,
  confirmPasswordReset,
  createAuthSession,
  invalidAuthRequest,
  loginUser,
  refreshAuthSession,
  registerUser,
  requestPasswordReset,
  requestEmailVerification,
  revokeAuthSession,
  unauthorizedAuthRequest,
  type AuthMeResponse,
  type AuthResponse,
  type EmailVerificationConfirmResponse,
  type EmailVerificationRequestResponse,
  type LogoutAuthResponse,
  type PasswordChangeResponse,
  type PasswordResetConfirmResponse,
  type PasswordResetRequestResponse,
  type AuthSessionRequestMeta,
  type AuthTokenOptions
} from "../services/auth.service.js";
import {
  buildGoogleAuthorizationUrl,
  defaultGoogleOAuthClient,
  generateOAuthState,
  isGoogleOAuthConfigured,
  readGoogleOAuthStateCookie,
  serializeExpiredGoogleOAuthStateCookie,
  serializeGoogleOAuthStateCookie,
  type GoogleOAuthClient,
  type GoogleOAuthConfig
} from "../services/google-oauth.service.js";
import {
  readRefreshTokenCookie,
  serializeExpiredRefreshTokenCookie,
  serializeRefreshTokenCookie
} from "../utils/refresh-token.js";

type AuthRouteOptions = AuthTokenOptions & {
  googleOAuth?: GoogleOAuthConfig;
  googleOAuthClient?: GoogleOAuthClient;
  webAppUrl: string;
};

type PasswordResetRequestRouteResponse =
  | PasswordResetRequestResponse
  | ReturnType<typeof invalidAuthRequest>;

type EmailVerificationRequestRouteResponse =
  | EmailVerificationRequestResponse
  | ReturnType<typeof invalidAuthRequest>;

export function registerAuthRoutes(app: FastifyInstance, options: AuthRouteOptions): void {
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
      const responseWithDevVerificationToken =
        shouldExposeDevEmailVerificationToken() && result.devEmailVerificationToken
          ? {
              ok: true as const,
              data: {
                ...response.data,
                devEmailVerificationToken: result.devEmailVerificationToken
              }
            }
          : response;
      const session = await createAuthSession(
        app,
        response.data.user.id,
        buildAuthSessionRequestMeta(request)
      );

      setRefreshTokenCookie(reply, session.refreshToken, session.expiresAt);

      return reply.status(201).send(responseWithDevVerificationToken);
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

  app.post<{ Body: unknown; Reply: PasswordResetRequestRouteResponse }>(
    "/auth/password-reset/request",
    authRateLimitOptions(options),
    async (request, reply) => {
      const parsedBody = passwordResetRequestSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send(invalidAuthRequest());
      }

      const result = await requestPasswordReset(app, parsedBody.data);

      if (shouldExposeDevResetToken() && result.devResetToken) {
        return reply.status(200).send({
          ok: true,
          data: {
            ...result.response.data,
            devResetToken: result.devResetToken
          }
        });
      }

      return reply.status(200).send(result.response);
    }
  );

  app.post<{ Body: unknown; Reply: PasswordResetConfirmResponse }>(
    "/auth/password-reset/confirm",
    authRateLimitOptions(options),
    async (request, reply) => {
      const parsedBody = passwordResetConfirmSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send(invalidAuthRequest());
      }

      const result = await confirmPasswordReset(app, parsedBody.data);

      if (result.status === "invalid") {
        return reply.status(400).send(result.response);
      }

      return reply.status(200).send(result.response);
    }
  );

  app.post<{ Body: unknown; Reply: PasswordChangeResponse }>(
    "/auth/password/change",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedBody = passwordChangeSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send(invalidAuthRequest());
      }

      const result = await changePassword(app, currentUser.userId, parsedBody.data);

      if (result.status === "invalid") {
        return reply.status(401).send(result.response);
      }

      clearRefreshTokenCookie(reply);

      return reply.status(200).send(result.response);
    }
  );

  app.post<{ Body: unknown; Reply: EmailVerificationRequestRouteResponse }>(
    "/auth/email-verification/request",
    authRateLimitOptions(options),
    async (request, reply) => {
      const parsedBody = emailVerificationRequestSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send(invalidAuthRequest());
      }

      const result = await requestEmailVerification(app, parsedBody.data);

      if (shouldExposeDevEmailVerificationToken() && result.devEmailVerificationToken) {
        return reply.status(200).send({
          ok: true,
          data: {
            ...result.response.data,
            devEmailVerificationToken: result.devEmailVerificationToken
          }
        });
      }

      return reply.status(200).send(result.response);
    }
  );

  app.post<{ Body: unknown; Reply: EmailVerificationConfirmResponse }>(
    "/auth/email-verification/confirm",
    authRateLimitOptions(options),
    async (request, reply) => {
      const parsedBody = emailVerificationConfirmSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send(invalidAuthRequest());
      }

      const result = await confirmEmailVerification(app, parsedBody.data);

      if (result.status === "invalid") {
        return reply.status(400).send(result.response);
      }

      return reply.status(200).send(result.response);
    }
  );

  app.get("/auth/google/start", async (_request, reply) => {
    if (!isGoogleOAuthConfigured(options.googleOAuth)) {
      return reply.status(503).send(googleOAuthUnavailableResponse());
    }

    const state = generateOAuthState();
    const authorizationUrl = buildGoogleAuthorizationUrl(options.googleOAuth, state);

    reply.header("set-cookie", serializeGoogleOAuthStateCookie(state));

    return redirect(reply, authorizationUrl);
  });

  app.get<{ Querystring: Record<string, unknown> }>("/auth/google/callback", async (request, reply) => {
    if (!isGoogleOAuthConfigured(options.googleOAuth)) {
      return redirectToGoogleAuthUnavailable(reply, options.webAppUrl);
    }

    const cookieState = readGoogleOAuthStateCookie(request.headers.cookie);
    const queryState = readQueryStringValue(request.query.state);
    const code = readQueryStringValue(request.query.code);

    if (!cookieState || !queryState || cookieState !== queryState || !code) {
      return redirectToGoogleAuthFailure(reply, options.googleOAuth.webAppUrl);
    }

    try {
      const googleClient = options.googleOAuthClient ?? defaultGoogleOAuthClient;
      const tokens = await googleClient.exchangeCodeForTokens(code, options.googleOAuth);
      const googleProfile = await googleClient.fetchUserInfo(tokens.accessToken);

      if (!googleProfile.email || googleProfile.email_verified === false) {
        return redirectToGoogleAuthFailure(reply, options.googleOAuth.webAppUrl);
      }

      const result = await authenticateGoogleUser(app, googleProfile);
      const response = attachAccessToken(result, options);
      const session = await createAuthSession(
        app,
        response.data.user.id,
        buildAuthSessionRequestMeta(request)
      );

      reply.header("set-cookie", [
        serializeRefreshTokenCookie(session.refreshToken, {
          expiresAt: session.expiresAt
        }),
        serializeExpiredGoogleOAuthStateCookie()
      ]);

      return redirect(reply, buildGoogleAuthSuccessRedirect(options.googleOAuth.webAppUrl));
    } catch (error) {
      request.log.warn({ error }, "Google OAuth callback failed.");
      return redirectToGoogleAuthFailure(reply, options.googleOAuth.webAppUrl);
    }
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

function readQueryStringValue(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  return value;
}

function redirectToGoogleAuthFailure(reply: FastifyReply, webAppUrl: string): void {
  reply.header("set-cookie", serializeExpiredGoogleOAuthStateCookie());
  return redirect(reply, `${webAppUrl.replace(/\/$/, "")}/login?error=google_auth_failed`);
}

function redirectToGoogleAuthUnavailable(reply: FastifyReply, webAppUrl: string): void {
  reply.header("set-cookie", serializeExpiredGoogleOAuthStateCookie());
  return redirect(reply, `${webAppUrl.replace(/\/$/, "")}/login?error=google_auth_unavailable`);
}

function buildGoogleAuthSuccessRedirect(webAppUrl: string): string {
  return `${webAppUrl.replace(/\/$/, "")}/auth/callback?status=success`;
}

function redirect(reply: FastifyReply, location: string): void {
  reply.status(302).header("location", location).send();
}

function googleOAuthUnavailableResponse() {
  return {
    ok: false,
    error: {
      code: "GOOGLE_AUTH_UNAVAILABLE",
      message: "Google OAuth is not configured."
    }
  };
}

function shouldExposeDevResetToken() {
  return process.env.NODE_ENV === "test";
}

function shouldExposeDevEmailVerificationToken() {
  return process.env.NODE_ENV === "test";
}
