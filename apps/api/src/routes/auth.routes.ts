import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  RouteShorthandOptions
} from "fastify";
import { CURRENT_TERMS_VERSION, type ApiFailure } from "@babyloop/shared";
import { users } from "@babyloop/database/schema";
import { eq } from "drizzle-orm";
import {
  accountDeletionConfirmSchema,
  accountDeletionRequestSchema,
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
  registerBodySchema,
  sessionRevokeAllSchema,
  summarizeAuthValidationIssues
} from "../schemas/auth.schemas.js";
import { requireCurrentUser } from "../services/auth-context.service.js";
import {
  attachAccessToken,
  authenticateExistingBackofficeGoogleUser,
  authenticateGoogleUser,
  buildAuthMeResponse,
  buildLogoutAuthResponse,
  changePassword,
  confirmEmailVerification,
  confirmPasswordReset,
  createAuthSession,
  getMfaStatus,
  invalidAuthRequest,
  isGoogleLegalTermsRequiredError,
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
  confirmAccountDeletion,
  requestAccountDeletion,
  type AccountDeletionConfirmResponse,
  type AccountDeletionRequestResponse
} from "../services/account-deletion.service.js";
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
  createGoogleOAuthState,
  defaultGoogleOAuthClient,
  isGoogleOAuthConfigured,
  readGoogleOAuthStateCookie,
  readGoogleOAuthTermsCookie,
  serializeExpiredGoogleOAuthStateCookie,
  serializeExpiredGoogleOAuthTermsCookie,
  serializeGoogleOAuthStateCookie,
  serializeGoogleOAuthTermsCookie,
  verifyGoogleOAuthState,
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
  readBackofficeRefreshTokenCookie,
  serializeBackofficeRefreshTokenCookie,
  serializeExpiredBackofficeRefreshTokenCookie
} from "../utils/backoffice-refresh-token.js";
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
import { trackServerAnalyticsEvent } from "../services/product-analytics.service.js";
import { resolveTrustedClientIp } from "../utils/trusted-client-ip.js";
import { buildAuthRateLimitKey } from "../utils/auth-rate-limit.js";
import type { BackofficeAccessMode } from "../utils/access-token.js";

type AuthRouteOptions = AuthTokenOptions & {
  backofficeAppUrl?: string;
  emailDelivery: EmailDeliveryService;
  googleOAuth?: GoogleOAuthConfig;
  googleOAuthClient?: GoogleOAuthClient;
  uploadRoot: string;
  webAppUrl: string;
};

type PasswordResetRequestRouteResponse =
  | PasswordResetRequestResponse
  | ReturnType<typeof invalidAuthRequest>;

type LoginRouteResponse = AuthResponse | MfaChallengeResponse | LoginApprovalRequiredResponse;

type BackofficeAuthSuccess = {
  ok: true;
  data: {
    accessMode: BackofficeAccessMode;
    profile: SafeAuthProfile;
    user: SafeAuthUser;
  };
};

type BackofficeAuthRouteResponse =
  | BackofficeAuthSuccess
  | MfaChallengeResponse
  | ReturnType<typeof adminForbidden>;

type BackofficeCsrfRouteResponse =
  | { ok: true; data: { csrfToken: string } }
  | ReturnType<typeof adminForbidden>;

type AuthClientType = "web" | "mobile" | "backoffice";

type GoogleOAuthCallbackStage =
  | "exchange_token"
  | "fetch_userinfo"
  | "validate_google_profile"
  | "authenticate_backoffice_user"
  | "create_backoffice_session"
  | "attach_backoffice_token"
  | "set_backoffice_cookies"
  | "redirect_backoffice_success";

const SAFE_GOOGLE_OAUTH_ERROR_CODES = new Set([
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENETUNREACH",
  "ETIMEDOUT"
]);
const SAFE_GOOGLE_OAUTH_ERROR_NAMES = new Set([
  "AbortError",
  "AggregateError",
  "Error",
  "FetchError",
  "PostgresError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "TimeoutError",
  "TypeError",
  "URIError"
]);

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

function resolveAnalyticsPlatform(clientType: AuthClientType): "web" | "mobile" {
  return clientType === "mobile" ? "mobile" : "web";
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
type AuthSessionsRevokeAllRouteResponse =
  | AuthSessionsRevokeAllResponse
  | ReturnType<typeof invalidAuthRequest>;

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

type AccountDeletionRequestRouteResponse =
  | AccountDeletionRequestResponse
  | ApiFailure;

type AccountDeletionConfirmRouteResponse =
  | AccountDeletionConfirmResponse
  | ApiFailure;

export function registerAuthRoutes(app: FastifyInstance, options: AuthRouteOptions): void {
  app.post<{ Body: unknown; Reply: AuthResponse }>(
    "/auth/register",
    authRateLimitOptions(options),
    async (request, reply) => {
      const parsedBody = registerBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        request.log.info({
          event: "auth_request_validation_failed",
          issueCount: parsedBody.error.issues.length,
          issues: summarizeAuthValidationIssues(parsedBody.error),
          route: "/api/v1/auth/register",
          validationStage: "register_body_schema"
        }, "Auth request validation failed.");
        return reply.status(400).send(invalidAuthRequest());
      }

      const clientType = resolveAuthClientType(request);
      const result = await registerUser(app, parsedBody.data, {
        emailDelivery: options.emailDelivery,
        legalAcceptanceSource: clientType === "mobile" ? "mobile_password" : "web_password",
        webAppUrl: options.webAppUrl
      });

      if (result.status === "duplicate") {
        return reply.status(409).send(result.response);
      }

      const session = await createAuthSession(
        app,
        result.response.data.user.id,
        buildAuthSessionRequestMeta(request)
      );
      const response = attachAccessToken(result.response, options, session.id);
      response.data.emailVerificationDelivery = result.emailVerificationDelivery;
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

      setPublicAuthCookies(reply, {
        accessToken: response.data.accessToken,
        accessTokenMaxAgeSeconds: options.authTokenTtlSeconds,
        refreshToken: session.refreshToken,
        refreshTokenExpiresAt: session.expiresAt
      });
      void trackServerAnalyticsEvent(app, {
        eventName: "registration_completed",
        platform: resolveAnalyticsPlatform(resolveAuthClientType(request)),
        profileId: response.data.profile.id,
        properties: {
          authProvider: "password",
          newSession: true
        },
        sessionId: session.id,
        userId: response.data.user.id
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
        void trackServerAnalyticsEvent(app, {
          eventName: "login_failed",
          platform: resolveAnalyticsPlatform(clientType),
          properties: {
            authProvider: "password",
            reasonBucket: "invalid_credentials"
          }
        });
        return reply.status(401).send(result.response);
      }

      if (result.status === "mfa_required") {
        void trackServerAnalyticsEvent(app, {
          eventName: "mfa_challenge_started",
          platform: resolveAnalyticsPlatform(clientType),
          properties: {
            authProvider: "password"
          }
        });
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
        void trackServerAnalyticsEvent(app, {
          eventName: "login_approval_started",
          platform: resolveAnalyticsPlatform(clientType),
          properties: {
            authProvider: "password"
          }
        });
        return reply.status(200).send(result.response);
      }

      const session = await createAuthSession(
        app,
        result.response.data.user.id,
        buildAuthSessionRequestMeta(request)
      );
      const response = attachAccessToken(result.response, options, session.id);

      setPublicAuthCookies(reply, {
        accessToken: response.data.accessToken,
        accessTokenMaxAgeSeconds: options.authTokenTtlSeconds,
        refreshToken: session.refreshToken,
        refreshTokenExpiresAt: session.expiresAt
      });
      void trackServerAnalyticsEvent(app, {
        eventName: "login_completed",
        platform: resolveAnalyticsPlatform(clientType),
        profileId: response.data.profile.id,
        properties: {
          authProvider: "password",
          mfaUsed: false,
          mobileApprovalUsed: false,
          newSession: true
        },
        sessionId: session.id,
        userId: response.data.user.id
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
        void trackServerAnalyticsEvent(app, {
          eventName: "login_approval_started",
          platform: resolveAnalyticsPlatform(resolveAuthClientType(request, "web")),
          properties: {
            authProvider: "password"
          }
        });
        return reply.status(200).send(result.response);
      }

      const session = await createAuthSession(
        app,
        result.response.data.user.id,
        buildAuthSessionRequestMeta(request)
      );
      const response = attachAccessToken(result.response, options, session.id);

      setPublicAuthCookies(reply, {
        accessToken: response.data.accessToken,
        accessTokenMaxAgeSeconds: options.authTokenTtlSeconds,
        refreshToken: session.refreshToken,
        refreshTokenExpiresAt: session.expiresAt
      });
      void trackServerAnalyticsEvent(app, {
        eventName: "mfa_completed",
        platform: resolveAnalyticsPlatform(resolveAuthClientType(request, "web")),
        profileId: response.data.profile.id,
        properties: {
          authProvider: "password"
        },
        sessionId: session.id,
        userId: response.data.user.id
      });
      void trackServerAnalyticsEvent(app, {
        eventName: "login_completed",
        platform: resolveAnalyticsPlatform(resolveAuthClientType(request, "web")),
        profileId: response.data.profile.id,
        properties: {
          authProvider: "password",
          mfaUsed: true,
          mobileApprovalUsed: false,
          newSession: true
        },
        sessionId: session.id,
        userId: response.data.user.id
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

      const session = await createAuthSession(
        app,
        result.response.data.user.id,
        buildAuthSessionRequestMeta(request)
      );
      const response = attachAccessToken(result.response, options, session.id);

      setPublicAuthCookies(reply, {
        accessToken: response.data.accessToken,
        accessTokenMaxAgeSeconds: options.authTokenTtlSeconds,
        refreshToken: session.refreshToken,
        refreshTokenExpiresAt: session.expiresAt
      });
      void trackServerAnalyticsEvent(app, {
        eventName: "login_approval_completed",
        platform: "web",
        profileId: response.data.profile.id,
        properties: {
          authProvider: "password",
          decision: "approved"
        },
        sessionId: session.id,
        userId: response.data.user.id
      });
      void trackServerAnalyticsEvent(app, {
        eventName: "login_completed",
        platform: "web",
        profileId: response.data.profile.id,
        properties: {
          authProvider: "password",
          mfaUsed: false,
          mobileApprovalUsed: true,
          newSession: true
        },
        sessionId: session.id,
        userId: response.data.user.id
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

      const response = attachAccessToken(result.response, options, result.sessionId);

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
    const currentUser = typeof app.authenticate === "function" ? await app.authenticate(request) : null;

    if (refreshToken) {
      await revokeAuthSession(app, refreshToken);
    }

    clearPublicAuthCookies(reply);
    void trackServerAnalyticsEvent(app, {
      eventName: "logout_completed",
      platform: "web",
      profileId: currentUser?.profile.id ?? null,
      properties: {
        sourceSurface: "account"
      },
      userId: currentUser?.userId ?? null,
      ...(currentUser ? { sessionId: currentUser.sessionId } : {})
    });

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

  app.post<{ Body: unknown; Reply: AuthSessionsRevokeAllRouteResponse }>(
    "/auth/sessions/revoke-all",
    authRateLimitOptions(options),
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedBody = sessionRevokeAllSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send(invalidAuthRequest());
      }

      const result = await revokeAllAuthSessions(app, currentUser.userId, parsedBody.data);

      if (result.status === "invalid") {
        return reply.status(401).send(result.response);
      }

      clearPublicAuthCookies(reply);

      return reply.status(200).send(result.response);
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

  app.post<{ Body: unknown; Reply: AccountDeletionRequestRouteResponse }>(
    "/auth/account-deletion/request",
    authRateLimitOptions(options),
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedBody = accountDeletionRequestSchema.safeParse(
        request.body ?? {}
      );

      if (!parsedBody.success) {
        return reply.status(400).send(invalidAuthRequest());
      }

      const result = await requestAccountDeletion(
        app,
        currentUser,
        parsedBody.data,
        {
          emailDelivery: options.emailDelivery
        }
      );

      if (result.status === "forbidden") {
        return reply.status(403).send(result.response);
      }

      if (result.status === "not_found") {
        return reply.status(404).send(result.response);
      }

      if (result.status === "password_required") {
        return reply.status(400).send(result.response);
      }

      if (result.status === "invalid_password") {
        return reply.status(401).send(result.response);
      }

      const response =
        shouldExposeDevOtpCode()
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
  );

  app.post<{ Body: unknown; Reply: AccountDeletionConfirmRouteResponse }>(
    "/auth/account-deletion/confirm",
    authRateLimitOptions(options),
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const parsedBody = accountDeletionConfirmSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send(invalidAuthRequest());
      }

      const result = await confirmAccountDeletion(
        app,
        currentUser,
        parsedBody.data,
        {
          uploadRoot: options.uploadRoot
        }
      );

      if (result.status === "forbidden") {
        return reply.status(403).send(result.response);
      }

      if (result.status === "not_found") {
        return reply.status(404).send(result.response);
      }

      if (result.status === "invalid_challenge") {
        return reply.status(400).send(result.response);
      }

      clearPublicAuthCookies(reply);

      return reply.status(200).send(result.response);
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

      const accessMode = resolveBackofficeAccessMode(result.response.data.user.role);

      if (!accessMode) {
        clearBackofficeAuthCookies(reply);
        return reply.status(403).send(adminForbidden());
      }

      const session = await createAuthSession(
        app,
        result.response.data.user.id,
        buildAuthSessionRequestMeta(request)
      );
      const response = attachAccessToken(result.response, options, session.id, {
        backofficeAccessMode: accessMode
      });

      setBackofficeAuthCookies(reply, {
        accessToken: response.data.accessToken,
        accessTokenMaxAgeSeconds: options.authTokenTtlSeconds,
        refreshToken: session.refreshToken,
        refreshTokenExpiresAt: session.expiresAt
      });

      return reply.status(200).send(buildBackofficeAuthResponse(response.data, accessMode));
    }
  );

  app.post<{ Reply: BackofficeAuthSuccess | ReturnType<typeof unauthorizedAuthRequest> | ReturnType<typeof adminForbidden> }>(
    "/auth/backoffice/refresh",
    authRateLimitOptions(options),
    async (request, reply) => {
      const refreshToken = readBackofficeRefreshTokenCookie(request.headers.cookie);

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

      const accessMode = resolveBackofficeAccessMode(result.response.data.user.role);

      if (!accessMode) {
        await revokeAuthSession(app, result.refreshToken);
        clearBackofficeAuthCookies(reply);
        return reply.status(403).send(adminForbidden());
      }

      const response = attachAccessToken(result.response, options, result.sessionId, {
        backofficeAccessMode: accessMode
      });

      setBackofficeAuthCookies(reply, {
        accessToken: response.data.accessToken,
        accessTokenMaxAgeSeconds: options.authTokenTtlSeconds,
        refreshToken: result.refreshToken,
        refreshTokenExpiresAt: result.expiresAt
      });

      return reply.status(200).send(buildBackofficeAuthResponse(response.data, accessMode));
    }
  );

  app.post<{ Reply: LogoutAuthResponse }>("/auth/backoffice/logout", async (request, reply) => {
    const refreshToken = readBackofficeRefreshTokenCookie(request.headers.cookie);

    if (refreshToken) {
      await revokeAuthSession(app, refreshToken);
    }

    clearBackofficeAuthCookies(reply);

    return reply.status(200).send(buildLogoutAuthResponse());
  });

  app.get<{ Reply: BackofficeAuthSuccess | ReturnType<typeof adminForbidden> }>(
    "/auth/backoffice/me",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const accessMode = currentUser.backofficeAccessMode ??
        (isBackofficeRole(currentUser.role) ? "staff" : null);

      if (!accessMode) {
        return reply.status(403).send(adminForbidden());
      }

      return buildBackofficeAuthResponse({
        profile: currentUser.profile,
        user: {
          id: currentUser.userId,
          email: currentUser.email,
          emailVerifiedAt: currentUser.emailVerifiedAt,
          role: currentUser.role
        }
      }, accessMode);
    }
  );

  app.get<{ Reply: BackofficeCsrfRouteResponse }>(
    "/auth/backoffice/csrf",
    async (request, reply) => {
      const currentUser = await requireCurrentUser(app, request, reply);

      if (!currentUser) {
        return reply;
      }

      const accessMode = currentUser.backofficeAccessMode ??
        (isBackofficeRole(currentUser.role) ? "staff" : null);

      if (!accessMode) {
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

      const result = await changePassword(app, currentUser.userId, currentUser.sessionId, parsedBody.data);

      if (result.status === "invalid") {
        return reply.status(401).send(result.response);
      }

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

  app.get<{ Querystring: Record<string, unknown> }>("/auth/google/start", async (request, reply) => {
    if (!isGoogleOAuthConfigured(options.googleOAuth)) {
      return reply.status(503).send(googleOAuthUnavailableResponse());
    }

    const state = createGoogleOAuthState({
      audience: "public_web",
      authSecret: options.authSecret
    });
    const authorizationUrl = buildGoogleAuthorizationUrl(options.googleOAuth, state);
    const termsAccepted = readQueryStringValue(request.query.termsAccepted) === "true";
    const termsVersion = readQueryStringValue(request.query.termsVersion);
    const cookies = [serializeGoogleOAuthStateCookie(state)];

    if (termsAccepted && termsVersion === CURRENT_TERMS_VERSION) {
      cookies.push(serializeGoogleOAuthTermsCookie(state, termsVersion));
    } else {
      cookies.push(serializeExpiredGoogleOAuthTermsCookie());
    }

    reply.header("set-cookie", cookies);

    return redirect(reply, authorizationUrl);
  });

  app.get<{ Querystring: Record<string, unknown> }>(
    "/auth/backoffice/google/start",
    async (request, reply) => {
      if (!isGoogleOAuthConfigured(options.googleOAuth) || !options.backofficeAppUrl) {
        if (options.backofficeAppUrl) {
          return redirectToBackofficeOAuthError(
            reply,
            options.backofficeAppUrl,
            "google_auth_unavailable"
          );
        }
        return reply.status(503).send(googleOAuthUnavailableResponse());
      }

      const state = createGoogleOAuthState({
        audience: "backoffice",
        authSecret: options.authSecret,
        next: readQueryStringValue(request.query.next)
      });

      reply.header("set-cookie", [
        serializeGoogleOAuthStateCookie(state),
        serializeExpiredGoogleOAuthTermsCookie()
      ]);

      return redirect(reply, buildGoogleAuthorizationUrl(options.googleOAuth, state));
    }
  );

  app.get<{ Querystring: Record<string, unknown> }>("/auth/google/callback", async (request, reply) => {
    let googleOAuthCallbackStage: GoogleOAuthCallbackStage = "exchange_token";
    const cookieState = readGoogleOAuthStateCookie(request.headers.cookie);
    const queryState = readQueryStringValue(request.query.state);
    const parsedCookieState = cookieState
      ? verifyGoogleOAuthState(cookieState, options.authSecret, { allowConsumed: true })
      : null;
    const failureAudience = parsedCookieState?.audience ?? "public_web";

    if (!isGoogleOAuthConfigured(options.googleOAuth)) {
      if (failureAudience === "backoffice" && options.backofficeAppUrl) {
        return redirectToBackofficeOAuthError(
          reply,
          options.backofficeAppUrl,
          "google_auth_unavailable"
        );
      }
      return redirectToGoogleAuthUnavailable(reply, options.webAppUrl);
    }

    const code = readQueryStringValue(request.query.code);
    const providerError = readQueryStringValue(request.query.error);
    const parsedState = cookieState && queryState && cookieState === queryState
      ? verifyGoogleOAuthState(queryState, options.authSecret, { consume: true }) ??
        readLegacyPublicOAuthState(queryState)
      : null;

    if (!parsedState || (!code && providerError !== "access_denied")) {
      if (failureAudience === "backoffice" && options.backofficeAppUrl) {
        return redirectToBackofficeOAuthError(
          reply,
          options.backofficeAppUrl,
          "google_auth_failed",
          parsedCookieState?.next
        );
      }
      return redirectToGoogleAuthFailure(reply, options.googleOAuth.webAppUrl);
    }

    if (providerError === "access_denied") {
      if (parsedState.audience === "backoffice" && options.backofficeAppUrl) {
        return redirectToBackofficeOAuthError(
          reply,
          options.backofficeAppUrl,
          "access_denied",
          parsedState.next
        );
      }
      return redirectToGoogleAuthFailure(reply, options.googleOAuth.webAppUrl);
    }

    try {
      const googleClient = options.googleOAuthClient ?? defaultGoogleOAuthClient;
      googleOAuthCallbackStage = "exchange_token";
      const tokens = await googleClient.exchangeCodeForTokens(code!, options.googleOAuth);
      googleOAuthCallbackStage = "fetch_userinfo";
      const googleProfile = await googleClient.fetchUserInfo(tokens.accessToken);

      googleOAuthCallbackStage = "validate_google_profile";
      if (!googleProfile.email || googleProfile.email_verified === false) {
        if (parsedState.audience === "backoffice" && options.backofficeAppUrl) {
          return redirectToBackofficeOAuthError(
            reply,
            options.backofficeAppUrl,
            "google_auth_failed",
            parsedState.next
          );
        }
        return redirectToGoogleAuthFailure(reply, options.googleOAuth.webAppUrl);
      }

      if (parsedState.audience === "backoffice") {
        if (!options.backofficeAppUrl) {
          return redirectToGoogleAuthFailure(reply, options.googleOAuth.webAppUrl);
        }

        googleOAuthCallbackStage = "authenticate_backoffice_user";
        const result = await authenticateExistingBackofficeGoogleUser(app, googleProfile);
        if (result.status !== "ok") {
          return redirectToBackofficeOAuthError(
            reply,
            options.backofficeAppUrl,
            result.status,
            parsedState.next
          );
        }

        googleOAuthCallbackStage = "create_backoffice_session";
        const session = await createAuthSession(
          app,
          result.response.data.user.id,
          buildAuthSessionRequestMeta(request)
        );
        googleOAuthCallbackStage = "attach_backoffice_token";
        const response = attachAccessToken(result.response, options, session.id, {
          backofficeAccessMode: result.accessMode
        });

        googleOAuthCallbackStage = "set_backoffice_cookies";
        setBackofficeAuthCookies(reply, {
          accessToken: response.data.accessToken,
          accessTokenMaxAgeSeconds: options.authTokenTtlSeconds,
          refreshToken: session.refreshToken,
          refreshTokenExpiresAt: session.expiresAt
        }, [
          serializeExpiredGoogleOAuthStateCookie(),
          serializeExpiredGoogleOAuthTermsCookie()
        ]);

        googleOAuthCallbackStage = "redirect_backoffice_success";
        return redirect(
          reply,
          buildBackofficeGoogleAuthSuccessRedirect(options.backofficeAppUrl, parsedState.next)
        );
      }

      const legalTermsCookie = readGoogleOAuthTermsCookie(request.headers.cookie, cookieState!);
      const normalizedGoogleEmail = googleProfile.email.trim().toLowerCase();
      const [existingPublicUser] = await app.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, normalizedGoogleEmail))
        .limit(1);
      const result = await authenticateGoogleUser(app, googleProfile, {
        ...(legalTermsCookie
          ? {
              legalTermsAcceptance: {
                source: "google_oauth" as const,
                termsVersion: legalTermsCookie.termsVersion
              }
            }
          : {})
      });
      const session = await createAuthSession(
        app,
        result.data.user.id,
        buildAuthSessionRequestMeta(request)
      );
      const response = attachAccessToken(result, options, session.id);

      reply.header("set-cookie", [
        serializeRefreshTokenCookie(session.refreshToken, {
          expiresAt: session.expiresAt
        }),
        serializePublicAccessTokenCookie(response.data.accessToken, {
          maxAgeSeconds: options.authTokenTtlSeconds
        }),
        serializePublicCsrfCookie(createPublicCsrfToken()),
        serializeExpiredGoogleOAuthStateCookie(),
        serializeExpiredGoogleOAuthTermsCookie()
      ]);
      if (!existingPublicUser) {
        void trackServerAnalyticsEvent(app, {
          eventName: "registration_completed",
          platform: "web",
          profileId: response.data.profile.id,
          properties: {
            authProvider: "google",
            newSession: true
          },
          sessionId: session.id,
          userId: response.data.user.id
        });
      }
      void trackServerAnalyticsEvent(app, {
        eventName: "login_completed",
        platform: "web",
        profileId: response.data.profile.id,
        properties: {
          authProvider: "google",
          mfaUsed: false,
          mobileApprovalUsed: false,
          newSession: true
        },
        sessionId: session.id,
        userId: response.data.user.id
      });

      return redirect(reply, buildGoogleAuthSuccessRedirect(options.googleOAuth.webAppUrl));
    } catch (error) {
      if (parsedState.audience === "backoffice" && options.backofficeAppUrl) {
        request.log.warn(
          buildGoogleOAuthCallbackDiagnostic(googleOAuthCallbackStage, error),
          "Backoffice Google OAuth callback failed."
        );
        return redirectToBackofficeOAuthError(
          reply,
          options.backofficeAppUrl,
          "google_auth_failed",
          parsedState.next
        );
      }
      if (isGoogleLegalTermsRequiredError(error)) {
        return redirectToGoogleTermsRequired(reply, options.googleOAuth.webAppUrl);
      }

      request.log.warn("Google OAuth callback failed.");
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

function buildGoogleOAuthCallbackDiagnostic(
  oauthStage: GoogleOAuthCallbackStage,
  error: unknown
): {
  oauthStage: GoogleOAuthCallbackStage;
  errorName: string;
  errorCode?: string;
} {
  const errorCode = safeGoogleOAuthErrorCode(error);

  return {
    oauthStage,
    errorName: safeGoogleOAuthErrorName(error),
    ...(errorCode ? { errorCode } : {})
  };
}

function safeGoogleOAuthErrorName(error: unknown): string {
  if (!(error instanceof Error)) {
    return "UnknownError";
  }

  return SAFE_GOOGLE_OAUTH_ERROR_NAMES.has(error.name) ? error.name : "Error";
}

function safeGoogleOAuthErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;
  if (typeof code !== "string") {
    return undefined;
  }

  const normalizedCode = code.trim().toUpperCase();
  if (
    SAFE_GOOGLE_OAUTH_ERROR_CODES.has(normalizedCode) ||
    /^UND_ERR_[A-Z_]{1,64}$/u.test(normalizedCode) ||
    /^[0-9A-Z]{5}$/u.test(normalizedCode)
  ) {
    return normalizedCode;
  }

  return undefined;
}

function authRateLimitOptions(options: AuthTokenOptions): RouteShorthandOptions {
  return {
    config: {
      rateLimit: {
        max: options.authRateLimitMax,
        timeWindow: options.authRateLimitWindowSeconds * 1000,
        keyGenerator(request) {
          return buildAuthRateLimitKey({
            authSecret: options.authSecret,
            body: request.body,
            clientIp: resolveTrustedClientIp(request),
            endpoint: request.routeOptions.url ?? request.url,
          });
        }
      }
    }
  };
}

function buildAuthSessionRequestMeta(request: FastifyRequest): AuthSessionRequestMeta {
  return {
    ipAddress: resolveTrustedClientIp(request) ?? null,
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
  },
  additionalCookies: string[] = []
): void {
  reply.header("set-cookie", [
    serializeBackofficeRefreshTokenCookie(input.refreshToken, {
      expiresAt: input.refreshTokenExpiresAt
    }),
    serializeBackofficeAccessTokenCookie(input.accessToken, {
      maxAgeSeconds: input.accessTokenMaxAgeSeconds
    }),
    serializeBackofficeCsrfCookie(createBackofficeCsrfToken()),
    ...additionalCookies
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
    serializeExpiredBackofficeRefreshTokenCookie(),
    serializeExpiredBackofficeAccessTokenCookie(),
    serializeExpiredBackofficeCsrfCookie()
  ]);
}

function buildBackofficeAuthResponse(input: {
  profile: SafeAuthProfile;
  user: SafeAuthUser;
}, accessMode: BackofficeAccessMode): BackofficeAuthSuccess {
  return {
    ok: true,
    data: {
      accessMode,
      profile: input.profile,
      user: input.user
    }
  };
}

function resolveBackofficeAccessMode(role: string): BackofficeAccessMode | null {
  if (role.toLowerCase() === "user") {
    return "preview";
  }

  return isBackofficeRole(role) ? "staff" : null;
}

function readQueryStringValue(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  return value;
}

function readLegacyPublicOAuthState(state: string) {
  // A ten-minute compatibility bridge for public OAuth handshakes initiated
  // before signed audience states were deployed. New starts never emit this form.
  if (!state || state.includes(".") || state.length > 128) return null;
  return {
    audience: "public_web" as const,
    issuedAt: Math.floor(Date.now() / 1000),
    next: null,
    nonce: state
  };
}

function redirectToGoogleAuthFailure(reply: FastifyReply, webAppUrl: string): void {
  reply.header("set-cookie", [
    serializeExpiredGoogleOAuthStateCookie(),
    serializeExpiredGoogleOAuthTermsCookie()
  ]);
  return redirect(reply, buildWebAuthModalRedirect(webAppUrl, {
    error: "google_auth_failed",
    mode: "login"
  }));
}

function redirectToGoogleTermsRequired(reply: FastifyReply, webAppUrl: string): void {
  reply.header("set-cookie", [
    serializeExpiredGoogleOAuthStateCookie(),
    serializeExpiredGoogleOAuthTermsCookie()
  ]);
  return redirect(reply, buildWebAuthModalRedirect(webAppUrl, {
    error: "legal_terms_required",
    mode: "register",
    provider: "google"
  }));
}

function redirectToGoogleAuthUnavailable(reply: FastifyReply, webAppUrl: string): void {
  reply.header("set-cookie", [
    serializeExpiredGoogleOAuthStateCookie(),
    serializeExpiredGoogleOAuthTermsCookie()
  ]);
  return redirect(reply, buildWebAuthModalRedirect(webAppUrl, {
    error: "google_auth_unavailable",
    mode: "login"
  }));
}

function buildGoogleAuthSuccessRedirect(webAppUrl: string): string {
  const redirectUrl = new URL("/auth/callback", webAppUrl);
  redirectUrl.searchParams.set("status", "success");
  return redirectUrl.toString();
}

type BackofficeOAuthError =
  | "google_auth_failed"
  | "google_auth_unavailable"
  | "google_account_not_found"
  | "google_account_not_linked"
  | "account_disabled"
  | "access_denied"
  | "session_establishment_failed";

function redirectToBackofficeOAuthError(
  reply: FastifyReply,
  backofficeAppUrl: string,
  error: BackofficeOAuthError,
  next?: string | null
): void {
  reply.header("set-cookie", [
    serializeExpiredGoogleOAuthStateCookie(),
    serializeExpiredGoogleOAuthTermsCookie(),
    serializeExpiredBackofficeAccessTokenCookie(),
    serializeExpiredBackofficeRefreshTokenCookie(),
    serializeExpiredBackofficeCsrfCookie()
  ]);
  const redirectUrl = new URL("/login", backofficeAppUrl);
  redirectUrl.searchParams.set("authError", error);
  if (next && next !== "/") redirectUrl.searchParams.set("next", next);
  return redirect(reply, redirectUrl.toString());
}

function buildBackofficeGoogleAuthSuccessRedirect(
  backofficeAppUrl: string,
  next: string | null
): string {
  const redirectUrl = new URL("/auth/callback", backofficeAppUrl);
  redirectUrl.searchParams.set("status", "success");
  if (next && next !== "/") redirectUrl.searchParams.set("next", next);
  return redirectUrl.toString();
}

function buildWebAuthModalRedirect(webAppUrl: string, input: {
  error: "google_auth_failed" | "google_auth_unavailable" | "legal_terms_required";
  mode: "login" | "register";
  provider?: "google";
}): string {
  const redirectUrl = new URL("/", webAppUrl);
  redirectUrl.searchParams.set("auth", input.mode);
  redirectUrl.searchParams.set("authError", input.error);

  if (input.provider) {
    redirectUrl.searchParams.set("provider", input.provider);
  }

  return redirectUrl.toString();
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
