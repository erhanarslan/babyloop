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
  loginApprovalCompleteSchema,
  loginApprovalPreferenceSchema,
  mfaPreferenceSchema,
  mfaVerifySchema,
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
  getMfaStatus,
  invalidAuthRequest,
  loginUser,
  refreshAuthSession,
  registerUser,
  requestPasswordReset,
  requestEmailVerification,
  revokeAuthSessionById,
  revokeAllAuthSessions,
  listAuthSessions,
  revokeAuthSession,
  unauthorizedAuthRequest,
  updateMfaPreference,
  verifyMfaLogin,
  type AuthMeResponse,
  type AuthResponse,
  type EmailVerificationConfirmResponse,
  type EmailVerificationRequestResponse,
  type LogoutAuthResponse,
  type MfaChallengeResponse,
  type MfaPreferenceResponse,
  type MfaStatusResponse,
  type MfaVerifyResponse,
  type PasswordChangeResponse,
  type PasswordResetConfirmResponse,
  type PasswordResetRequestResponse,
  type AuthSessionRevokeResponse,
  type AuthSessionsResponse,
  type AuthSessionsRevokeAllResponse,
  type AuthSessionRequestMeta,
  type AuthTokenOptions,
  type SafeAuthProfile,
  type SafeAuthUser
} from "../services/auth.service.js";
import {
  approveLoginApprovalChallenge,
  completeApprovedLoginApprovalChallenge,
  denyLoginApprovalChallenge,
  getLoginApprovalStatus,
  listPendingLoginApprovals,
  updateLoginApprovalPreference,
  type LoginApprovalActionResponse,
  type LoginApprovalCompleteResponse,
  type LoginApprovalPreferenceResponse,
  type LoginApprovalsResponse,
  type LoginApprovalRequiredResponse,
  type LoginApprovalStatusResponse
} from "../services/login-approval.service.js";
import { adminForbidden, isBackofficeRole } from "../services/admin-context.service.js";
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
import type { EmailDeliveryService } from "../services/email-delivery.service.js";
import {
  readRefreshTokenCookie,
  serializeExpiredRefreshTokenCookie,
  serializeRefreshTokenCookie
} from "../utils/refresh-token.js";
import {
  serializeBackofficeAccessTokenCookie,
  serializeExpiredBackofficeAccessTokenCookie
} from "../utils/backoffice-access-token-cookie.js";
import {
  serializeExpiredPublicAccessTokenCookie,
  serializePublicAccessTokenCookie
} from "../utils/public-access-token-cookie.js";
import {
  createPublicCsrfToken,
  serializeExpiredPublicCsrfCookie,
  serializePublicCsrfCookie
} from "../utils/public-csrf.js";
import {
  createBackofficeCsrfToken,
  serializeBackofficeCsrfCookie,
  serializeExpiredBackofficeCsrfCookie
} from "../utils/backoffice-csrf.js";

type AuthRouteOptions = AuthTokenOptions & {
  emailDelivery: EmailDeliveryService;
  googleOAuth?: GoogleOAuthConfig;
  googleOAuthClient?: GoogleOAuthClient;
  webAppUrl: string;
};

type PasswordResetRequestRouteResponse =
  | PasswordResetRequestResponse
  | ReturnType<typeof invalidAuthRequest>;

type LoginRouteResponse = AuthResponse | MfaChallengeResponse | LoginApprovalRequiredResponse;

type BackofficeAuthRouteResponse = AuthMeResponse | MfaChallengeResponse | ReturnType<typeof adminForbidden>;

type BackofficeCsrfRouteResponse =
  | { ok: true; data: { csrfToken: string } }
  | ReturnType<typeof adminForbidden>;

type AuthClientType = "web" | "mobile" | "backoffice";

function resolveAuthClientType(
  request: { headers: Record<string, string | string[] | undefined> },
  bodyClientType?: AuthClientType
): AuthClientType {
  const headerValue = request.headers["x-babyloop-client"];
  const rawHeader = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const normalizedHeader = typeof rawHeader === "string" ? rawHeader.trim().toLowerCase() : "";

  if (normalizedHeader === "mobile" || normalizedHeader === "web" || normalizedHeader === "backoffice") {
    return normalizedHeader;
  }

  return bodyClientType ?? "web";
}

function shouldRequireMobileLoginApproval(clientType: AuthClientType): boolean {
  return clientType === "web";
}


function shouldExposeDevAuthToken(): boolean {
  if (process.env.NODE_ENV === "test") {
    return true;
  }

  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return process.env.BABYLOOP_EXPOSE_DEV_AUTH_TOKENS === "1";
}


function shouldExposeDevEmailVerificationToken(): boolean {
  return shouldExposeDevAuthToken();
}

function shouldExposeDevResetToken(): boolean {
  return shouldExposeDevAuthToken();
}

function shouldExposeDevOtpCode(): boolean {
  return shouldExposeDevAuthToken();
}

type PublicCsrfRouteResponse = { ok: true; data: { csrfToken: string } };

type AuthSessionsRouteResponse = AuthSessionsResponse;
type AuthSessionRevokeRouteResponse = AuthSessionRevokeResponse | ReturnType<typeof invalidAuthRequest>;
type AuthSessionsRevokeAllRouteResponse = AuthSessionsRevokeAllResponse;

type LoginApprovalStatusRouteResponse = LoginApprovalStatusResponse;
type LoginApprovalPreferenceRouteResponse =
  | LoginApprovalPreferenceResponse
  | ReturnType<typeof invalidAuthRequest>;
type LoginApprovalsRouteResponse = LoginApprovalsResponse;
type LoginApprovalActionRouteResponse =
  | LoginApprovalActionResponse
  | ReturnType<typeof invalidAuthRequest>;
type LoginApprovalCompleteRouteResponse =
  | LoginApprovalCompleteResponse
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

      const result = await registerUser(app, parsedBody.data, {
        emailDelivery: options.emailDelivery,
        webAppUrl: options.webAppUrl
      });

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

      setPublicAuthCookies(reply, {
        accessToken: response.data.accessToken,
        accessTokenMaxAgeSeconds: options.authTokenTtlSeconds,
        refreshToken: session.refreshToken,
        refreshTokenExpiresAt: session.expiresAt
      });

      return reply.status(201).send(responseWithDevVerificationToken);
    }
  );

  app.post<{ Body: unknown; Reply: LoginRouteResponse }>(
    "/auth/login",
    authRateLimitOptions(options),
    async (request, reply) => {
      const parsedBody = loginBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send(invalidAuthRequest());
      }

      const clientType = resolveAuthClientType(request, parsedBody.data.clientType);

      const result = await loginUser(app, parsedBody.data, {
        emailDelivery: options.emailDelivery,
        requestMeta: buildAuthSessionRequestMeta(request),
        requireMobileLoginApproval: shouldRequireMobileLoginApproval(clientType),
        webAppUrl: options.webAppUrl
      });

      if (result.status === "invalid") {
        return reply.status(401).send(result.response);
      }

      if (result.status === "mfa_required") {
        const response =
          shouldExposeDevOtpCode() && result.devOtpCode
            ? {
                ok: true as const,
                data: {
                  ...result.response.data,
                  devOtpCode: result.devOtpCode
                }
              }
            : result.response;

        return reply.status(200).send(response);
      }

      if (result.status === "approval_required") {
        return reply.status(200).send(result.response);
      }

      const response = attachAccessToken(result.response, options);
      const session = await createAuthSession(
        app,
        response.data.user.id,
        buildAuthSessionRequestMeta(request)
      );

      setPublicAuthCookies(reply, {
        accessToken: response.data.accessToken,
        accessTokenMaxAgeSeconds: options.authTokenTtlSeconds,
        refreshToken: session.refreshToken,
        refreshTokenExpiresAt: session.expiresAt
      });

      return reply.status(200).send(response);
    }
  );

  app.post<{ Body: unknown; Reply: MfaVerifyResponse }>(
    "/auth/mfa/verify",
    authRateLimitOptions(options),
    async (request, reply) => {
      const parsedBody = mfaVerifySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send(invalidAuthRequest());
      }

      const result = await verifyMfaLogin(app, parsedBody.data, {
        requestMeta: buildAuthSessionRequestMeta(request),
        requireMobileLoginApproval: shouldRequireMobileLoginApproval(resolveAuthClientType(request, "web"))
      });

      if (result.status === "invalid") {
        return reply.status(400).send(result.response);
      }

      if (result.status === "approval_required") {
        return reply.status(200).send(result.response);
      }

      const response = attachAccessToken(result.response, options);
      const session = await createAuthSession(
        app,
        response.data.user.id,
        buildAuthSessionRequestMeta(request)
      );

      setPublicAuthCookies(reply, {
        accessToken: response.data.accessToken,
        accessTokenMaxAgeSeconds: options.authTokenTtlSeconds,
        refreshToken: session.refreshToken,
        refreshTokenExpiresAt: session.expiresAt
      });

      return reply.status(200).send(response);
    }
  );

  app.post<{ Body: unknown; Reply: LoginApprovalCompleteRouteResponse }>(
    "/auth/login-approval/complete",
    async (request, reply) => {
      const parsedBody = loginApprovalCompleteSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send(invalidAuthRequest());
      }

      const result = await completeApprovedLoginApprovalChallenge(app, parsedBody.data);

      if (result.status === "pending") {
        return reply.status(202).send(result.response);
      }

      if (result.status === "invalid") {
        return reply.status(400).send(result.response);
      }

      const response = attachAccessToken(result.response, options);
      const session = await createAuthSession(
        app,
        response.data.user.id,
        buildAuthSessionRequestMeta(request)
      );

      setPublicAuthCookies(reply, {
        accessToken: response.data.accessToken,
        accessTokenMaxAgeSeconds: options.authTokenTtlSeconds,
        refreshToken: session.refreshToken,
        refreshTokenExpiresAt: session.expiresAt
      });

      return reply.status(200).send(response);
    }
  );

  app.get<{ Reply: MfaStatusResponse }>(
    "/auth/mfa/status",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      return getMfaStatus(app, currentUser.userId);
    }
  );

  app.post<{ Body: unknown; Reply: MfaPreferenceResponse | ReturnType<typeof invalidAuthRequest> }>(
    "/auth/mfa/enable",
    authRateLimitOptions(options),
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedBody = mfaPreferenceSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send(invalidAuthRequest());
      }

      const result = await updateMfaPreference(app, currentUser.userId, parsedBody.data, true);

      if (result.status === "invalid") {
        return reply.status(401).send(result.response);
      }

      return reply.status(200).send(result.response);
    }
  );

  app.post<{ Body: unknown; Reply: MfaPreferenceResponse | ReturnType<typeof invalidAuthRequest> }>(
    "/auth/mfa/disable",
    authRateLimitOptions(options),
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedBody = mfaPreferenceSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send(invalidAuthRequest());
      }

      const result = await updateMfaPreference(app, currentUser.userId, parsedBody.data, false);

      if (result.status === "invalid") {
        return reply.status(401).send(result.response);
      }

      return reply.status(200).send(result.response);
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

      setPublicAuthCookies(reply, {
        accessToken: response.data.accessToken,
        accessTokenMaxAgeSeconds: options.authTokenTtlSeconds,
        refreshToken: result.refreshToken,
        refreshTokenExpiresAt: result.expiresAt
      });

      return reply.status(200).send(response);
    }
  );

  app.get<{ Reply: LoginApprovalStatusRouteResponse }>(
    "/auth/login-approval/status",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      return getLoginApprovalStatus(app, currentUser.userId);
    }
  );

  app.post<{ Body: unknown; Reply: LoginApprovalPreferenceRouteResponse }>(
    "/auth/login-approval/enable",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedBody = loginApprovalPreferenceSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send(invalidAuthRequest());
      }

      const result = await updateLoginApprovalPreference(app, currentUser.userId, parsedBody.data, true);

      if (result.status === "invalid") {
        return reply.status(401).send(result.response);
      }

      return reply.status(200).send(result.response);
    }
  );

  app.post<{ Body: unknown; Reply: LoginApprovalPreferenceRouteResponse }>(
    "/auth/login-approval/disable",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedBody = loginApprovalPreferenceSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send(invalidAuthRequest());
      }

      const result = await updateLoginApprovalPreference(app, currentUser.userId, parsedBody.data, false);

      if (result.status === "invalid") {
        return reply.status(401).send(result.response);
      }

      return reply.status(200).send(result.response);
    }
  );

  app.get<{ Reply: LoginApprovalsRouteResponse }>(
    "/auth/login-approvals",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      return listPendingLoginApprovals(app, currentUser.userId);
    }
  );

  app.post<{ Params: { approvalId: string }; Reply: LoginApprovalActionRouteResponse }>(
    "/auth/login-approvals/:approvalId/approve",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const result = await approveLoginApprovalChallenge(
        app,
        currentUser.userId,
        request.params.approvalId,
        readRefreshTokenCookie(request.headers.cookie)
      );

      if (result.status === "not_found") {
        return reply.status(404).send(result.response);
      }

      return reply.status(200).send(result.response);
    }
  );

  app.post<{ Params: { approvalId: string }; Reply: LoginApprovalActionRouteResponse }>(
    "/auth/login-approvals/:approvalId/deny",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const result = await denyLoginApprovalChallenge(
        app,
        currentUser.userId,
        request.params.approvalId,
        readRefreshTokenCookie(request.headers.cookie)
      );

      if (result.status === "not_found") {
        return reply.status(404).send(result.response);
      }

      return reply.status(200).send(result.response);
    }
  );

  app.post<{ Reply: LogoutAuthResponse }>("/auth/logout", async (request, reply) => {
    const refreshToken = readRefreshTokenCookie(request.headers.cookie);

    if (refreshToken) {
      await revokeAuthSession(app, refreshToken);
    }

    clearPublicAuthCookies(reply);

    return reply.status(200).send(buildLogoutAuthResponse());
  });

  app.get<{ Reply: AuthSessionsRouteResponse }>("/auth/sessions", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    return listAuthSessions(
      app,
      currentUser.userId,
      readRefreshTokenCookie(request.headers.cookie)
    );
  });

  app.post<{ Reply: AuthSessionsRevokeAllRouteResponse }>(
    "/auth/sessions/revoke-all",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const response = await revokeAllAuthSessions(app, currentUser.userId);

      clearPublicAuthCookies(reply);

      return reply.status(200).send(response);
    }
  );

  app.post<{ Params: { sessionId: string }; Reply: AuthSessionRevokeRouteResponse }>(
    "/auth/sessions/:sessionId/revoke",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const result = await revokeAuthSessionById(
        app,
        currentUser.userId,
        request.params.sessionId,
        readRefreshTokenCookie(request.headers.cookie)
      );

      if (result.status === "not_found") {
        return reply.status(404).send(result.response);
      }

      const response = result.response;

      if (response.ok && response.data.currentSessionRevoked) {
        clearPublicAuthCookies(reply);
      }

      return reply.status(200).send(response);
    }
  );

  app.post<{ Body: unknown; Reply: BackofficeAuthRouteResponse }>(
    "/auth/backoffice/login",
    authRateLimitOptions(options),
    async (request, reply) => {
      const parsedBody = loginBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send(invalidAuthRequest());
      }

      const result = await loginUser(app, parsedBody.data, {
        emailDelivery: options.emailDelivery,
        webAppUrl: options.webAppUrl
      });

      if (result.status === "invalid") {
        return reply.status(401).send(result.response);
      }

      if (result.status === "mfa_required") {
        const response =
          shouldExposeDevOtpCode() && result.devOtpCode
            ? {
                ok: true as const,
                data: {
                  ...result.response.data,
                  devOtpCode: result.devOtpCode
                }
              }
            : result.response;

        return reply.status(200).send(response);
      }

      if (result.status === "approval_required") {
        clearBackofficeAuthCookies(reply);
        return reply.status(403).send(adminForbidden());
      }

      if (!isBackofficeRole(result.response.data.user.role)) {
        clearBackofficeAuthCookies(reply);
        return reply.status(403).send(adminForbidden());
      }

      const response = attachAccessToken(result.response, options);
      const session = await createAuthSession(
        app,
        response.data.user.id,
        buildAuthSessionRequestMeta(request)
      );

      setBackofficeAuthCookies(reply, {
        accessToken: response.data.accessToken,
        accessTokenMaxAgeSeconds: options.authTokenTtlSeconds,
        refreshToken: session.refreshToken,
        refreshTokenExpiresAt: session.expiresAt
      });

      return reply.status(200).send(buildBackofficeAuthResponse(response.data));
    }
  );

  app.post<{ Reply: AuthMeResponse | ReturnType<typeof unauthorizedAuthRequest> | ReturnType<typeof adminForbidden> }>(
    "/auth/backoffice/refresh",
    authRateLimitOptions(options),
    async (request, reply) => {
      const refreshToken = readRefreshTokenCookie(request.headers.cookie);

      if (!refreshToken) {
        clearBackofficeAccessCookie(reply);
        return reply.status(401).send(unauthorizedAuthRequest());
      }

      const result = await refreshAuthSession(
        app,
        refreshToken,
        buildAuthSessionRequestMeta(request)
      );

      if (result.status === "invalid") {
        clearBackofficeAuthCookies(reply);
        return reply.status(401).send(result.response);
      }

      if (!isBackofficeRole(result.response.data.user.role)) {
        await revokeAuthSession(app, result.refreshToken);
        clearBackofficeAuthCookies(reply);
        return reply.status(403).send(adminForbidden());
      }

      const response = attachAccessToken(result.response, options);

      setBackofficeAuthCookies(reply, {
        accessToken: response.data.accessToken,
        accessTokenMaxAgeSeconds: options.authTokenTtlSeconds,
        refreshToken: result.refreshToken,
        refreshTokenExpiresAt: result.expiresAt
      });

      return reply.status(200).send(buildBackofficeAuthResponse(response.data));
    }
  );

  app.post<{ Reply: LogoutAuthResponse }>("/auth/backoffice/logout", async (request, reply) => {
    const refreshToken = readRefreshTokenCookie(request.headers.cookie);

    if (refreshToken) {
      await revokeAuthSession(app, refreshToken);
    }

    clearBackofficeAuthCookies(reply);

    return reply.status(200).send(buildLogoutAuthResponse());
  });

  app.get<{ Reply: AuthMeResponse | ReturnType<typeof adminForbidden> }>(
    "/auth/backoffice/me",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      if (!isBackofficeRole(currentUser.role)) {
        return reply.status(403).send(adminForbidden());
      }

      return buildAuthMeResponse(currentUser);
    }
  );

  app.get<{ Reply: BackofficeCsrfRouteResponse }>(
    "/auth/backoffice/csrf",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      if (!isBackofficeRole(currentUser.role)) {
        return reply.status(403).send(adminForbidden());
      }

      const csrfToken = createBackofficeCsrfToken();

      reply.header("set-cookie", serializeBackofficeCsrfCookie(csrfToken));

      return {
        ok: true,
        data: {
          csrfToken
        }
      };
    }
  );

  app.get<{ Reply: PublicCsrfRouteResponse | ReturnType<typeof unauthorizedAuthRequest> }>(
    "/auth/csrf",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const csrfToken = createPublicCsrfToken();

      reply.header("set-cookie", serializePublicCsrfCookie(csrfToken));

      return {
        ok: true,
        data: {
          csrfToken
        }
      };
    }
  );

  app.post<{ Body: unknown; Reply: PasswordResetRequestRouteResponse }>(
    "/auth/password-reset/request",
    authRateLimitOptions(options),
    async (request, reply) => {
      const parsedBody = passwordResetRequestSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send(invalidAuthRequest());
      }

      const result = await requestPasswordReset(app, parsedBody.data, {
        emailDelivery: options.emailDelivery,
        webAppUrl: options.webAppUrl
      });

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

      clearPublicAuthCookies(reply);

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

      const result = await requestEmailVerification(app, parsedBody.data, {
        emailDelivery: options.emailDelivery,
        webAppUrl: options.webAppUrl
      });

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

function setPublicAuthCookies(
  reply: FastifyReply,
  input: {
    accessToken: string;
    accessTokenMaxAgeSeconds: number;
    refreshToken: string;
    refreshTokenExpiresAt: Date;
  }
): void {
  reply.header("set-cookie", [
    serializeRefreshTokenCookie(input.refreshToken, {
      expiresAt: input.refreshTokenExpiresAt
    }),
    serializePublicAccessTokenCookie(input.accessToken, {
      maxAgeSeconds: input.accessTokenMaxAgeSeconds
    }),
    serializePublicCsrfCookie(createPublicCsrfToken())
  ]);
}

function clearRefreshTokenCookie(reply: FastifyReply): void {
  reply.header("set-cookie", serializeExpiredRefreshTokenCookie());
}

function clearPublicAuthCookies(reply: FastifyReply): void {
  reply.header("set-cookie", [
    serializeExpiredRefreshTokenCookie(),
    serializeExpiredPublicAccessTokenCookie(),
    serializeExpiredPublicCsrfCookie()
  ]);
}

function setBackofficeAuthCookies(
  reply: FastifyReply,
  input: {
    accessToken: string;
    accessTokenMaxAgeSeconds: number;
    refreshToken: string;
    refreshTokenExpiresAt: Date;
  }
): void {
  reply.header("set-cookie", [
    serializeRefreshTokenCookie(input.refreshToken, {
      expiresAt: input.refreshTokenExpiresAt
    }),
    serializeBackofficeAccessTokenCookie(input.accessToken, {
      maxAgeSeconds: input.accessTokenMaxAgeSeconds
    }),
    serializeBackofficeCsrfCookie(createBackofficeCsrfToken())
  ]);
}

function clearBackofficeAccessCookie(reply: FastifyReply): void {
  reply.header("set-cookie", [
    serializeExpiredBackofficeAccessTokenCookie(),
    serializeExpiredBackofficeCsrfCookie()
  ]);
}

function clearBackofficeAuthCookies(reply: FastifyReply): void {
  reply.header("set-cookie", [
    serializeExpiredRefreshTokenCookie(),
    serializeExpiredBackofficeAccessTokenCookie(),
    serializeExpiredBackofficeCsrfCookie()
  ]);
}

function buildBackofficeAuthResponse(input: {
  profile: SafeAuthProfile;
  user: SafeAuthUser;
}): AuthMeResponse {
  return {
    ok: true,
    data: {
      profile: input.profile,
      user: input.user
    }
  };
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



