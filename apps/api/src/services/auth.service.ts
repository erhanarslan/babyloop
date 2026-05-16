import { profiles, users } from "@babyloop/database/schema";
import type { ApiFailure, ApiResponse, ApiSuccess } from "@babyloop/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { CurrentUser } from "../plugins/auth.plugin.js";
import type { LoginBody, RegisterBody } from "../schemas/auth.schemas.js";
import { signAccessToken } from "../utils/access-token.js";
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
  authSecret: string;
  authTokenTtlSeconds: number;
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

export async function registerUser(
  app: FastifyInstance,
  body: RegisterBody
): Promise<{ status: "created"; response: AuthSuccess } | { status: "duplicate"; response: ApiFailure }> {
  const existingUser = await findUserByEmail(app, body.email);

  if (existingUser) {
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

  const passwordHash = await hashPassword(body.password);
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

    return {
      profile: createdProfile,
      user: createdUser
    };
  });

  return {
    status: "created",
    response: buildAuthResponse(created)
  };
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

export function attachAccessToken(
  response: AuthSuccess,
  options: AuthTokenOptions
): AuthSuccess {
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
