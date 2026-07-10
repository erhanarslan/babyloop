import {
  authAccounts,
  emailVerificationTokens,
  mfaOtpChallenges,
  passwordResetTokens,
  profiles,
  sessions,
  users
} from "@babyloop/database/schema";
import type { Database } from "@babyloop/database";
import type { ApiFailure, ApiResponse, ApiSuccess } from "@babyloop/shared";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { CurrentUser } from "../plugins/auth.plugin.js";
import type {
  LoginBody,
  EmailVerificationConfirmBody,
  EmailVerificationRequestBody,
  MfaPreferenceBody,
  MfaVerifyBody,
  PasswordChangeBody,
  PasswordResetConfirmBody,
  PasswordResetRequestBody,
  RegisterBody
} from "../schemas/auth.schemas.js";
import { signAccessToken } from "../utils/access-token.js";
import {
  createRefreshToken,
  createRefreshTokenExpiresAt,
  hashRefreshToken
} from "../utils/refresh-token.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import {
  createPasswordResetToken,
  createPasswordResetTokenExpiresAt,
  hashPasswordResetToken,
  PASSWORD_RESET_TOKEN_TTL_SECONDS
} from "../utils/password-reset-token.js";
import {
  createEmailVerificationToken,
  EMAIL_VERIFICATION_TOKEN_TTL_SECONDS,
  createEmailVerificationTokenExpiresAt,
  hashEmailVerificationToken
} from "../utils/email-verification-token.js";
import {
  buildEmailVerificationUrl,
  buildPasswordResetUrl,
  type EmailDeliveryService
} from "./email-delivery.service.js";
import type { GoogleUserInfo } from "./google-oauth.service.js";
import {
  createMfaOtpCode,
  createMfaOtpExpiresAt,
  hashMfaOtpCode,
  MFA_OTP_TTL_SECONDS
} from "../utils/mfa-otp.js";
import { safePlainTextFallback } from "./text-safety.service.js";
import {
  buildLoginApprovalRequiredResponse,
  canUseMobileLoginApprovalForProfile,
  createLoginApprovalChallenge,
  type LoginApprovalRequiredResponse
} from "./login-approval.service.js";

export type SafeAuthUser = {
  id: string;
  email: string;
  emailVerifiedAt: string | null;
  role: string;
};

export type SafeAuthProfile = {
  id: string;
  displayName: string;
  locationCity: string | null;
};

export type AuthTokenOptions = {
  authRateLimitMax: number;
  authRateLimitWindowSeconds: number;
  authSecret: string;
  authTokenTtlSeconds: number;
};

export type AuthSessionRequestMeta = {
  ipAddress: string | null;
  userAgent: string | null;
};

type AuthPayload = {
  accessToken: string;
  user: SafeAuthUser;
  profile: SafeAuthProfile;
};

type AuthSuccess = ApiSuccess<AuthPayload>;

export type AuthResponse = ApiResponse<AuthPayload>;

export type MfaChallengeResponse = ApiSuccess<{
  challengeId: string;
  devOtpCode?: string;
  mfaRequired: true;
}>;

export type AuthMeResponse = ApiResponse<{
  user: SafeAuthUser;
  profile: SafeAuthProfile;
}>;

export type LogoutAuthResponse = ApiSuccess<{
  loggedOut: true;
}>;

export type PasswordResetRequestResponse = ApiSuccess<{
  requested: true;
  devResetToken?: string;
}>;

export type PasswordResetConfirmResponse = ApiResponse<{
  passwordReset: true;
}>;

export type PasswordChangeResponse = ApiResponse<{
  passwordChanged: true;
}>;

export type EmailVerificationRequestResponse = ApiSuccess<{
  requested: true;
  devEmailVerificationToken?: string;
}>;

export type EmailVerificationConfirmResponse = ApiResponse<{
  emailVerified: true;
}>;

export type MfaVerifyResponse = AuthResponse | LoginApprovalRequiredResponse;

export type MfaStatusPayload = {
  delivery: "email";
  method: "email_otp";
  mfaEnabled: boolean;
};

export type MfaStatusResponse = ApiResponse<MfaStatusPayload>;

export type MfaPreferenceResponse = ApiResponse<MfaStatusPayload & {
  updated: true;
}>;

export type SafeAuthSession = {
  id: string;
  current: boolean;
  deviceLabel: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export type AuthSessionsResponse = ApiResponse<{
  currentSessionId: string | null;
  sessions: SafeAuthSession[];
}>;

export type AuthSessionRevokeResponse = ApiResponse<{
  currentSessionRevoked: boolean;
  revoked: true;
  sessionId: string;
}>;

export type AuthSessionsRevokeAllResponse = ApiResponse<{
  revokedCount: number;
}>;

type AuthSessionCreation = {
  expiresAt: Date;
  refreshToken: string;
};

type EmailDeliveryOptions = {
  emailDelivery: EmailDeliveryService;
  webAppUrl: string;
};

type LoginOptions = EmailDeliveryOptions & {
  requestMeta?: AuthSessionRequestMeta;
  requireMobileLoginApproval?: boolean;
};

type MfaVerifyOptions = {
  requestMeta?: AuthSessionRequestMeta;
  requireMobileLoginApproval?: boolean;
};

type RefreshAuthSessionResult =
  | {
      status: "ok";
      response: AuthSuccess;
      expiresAt: Date;
      refreshToken: string;
    }
  | {
      status: "invalid";
      response: ApiFailure;
    };

export async function registerUser(
  app: FastifyInstance,
  body: RegisterBody,
  options: EmailDeliveryOptions
): Promise<
  | { status: "created"; response: AuthSuccess; devEmailVerificationToken: string }
  | { status: "duplicate"; response: ApiFailure }
> {
  const existingUser = await findUserByEmail(app, body.email);

  if (existingUser) {
    return duplicateEmailRegistration();
  }

  const passwordHash = await hashPassword(body.password);

  try {
    const emailVerificationToken = createEmailVerificationToken();
    const created = await app.db.transaction(async (tx) => {
      const [createdUser] = await tx
        .insert(users)
        .values({
          email: body.email,
          passwordHash,
          role: "user"
        })
        .returning({
          id: users.id,
          email: users.email,
          emailVerifiedAt: users.emailVerifiedAt,
          role: users.role
        });

      if (!createdUser) {
        throw new Error("User insert failed.");
      }

      const [createdProfile] = await tx
        .insert(profiles)
        .values({
          userId: createdUser.id,
          displayName: body.displayName,
          locationCity: body.locationCity
        })
        .returning({
          id: profiles.id,
          displayName: profiles.displayName,
          locationCity: profiles.locationCity
        });

      if (!createdProfile) {
        throw new Error("Profile insert failed.");
      }

      await tx.insert(authAccounts).values({
        email: createdUser.email,
        provider: "password",
        providerAccountId: createdUser.email,
        userId: createdUser.id
      });

      await tx.insert(emailVerificationTokens).values({
        expiresAt: createEmailVerificationTokenExpiresAt(),
        tokenHash: hashEmailVerificationToken(emailVerificationToken),
        userId: createdUser.id
      });

      return {
        profile: createdProfile,
        user: {
          ...createdUser,
          emailVerifiedAt: serializeDate(createdUser.emailVerifiedAt)
        }
      };
    });

    await options.emailDelivery.sendEmailVerificationEmail({
      displayName: created.profile.displayName,
      expiresInSeconds: EMAIL_VERIFICATION_TOKEN_TTL_SECONDS,
      recipientEmail: created.user.email,
      verificationUrl: buildEmailVerificationUrl(options.webAppUrl, emailVerificationToken)
    });

    return {
      status: "created",
      devEmailVerificationToken: emailVerificationToken,
      response: buildAuthResponse(created)
    };
  } catch (error) {
    if (isDuplicateRegistrationConstraint(error)) {
      return duplicateEmailRegistration();
    }

    throw error;
  }
}

export async function loginUser(
  app: FastifyInstance,
  body: LoginBody,
  options: LoginOptions
): Promise<
  | { status: "ok"; response: AuthSuccess }
  | { status: "mfa_required"; response: MfaChallengeResponse; devOtpCode: string }
  | { status: "approval_required"; response: LoginApprovalRequiredResponse }
  | { status: "invalid"; response: ApiFailure }
> {
  const userWithProfile = await findUserWithProfileByEmail(app, body.email);

  if (!userWithProfile || !(await verifyPassword(body.password, userWithProfile.passwordHash))) {
    return {
      status: "invalid",
      response: invalidCredentials()
    };
  }

  if (userWithProfile.mfaEnabled) {
    const otpCode = createMfaOtpCode();
    const [challenge] = await app.db
      .insert(mfaOtpChallenges)
      .values({
        codeHash: hashMfaOtpCode(otpCode),
        expiresAt: createMfaOtpExpiresAt(),
        purpose: "login",
        userId: userWithProfile.id
      })
      .returning({
        id: mfaOtpChallenges.id
      });

    if (!challenge) {
      throw new Error("MFA challenge insert failed.");
    }

    await options.emailDelivery.sendMfaOtpEmail({
      displayName: userWithProfile.displayName,
      expiresInSeconds: MFA_OTP_TTL_SECONDS,
      recipientEmail: userWithProfile.email,
      code: otpCode
    });

    return {
      status: "mfa_required",
      devOtpCode: otpCode,
      response: buildMfaChallengeResponse(challenge.id)
    };
  }

  if (
    options.requireMobileLoginApproval &&
    userWithProfile.mobileLoginApprovalEnabled &&
    await canUseMobileLoginApprovalForProfile(app, userWithProfile.profileId)
  ) {
    const creation = await createLoginApprovalChallenge(
      app,
      userWithProfile.id,
      options.requestMeta ?? { ipAddress: null, userAgent: null }
    );

    return {
      status: "approval_required",
      response: buildLoginApprovalRequiredResponse(creation)
    };
  }

  return {
    status: "ok",
    response: buildAuthResponse({
      profile: {
        id: userWithProfile.profileId,
        displayName: userWithProfile.displayName,
        locationCity: userWithProfile.locationCity
      },
      user: {
        id: userWithProfile.id,
        email: userWithProfile.email,
        emailVerifiedAt: serializeDate(userWithProfile.emailVerifiedAt),
        role: userWithProfile.role
      }
    })
  };
}

export async function verifyMfaLogin(
  app: FastifyInstance,
  body: MfaVerifyBody,
  options: MfaVerifyOptions = {}
): Promise<
  | { status: "ok"; response: AuthSuccess }
  | { status: "approval_required"; response: LoginApprovalRequiredResponse }
  | { status: "invalid"; response: ApiFailure }
> {
  const now = new Date();
  const codeHash = hashMfaOtpCode(body.code);

  const verified = await app.db.transaction(async (tx) => {
    const [challenge] = await tx
      .select({
        id: mfaOtpChallenges.id,
        userId: mfaOtpChallenges.userId,
        email: users.email,
        emailVerifiedAt: users.emailVerifiedAt,
        role: users.role,
        mobileLoginApprovalEnabled: users.mobileLoginApprovalEnabled,
        profileId: profiles.id,
        displayName: profiles.displayName,
        locationCity: profiles.locationCity
      })
      .from(mfaOtpChallenges)
      .innerJoin(users, eq(users.id, mfaOtpChallenges.userId))
      .innerJoin(profiles, eq(profiles.userId, users.id))
      .where(
        and(
          eq(mfaOtpChallenges.id, body.challengeId),
          eq(mfaOtpChallenges.codeHash, codeHash),
          eq(mfaOtpChallenges.purpose, "login"),
          isNull(mfaOtpChallenges.consumedAt),
          gt(mfaOtpChallenges.expiresAt, now)
        )
      )
      .limit(1);

    if (!challenge) {
      return null;
    }

    await tx
      .update(mfaOtpChallenges)
      .set({
        consumedAt: now
      })
      .where(eq(mfaOtpChallenges.id, challenge.id));

    return challenge;
  });

  if (!verified) {
    return {
      status: "invalid",
      response: invalidMfaCode()
    };
  }

  if (
    options.requireMobileLoginApproval &&
    verified.mobileLoginApprovalEnabled &&
    await canUseMobileLoginApprovalForProfile(app, verified.profileId)
  ) {
    const creation = await createLoginApprovalChallenge(
      app,
      verified.userId,
      options.requestMeta ?? { ipAddress: null, userAgent: null }
    );

    return {
      status: "approval_required",
      response: buildLoginApprovalRequiredResponse(creation)
    };
  }

  return {
    status: "ok",
    response: buildAuthResponse({
      profile: {
        id: verified.profileId,
        displayName: verified.displayName,
        locationCity: verified.locationCity
      },
      user: {
        id: verified.userId,
        email: verified.email,
        emailVerifiedAt: serializeDate(verified.emailVerifiedAt),
        role: verified.role
      }
    })
  };
}

export async function getMfaStatus(
  app: FastifyInstance,
  userId: string
): Promise<MfaStatusResponse> {
  const [user] = await app.db
    .select({
      mfaEnabled: users.mfaEnabled
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return buildMfaStatusResponse(Boolean(user?.mfaEnabled));
}

export async function updateMfaPreference(
  app: FastifyInstance,
  userId: string,
  body: MfaPreferenceBody,
  enabled: boolean
): Promise<{ status: "ok"; response: MfaPreferenceResponse } | { status: "invalid"; response: ApiFailure }> {
  const [user] = await app.db
    .select({
      id: users.id,
      passwordHash: users.passwordHash
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || !(await verifyPassword(body.currentPassword, user.passwordHash))) {
    return {
      status: "invalid",
      response: invalidCredentials()
    };
  }

  await app.db
    .update(users)
    .set({
      mfaEnabled: enabled,
      updatedAt: new Date()
    })
    .where(eq(users.id, userId));

  return {
    status: "ok",
    response: buildMfaPreferenceResponse(enabled)
  };
}

export async function authenticateGoogleUser(
  app: FastifyInstance,
  googleProfile: GoogleUserInfo
): Promise<AuthSuccess> {
  const email = normalizeGoogleOAuthEmail(googleProfile);
  const providerAccountId = googleProfile.sub;

  const existingGoogleAccount = await findUserWithProfileByAuthAccount(
    app,
    "google",
    providerAccountId
  );

  if (existingGoogleAccount) {
    return buildAuthResponse({
      profile: {
        id: existingGoogleAccount.profileId,
        displayName: existingGoogleAccount.displayName,
        locationCity: existingGoogleAccount.locationCity
      },
      user: {
        id: existingGoogleAccount.id,
        email: existingGoogleAccount.email,
        emailVerifiedAt: serializeDate(existingGoogleAccount.emailVerifiedAt),
        role: existingGoogleAccount.role
      }
    });
  }

  const displayName = buildGoogleProfileDisplayName(googleProfile, email);

  const createdOrLinked = await app.db.transaction(async (tx) => {
    const [existingUser] = await tx
      .select({
        id: users.id,
        email: users.email,
        emailVerifiedAt: users.emailVerifiedAt,
        role: users.role,
        profileId: profiles.id,
        displayName: profiles.displayName,
        locationCity: profiles.locationCity
      })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      const now = new Date();
      const profile =
        existingUser.profileId && existingUser.displayName
          ? {
              id: existingUser.profileId,
              displayName: existingUser.displayName,
              locationCity: existingUser.locationCity
            }
          : await createProfileForGoogleUser(tx, existingUser.id, displayName);

      await tx
        .update(users)
        .set({
          emailVerifiedAt: existingUser.emailVerifiedAt ?? now,
          updatedAt: now
        })
        .where(eq(users.id, existingUser.id));

      await tx.insert(authAccounts).values({
        email,
        emailVerifiedAt: now,
        provider: "google",
        providerAccountId,
        userId: existingUser.id
      });

      return {
        profile,
        user: {
          id: existingUser.id,
          email: existingUser.email,
          emailVerifiedAt: serializeDate(existingUser.emailVerifiedAt ?? now),
          role: existingUser.role
        }
      };
    }

    const unusablePasswordHash = await hashPassword(createRefreshToken());

    const [createdUser] = await tx
      .insert(users)
      .values({
        email,
        emailVerifiedAt: new Date(),
        passwordHash: unusablePasswordHash,
        role: "user"
      })
      .returning({
        id: users.id,
        email: users.email,
        emailVerifiedAt: users.emailVerifiedAt,
        role: users.role
      });

    if (!createdUser) {
      throw new Error("User insert failed.");
    }

    const profile = await createProfileForGoogleUser(tx, createdUser.id, displayName);

    await tx.insert(authAccounts).values({
      email,
      emailVerifiedAt: new Date(),
      provider: "google",
      providerAccountId,
      userId: createdUser.id
    });

    return {
      profile,
      user: {
        ...createdUser,
        emailVerifiedAt: serializeDate(createdUser.emailVerifiedAt)
      }
    };
  });

  return buildAuthResponse(createdOrLinked);
}

export async function requestPasswordReset(
  app: FastifyInstance,
  body: PasswordResetRequestBody,
  options: EmailDeliveryOptions
): Promise<{ response: PasswordResetRequestResponse; devResetToken?: string }> {
  const now = new Date();
  const user = await findUserByEmail(app, body.email);

  if (!user) {
    return {
      response: buildPasswordResetRequestResponse()
    };
  }

  const resetToken = createPasswordResetToken();

  await app.db.transaction(async (tx) => {
    await tx
      .update(passwordResetTokens)
      .set({
        consumedAt: now
      })
      .where(
        and(
          eq(passwordResetTokens.userId, user.id),
          isNull(passwordResetTokens.consumedAt)
        )
      );

    await tx.insert(passwordResetTokens).values({
      expiresAt: createPasswordResetTokenExpiresAt(now),
      tokenHash: hashPasswordResetToken(resetToken),
      userId: user.id
    });
  });

  await options.emailDelivery.sendPasswordResetEmail({
    expiresInSeconds: PASSWORD_RESET_TOKEN_TTL_SECONDS,
    recipientEmail: body.email,
    resetUrl: buildPasswordResetUrl(options.webAppUrl, resetToken)
  });

  return {
    devResetToken: resetToken,
    response: buildPasswordResetRequestResponse()
  };
}

export async function confirmPasswordReset(
  app: FastifyInstance,
  body: PasswordResetConfirmBody
): Promise<{ status: "ok"; response: PasswordResetConfirmResponse } | { status: "invalid"; response: ApiFailure }> {
  const now = new Date();
  const tokenHash = hashPasswordResetToken(body.token);
  const newPasswordHash = await hashPassword(body.newPassword);

  const updated = await app.db.transaction(async (tx) => {
    const [resetToken] = await tx
      .select({
        id: passwordResetTokens.id,
        userId: passwordResetTokens.userId
      })
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.consumedAt),
          gt(passwordResetTokens.expiresAt, now)
        )
      )
      .limit(1);

    if (!resetToken) {
      return null;
    }

    await tx
      .update(users)
      .set({
        passwordHash: newPasswordHash,
        updatedAt: now
      })
      .where(eq(users.id, resetToken.userId));

    await tx
      .update(passwordResetTokens)
      .set({
        consumedAt: now
      })
      .where(eq(passwordResetTokens.id, resetToken.id));

    await revokeActiveSessionsForUserTx(tx, resetToken.userId, now);

    return resetToken;
  });

  if (!updated) {
    return {
      status: "invalid",
      response: invalidPasswordResetToken()
    };
  }

  return {
    status: "ok",
    response: buildPasswordResetConfirmResponse()
  };
}

export async function changePassword(
  app: FastifyInstance,
  userId: string,
  body: PasswordChangeBody
): Promise<{ status: "ok"; response: PasswordChangeResponse } | { status: "invalid"; response: ApiFailure }> {
  const [user] = await app.db
    .select({
      id: users.id,
      passwordHash: users.passwordHash
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || !(await verifyPassword(body.currentPassword, user.passwordHash))) {
    return {
      status: "invalid",
      response: invalidCredentials()
    };
  }

  const now = new Date();
  const passwordHash = await hashPassword(body.newPassword);

  await app.db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        passwordHash,
        updatedAt: now
      })
      .where(eq(users.id, userId));

    await revokeActiveSessionsForUserTx(tx, userId, now);
  });

  return {
    status: "ok",
    response: buildPasswordChangeResponse()
  };
}

export async function requestEmailVerification(
  app: FastifyInstance,
  body: EmailVerificationRequestBody,
  options: EmailDeliveryOptions
): Promise<{ response: EmailVerificationRequestResponse; devEmailVerificationToken?: string }> {
  const now = new Date();
  const user = await findUserByEmail(app, body.email);

  if (!user || user.emailVerifiedAt) {
    return {
      response: buildEmailVerificationRequestResponse()
    };
  }

  const verificationToken = createEmailVerificationToken();

  await app.db.transaction(async (tx) => {
    await tx
      .update(emailVerificationTokens)
      .set({
        consumedAt: now
      })
      .where(
        and(
          eq(emailVerificationTokens.userId, user.id),
          isNull(emailVerificationTokens.consumedAt)
        )
      );

    await tx.insert(emailVerificationTokens).values({
      expiresAt: createEmailVerificationTokenExpiresAt(now),
      tokenHash: hashEmailVerificationToken(verificationToken),
      userId: user.id
    });
  });

  await options.emailDelivery.sendEmailVerificationEmail({
    expiresInSeconds: EMAIL_VERIFICATION_TOKEN_TTL_SECONDS,
    recipientEmail: body.email,
    verificationUrl: buildEmailVerificationUrl(options.webAppUrl, verificationToken)
  });

  return {
    devEmailVerificationToken: verificationToken,
    response: buildEmailVerificationRequestResponse()
  };
}

export async function confirmEmailVerification(
  app: FastifyInstance,
  body: EmailVerificationConfirmBody
): Promise<
  { status: "ok"; response: EmailVerificationConfirmResponse } | { status: "invalid"; response: ApiFailure }
> {
  const now = new Date();
  const tokenHash = hashEmailVerificationToken(body.token);

  const verified = await app.db.transaction(async (tx) => {
    const [verificationToken] = await tx
      .select({
        id: emailVerificationTokens.id,
        userId: emailVerificationTokens.userId
      })
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.tokenHash, tokenHash),
          isNull(emailVerificationTokens.consumedAt),
          gt(emailVerificationTokens.expiresAt, now)
        )
      )
      .limit(1);

    if (!verificationToken) {
      return null;
    }

    await tx
      .update(users)
      .set({
        emailVerifiedAt: now,
        updatedAt: now
      })
      .where(eq(users.id, verificationToken.userId));

    await tx
      .update(authAccounts)
      .set({
        emailVerifiedAt: now,
        updatedAt: now
      })
      .where(
        and(
          eq(authAccounts.userId, verificationToken.userId),
          eq(authAccounts.provider, "password")
        )
      );

    await tx
      .update(emailVerificationTokens)
      .set({
        consumedAt: now
      })
      .where(eq(emailVerificationTokens.id, verificationToken.id));

    return verificationToken;
  });

  if (!verified) {
    return {
      status: "invalid",
      response: invalidEmailVerificationToken()
    };
  }

  return {
    status: "ok",
    response: buildEmailVerificationConfirmResponse()
  };
}

export async function createAuthSession(
  app: FastifyInstance,
  userId: string,
  requestMeta: AuthSessionRequestMeta
): Promise<AuthSessionCreation> {
  const refreshToken = createRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const expiresAt = createRefreshTokenExpiresAt();

  await app.db.insert(sessions).values({
    expiresAt,
    ipAddress: requestMeta.ipAddress,
    refreshTokenHash,
    userAgent: requestMeta.userAgent,
    userId
  });

  return {
    expiresAt,
    refreshToken
  };
}

export async function refreshAuthSession(
  app: FastifyInstance,
  refreshToken: string,
  requestMeta: AuthSessionRequestMeta
): Promise<RefreshAuthSessionResult> {
  const now = new Date();
  const currentRefreshTokenHash = hashRefreshToken(refreshToken);

  const [sessionRow] = await app.db
    .select({
      sessionId: sessions.id,
      userId: users.id,
      email: users.email,
      emailVerifiedAt: users.emailVerifiedAt,
      role: users.role,
      profileId: profiles.id,
      displayName: profiles.displayName,
      locationCity: profiles.locationCity,
      expiresAt: sessions.expiresAt,
      revokedAt: sessions.revokedAt
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(sessions.refreshTokenHash, currentRefreshTokenHash))
    .limit(1);

  if (!sessionRow || sessionRow.revokedAt || sessionRow.expiresAt <= now) {
    return {
      status: "invalid",
      response: unauthorizedAuthRequest()
    };
  }

  const nextRefreshToken = createRefreshToken();
  const nextRefreshTokenHash = hashRefreshToken(nextRefreshToken);
  const nextExpiresAt = createRefreshTokenExpiresAt(now);

  const [updatedSession] = await app.db
    .update(sessions)
    .set({
      expiresAt: nextExpiresAt,
      ipAddress: requestMeta.ipAddress,
      refreshTokenHash: nextRefreshTokenHash,
      updatedAt: now,
      userAgent: requestMeta.userAgent
    })
    .where(
      and(
        eq(sessions.id, sessionRow.sessionId),
        eq(sessions.refreshTokenHash, currentRefreshTokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now)
      )
    )
    .returning({
      id: sessions.id
    });

  if (!updatedSession) {
    return {
      status: "invalid",
      response: unauthorizedAuthRequest()
    };
  }

  return {
    status: "ok",
    expiresAt: nextExpiresAt,
    refreshToken: nextRefreshToken,
    response: buildAuthResponse({
      profile: {
        id: sessionRow.profileId,
        displayName: sessionRow.displayName,
        locationCity: sessionRow.locationCity
      },
      user: {
        id: sessionRow.userId,
        email: sessionRow.email,
        emailVerifiedAt: serializeDate(sessionRow.emailVerifiedAt),
        role: sessionRow.role
      }
    })
  };
}

export async function revokeAuthSession(app: FastifyInstance, refreshToken: string): Promise<void> {
  const now = new Date();

  await app.db
    .update(sessions)
    .set({
      revokedAt: now,
      updatedAt: now
    })
    .where(
      and(
        eq(sessions.refreshTokenHash, hashRefreshToken(refreshToken)),
        isNull(sessions.revokedAt)
      )
    );
}

export async function listAuthSessions(
  app: FastifyInstance,
  userId: string,
  currentRefreshToken: string | null
): Promise<AuthSessionsResponse> {
  const now = new Date();
  const currentRefreshTokenHash = currentRefreshToken ? hashRefreshToken(currentRefreshToken) : null;
  const rows = await app.db
    .select({
      id: sessions.id,
      refreshTokenHash: sessions.refreshTokenHash,
      expiresAt: sessions.expiresAt,
      userAgent: sessions.userAgent,
      ipAddress: sessions.ipAddress,
      createdAt: sessions.createdAt,
      updatedAt: sessions.updatedAt
    })
    .from(sessions)
    .where(and(
      eq(sessions.userId, userId),
      isNull(sessions.revokedAt),
      gt(sessions.expiresAt, now)
    ))
    .orderBy(desc(sessions.updatedAt), desc(sessions.createdAt))
    .limit(50);

  const currentSessionId =
    currentRefreshTokenHash
      ? rows.find((row) => row.refreshTokenHash === currentRefreshTokenHash)?.id ?? null
      : null;

  return {
    ok: true,
    data: {
      currentSessionId,
      sessions: rows.map((row) => serializeAuthSession(row, currentRefreshTokenHash))
    }
  };
}

export async function revokeAuthSessionById(
  app: FastifyInstance,
  userId: string,
  sessionId: string,
  currentRefreshToken: string | null
): Promise<
  | { status: "ok"; response: AuthSessionRevokeResponse }
  | { status: "not_found"; response: ApiFailure }
> {
  if (!isUuid(sessionId)) {
    return {
      status: "not_found",
      response: authSessionNotFound()
    };
  }

  const now = new Date();
  const currentRefreshTokenHash = currentRefreshToken ? hashRefreshToken(currentRefreshToken) : null;

  const [targetSession] = await app.db
    .select({
      id: sessions.id,
      refreshTokenHash: sessions.refreshTokenHash
    })
    .from(sessions)
    .where(and(
      eq(sessions.id, sessionId),
      eq(sessions.userId, userId),
      isNull(sessions.revokedAt),
      gt(sessions.expiresAt, now)
    ))
    .limit(1);

  if (!targetSession) {
    return {
      status: "not_found",
      response: authSessionNotFound()
    };
  }

  await app.db
    .update(sessions)
    .set({
      revokedAt: now,
      updatedAt: now
    })
    .where(and(
      eq(sessions.id, targetSession.id),
      eq(sessions.userId, userId),
      isNull(sessions.revokedAt)
    ));

  return {
    status: "ok",
    response: {
      ok: true,
      data: {
        currentSessionRevoked: currentRefreshTokenHash === targetSession.refreshTokenHash,
        revoked: true,
        sessionId: targetSession.id
      }
    }
  };
}

export async function revokeAllAuthSessions(
  app: FastifyInstance,
  userId: string
): Promise<AuthSessionsRevokeAllResponse> {
  const now = new Date();
  const revokedSessions = await app.db
    .update(sessions)
    .set({
      revokedAt: now,
      updatedAt: now
    })
    .where(and(
      eq(sessions.userId, userId),
      isNull(sessions.revokedAt),
      gt(sessions.expiresAt, now)
    ))
    .returning({
      id: sessions.id
    });

  return {
    ok: true,
    data: {
      revokedCount: revokedSessions.length
    }
  };
}

export function buildLogoutAuthResponse(): LogoutAuthResponse {
  return {
    ok: true,
    data: {
      loggedOut: true
    }
  };
}

function buildPasswordResetRequestResponse(
  devResetToken?: string
): PasswordResetRequestResponse {
  return {
    ok: true,
    data: {
      requested: true,
      ...(devResetToken ? { devResetToken } : {})
    }
  };
}

function buildPasswordResetConfirmResponse(): PasswordResetConfirmResponse {
  return {
    ok: true,
    data: {
      passwordReset: true
    }
  };
}

function buildPasswordChangeResponse(): PasswordChangeResponse {
  return {
    ok: true,
    data: {
      passwordChanged: true
    }
  };
}

function buildEmailVerificationRequestResponse(
  devEmailVerificationToken?: string
): EmailVerificationRequestResponse {
  return {
    ok: true,
    data: {
      requested: true,
      ...(devEmailVerificationToken ? { devEmailVerificationToken } : {})
    }
  };
}

function buildEmailVerificationConfirmResponse(): EmailVerificationConfirmResponse {
  return {
    ok: true,
    data: {
      emailVerified: true
    }
  };
}

function buildMfaChallengeResponse(challengeId: string, devOtpCode?: string): MfaChallengeResponse {
  return {
    ok: true,
    data: {
      challengeId,
      mfaRequired: true,
      ...(devOtpCode ? { devOtpCode } : {})
    }
  };
}

function buildMfaStatusResponse(mfaEnabled: boolean): MfaStatusResponse {
  return {
    ok: true,
    data: {
      delivery: "email",
      method: "email_otp",
      mfaEnabled
    }
  };
}

function buildMfaPreferenceResponse(mfaEnabled: boolean): MfaPreferenceResponse {
  return {
    ok: true,
    data: {
      delivery: "email",
      method: "email_otp",
      mfaEnabled,
      updated: true
    }
  };
}

function serializeAuthSession(
  row: {
    id: string;
    refreshTokenHash: string;
    expiresAt: Date;
    userAgent: string | null;
    ipAddress: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  currentRefreshTokenHash: string | null
): SafeAuthSession {
  const userAgent = sanitizeSessionText(row.userAgent, 180);
  const ipAddress = sanitizeSessionText(row.ipAddress, 80);

  return {
    id: row.id,
    current: currentRefreshTokenHash === row.refreshTokenHash,
    deviceLabel: buildDeviceLabel(userAgent),
    userAgent,
    ipAddress,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString()
  };
}

function buildDeviceLabel(userAgent: string | null): string {
  if (!userAgent) {
    return "Bilinmeyen cihaz";
  }

  const value = userAgent.toLowerCase();

  if (value.includes("android")) {
    return "Android cihaz";
  }

  if (value.includes("iphone") || value.includes("ipad") || value.includes("ios")) {
    return "iOS cihaz";
  }

  if (value.includes("macintosh") || value.includes("mac os")) {
    return "Mac tarayıcı";
  }

  if (value.includes("windows")) {
    return "Windows tarayıcı";
  }

  if (value.includes("linux")) {
    return "Linux tarayıcı";
  }

  return "Web oturumu";
}

function sanitizeSessionText(value: string | null, maxLength: number): string | null {
  if (!value || value.trim().length === 0) {
    return null;
  }

  return safePlainTextFallback(value, "Bilinmeyen", {
    maxLength,
    minLength: 1
  });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

export function buildAuthMeResponse(currentUser: CurrentUser): AuthMeResponse {
  return {
    ok: true,
    data: {
      user: {
        id: currentUser.userId,
        email: currentUser.email,
        emailVerifiedAt: currentUser.emailVerifiedAt,
        role: currentUser.role
      },
      profile: currentUser.profile
    }
  };
}

export function attachAccessToken(response: AuthSuccess, options: AuthTokenOptions): AuthSuccess {
  return {
    ok: true,
    data: {
      ...response.data,
      accessToken: signAccessToken(
        {
          userId: response.data.user.id,
          profileId: response.data.profile.id
        },
        {
          secret: options.authSecret,
          ttlSeconds: options.authTokenTtlSeconds
        }
      )
    }
  };
}

export function invalidAuthRequest(): ApiFailure {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message: "Auth request body is invalid."
    }
  };
}

export function unauthorizedAuthRequest(): ApiFailure {
  return {
    ok: false,
    error: {
      code: "UNAUTHORIZED",
      message: "Unauthorized."
    }
  };
}

function duplicateEmailRegistration(): { status: "duplicate"; response: ApiFailure } {
  return {
    status: "duplicate",
    response: {
      ok: false,
      error: {
        code: "EMAIL_ALREADY_REGISTERED",
        message: "Email is already registered."
      }
    }
  };
}

function invalidEmailVerificationToken(): ApiFailure {
  return {
    ok: false,
    error: {
      code: "EMAIL_VERIFICATION_TOKEN_INVALID",
      message: "Email verification token is invalid or expired."
    }
  };
}

function invalidMfaCode(): ApiFailure {
  return {
    ok: false,
    error: {
      code: "MFA_CODE_INVALID",
      message: "MFA code is invalid or expired."
    }
  };
}

function authSessionNotFound(): ApiFailure {
  return {
    ok: false,
    error: {
      code: "AUTH_SESSION_NOT_FOUND",
      message: "Auth session was not found."
    }
  };
}

function isDuplicateRegistrationConstraint(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  const dbError = error as { code?: unknown; constraint?: unknown };

  return (
    dbError.code === "23505" &&
    (dbError.constraint === "users_email_unique" ||
      dbError.constraint === "auth_accounts_provider_account_unique")
  );
}

function buildAuthResponse(value: { user: SafeAuthUser; profile: SafeAuthProfile }): AuthSuccess {
  return {
    ok: true,
    data: {
      accessToken: "",
      user: value.user,
      profile: value.profile
    }
  };
}

async function findUserByEmail(app: FastifyInstance, email: string) {
  const [user] = await app.db
    .select({ id: users.id, emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return user ?? null;
}

async function findUserWithProfileByEmail(app: FastifyInstance, email: string) {
  const [user] = await app.db
    .select({
      id: users.id,
      email: users.email,
      emailVerifiedAt: users.emailVerifiedAt,
      mfaEnabled: users.mfaEnabled,
      mobileLoginApprovalEnabled: users.mobileLoginApprovalEnabled,
      role: users.role,
      passwordHash: users.passwordHash,
      profileId: profiles.id,
      displayName: profiles.displayName,
      locationCity: profiles.locationCity
    })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.email, email))
    .limit(1);

  return user ?? null;
}

async function findUserWithProfileByAuthAccount(
  app: FastifyInstance,
  provider: string,
  providerAccountId: string
) {
  const [user] = await app.db
    .select({
      id: users.id,
      email: users.email,
      emailVerifiedAt: users.emailVerifiedAt,
      role: users.role,
      profileId: profiles.id,
      displayName: profiles.displayName,
      locationCity: profiles.locationCity
    })
    .from(authAccounts)
    .innerJoin(users, eq(users.id, authAccounts.userId))
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(
      and(
        eq(authAccounts.provider, provider),
        eq(authAccounts.providerAccountId, providerAccountId)
      )
    )
    .limit(1);

  return user ?? null;
}

async function createProfileForGoogleUser(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  userId: string,
  displayName: string
): Promise<SafeAuthProfile> {
  const [createdProfile] = await tx
    .insert(profiles)
    .values({
      displayName,
      userId
    })
    .returning({
      id: profiles.id,
      displayName: profiles.displayName,
      locationCity: profiles.locationCity
    });

  if (!createdProfile) {
    throw new Error("Profile insert failed.");
  }

  return createdProfile;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeGoogleOAuthEmail(googleProfile: GoogleUserInfo): string {
  if (!googleProfile.email || googleProfile.email_verified !== true) {
    throw new Error("Google profile email must be verified.");
  }

  const email = normalizeEmail(googleProfile.email);

  if (!isSafeGoogleOAuthEmail(email)) {
    throw new Error("Google profile email is invalid.");
  }

  return email;
}

function isSafeGoogleOAuthEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) && email.length <= 320;
}

function buildGoogleProfileDisplayName(googleProfile: GoogleUserInfo, email: string): string {
  const [emailPrefix] = email.split("@");
  const fallback = emailPrefix && emailPrefix.length >= 2
    ? safePlainTextFallback(emailPrefix, "BabyLoop User", {
        maxLength: 120,
        minLength: 2
      })
    : "BabyLoop User";
  const name = googleProfile.name?.trim();

  if (name && name.length >= 2) {
    return safePlainTextFallback(name, fallback, {
      maxLength: 120,
      minLength: 2
    });
  }

  return fallback;
}

function serializeDate(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function invalidCredentials(): ApiFailure {
  return {
    ok: false,
    error: {
      code: "INVALID_CREDENTIALS",
      message: "Email or password is incorrect."
    }
  };
}

function invalidPasswordResetToken(): ApiFailure {
  return {
    ok: false,
    error: {
      code: "INVALID_PASSWORD_RESET_TOKEN",
      message: "Password reset token is invalid or expired."
    }
  };
}

async function revokeActiveSessionsForUserTx(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  userId: string,
  now: Date
): Promise<void> {
  await tx
    .update(sessions)
    .set({
      revokedAt: now,
      updatedAt: now
    })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}
