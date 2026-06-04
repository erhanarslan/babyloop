import {
  authAccounts,
  emailVerificationTokens,
  passwordResetTokens,
  profiles,
  sessions,
  users
} from "@babyloop/database/schema";
import type { Database } from "@babyloop/database";
import type { ApiFailure, ApiResponse, ApiSuccess } from "@babyloop/shared";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { CurrentUser } from "../plugins/auth.plugin.js";
import type {
  LoginBody,
  EmailVerificationConfirmBody,
  EmailVerificationRequestBody,
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
  hashPasswordResetToken
} from "../utils/password-reset-token.js";
import {
  createEmailVerificationToken,
  createEmailVerificationTokenExpiresAt,
  hashEmailVerificationToken
} from "../utils/email-verification-token.js";
import type { GoogleUserInfo } from "./google-oauth.service.js";

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

type AuthSessionCreation = {
  expiresAt: Date;
  refreshToken: string;
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
  body: RegisterBody
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
  body: LoginBody
): Promise<{ status: "ok"; response: AuthSuccess } | { status: "invalid"; response: ApiFailure }> {
  const userWithProfile = await findUserWithProfileByEmail(app, body.email);

  if (!userWithProfile || !(await verifyPassword(body.password, userWithProfile.passwordHash))) {
    return {
      status: "invalid",
      response: invalidCredentials()
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

export async function authenticateGoogleUser(
  app: FastifyInstance,
  googleProfile: GoogleUserInfo
): Promise<AuthSuccess> {
  const email = normalizeEmail(googleProfile.email ?? "");
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
  body: PasswordResetRequestBody
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
  body: EmailVerificationRequestBody
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

function buildGoogleProfileDisplayName(googleProfile: GoogleUserInfo, email: string): string {
  const name = googleProfile.name?.trim();

  if (name && name.length >= 2) {
    return name.slice(0, 120);
  }

  const [emailPrefix] = email.split("@");

  if (emailPrefix && emailPrefix.length >= 2) {
    return emailPrefix.slice(0, 120);
  }

  return "BabyLoop User";
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
