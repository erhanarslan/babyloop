import { authAccounts, profiles, sessions, users } from "@babyloop/database/schema";
import type { ApiFailure, ApiResponse, ApiSuccess } from "@babyloop/shared";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { CurrentUser } from "../plugins/auth.plugin.js";
import type { LoginBody, RegisterBody } from "../schemas/auth.schemas.js";
import { signAccessToken } from "../utils/access-token.js";
import {
  createRefreshToken,
  createRefreshTokenExpiresAt,
  hashRefreshToken
} from "../utils/refresh-token.js";
import { hashPassword, verifyPassword } from "../utils/password.js";

export type SafeAuthUser = {
  id: string;
  email: string;
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
): Promise<{ status: "created"; response: AuthSuccess } | { status: "duplicate"; response: ApiFailure }> {
  const existingUser = await findUserByEmail(app, body.email);

  if (existingUser) {
    return duplicateEmailRegistration();
  }

  const passwordHash = await hashPassword(body.password);

  try {
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

      return {
        profile: createdProfile,
        user: createdUser
      };
    });

    return {
      status: "created",
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
        role: userWithProfile.role
      }
    })
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
        role: sessionRow.role
      }
    })
  };
}

export function buildAuthMeResponse(currentUser: CurrentUser): AuthMeResponse {
  return {
    ok: true,
    data: {
      user: {
        id: currentUser.userId,
        email: currentUser.email,
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
    .select({ id: users.id })
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

function invalidCredentials(): ApiFailure {
  return {
    ok: false,
    error: {
      code: "INVALID_CREDENTIALS",
      message: "Email or password is incorrect."
    }
  };
}
