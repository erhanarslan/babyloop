import { profiles, users } from "@babyloop/database/schema";
import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { signAccessToken } from "../utils/access-token.js";
import { hashPassword, verifyPassword } from "../utils/password.js";

const registerBodySchema = z
  .object({
    email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
    password: z.string().min(8).max(128),
    displayName: z.string().trim().min(2).max(120),
    locationCity: z
      .string()
      .trim()
      .max(120)
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null))
  })
  .strict();

const loginBodySchema = z
  .object({
    email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
    password: z.string().min(1).max(128)
  })
  .strict();

type SafeAuthUser = {
  id: string;
  email: string;
  role: string;
};

type SafeAuthProfile = {
  id: string;
  displayName: string;
  locationCity: string | null;
};

type AuthResponse = ApiResponse<{
  accessToken: string;
  user: SafeAuthUser;
  profile: SafeAuthProfile;
}>;

type AuthMeResponse = ApiResponse<{
  user: SafeAuthUser;
  profile: SafeAuthProfile;
}>;

type AuthRouteOptions = {
  authSecret: string;
  authTokenTtlSeconds: number;
};

export function registerAuthRoutes(app: FastifyInstance, options: AuthRouteOptions): void {
  app.post<{ Body: unknown; Reply: AuthResponse }>("/auth/register", async (request, reply) => {
    const parsedBody = registerBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.status(400).send(invalidAuthRequest());
    }

    const body = parsedBody.data;
    const existingUser = await findUserByEmail(app, body.email);

    if (existingUser) {
      return reply.status(409).send({
        ok: false,
        error: {
          code: "EMAIL_ALREADY_REGISTERED",
          message: "Email is already registered."
        }
      });
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

    return reply.status(201).send(buildAuthResponse(created, options));
  });

  app.post<{ Body: unknown; Reply: AuthResponse }>("/auth/login", async (request, reply) => {
    const parsedBody = loginBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.status(400).send(invalidAuthRequest());
    }

    const userWithProfile = await findUserWithProfileByEmail(app, parsedBody.data.email);

    if (
      !userWithProfile ||
      !(await verifyPassword(parsedBody.data.password, userWithProfile.passwordHash))
    ) {
      return reply.status(401).send(invalidCredentials());
    }

    return buildAuthResponse(
      {
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
      },
      options
    );
  });

  app.get<{ Reply: AuthMeResponse }>("/auth/me", async (request, reply) => {
    const currentUser = await app.authenticate(request);

    if (!currentUser) {
      return reply.status(401).send({
        ok: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication is required."
        }
      });
    }

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
  });
}

function buildAuthResponse(
  value: {
    user: SafeAuthUser;
    profile: SafeAuthProfile;
  },
  options: AuthRouteOptions
): AuthResponse {
  return {
    ok: true,
    data: {
      accessToken: signAccessToken(
        {
          userId: value.user.id,
          profileId: value.profile.id
        },
        {
          secret: options.authSecret,
          ttlSeconds: options.authTokenTtlSeconds
        }
      ),
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

function invalidAuthRequest(): ApiFailure {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message: "Auth request body is invalid."
    }
  };
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
