import { profiles, sessions, users } from "@babyloop/database/schema";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { verifyAccessToken } from "../utils/access-token.js";
import { readBackofficeAccessTokenCookie } from "../utils/backoffice-access-token-cookie.js";
import { readPublicAccessTokenCookie } from "../utils/public-access-token-cookie.js";

type AuthPluginOptions = {
  authSecret: string;
};

export type CurrentUser = {
  email: string;
  emailVerifiedAt: string | null;
  profile: {
    displayName: string;
    id: string;
    locationCity: string | null;
  };
  role: string;
  sessionId: string;
  userId: string;
};

export function registerAuthPlugin(app: FastifyInstance, options: AuthPluginOptions): void {
  app.decorateRequest("currentUser", null);

  app.decorate("authenticate", async (request: FastifyRequest) => {
    const token =
      readBearerToken(request) ??
      readPublicAccessTokenCookie(request.headers.cookie) ??
      readBackofficeAccessTokenCookie(request.headers.cookie);

    if (!token) {
      return null;
    }

    const currentUser = await authenticateAccessToken(app, token, options);

    if (!currentUser) {
      return null;
    }

    request.currentUser = currentUser;

    return currentUser;
  });
}

export async function authenticateAccessToken(
  app: FastifyInstance,
  token: string,
  options: AuthPluginOptions
): Promise<CurrentUser | null> {
  const verifiedToken = verifyAccessToken(token, {
    secret: options.authSecret
  });

  if (!verifiedToken) {
    return null;
  }

  const now = new Date();

  const [row] = await app.db
    .select({
      userId: users.id,
      email: users.email,
      emailVerifiedAt: users.emailVerifiedAt,
      role: users.role,
      profileId: profiles.id,
      displayName: profiles.displayName,
      locationCity: profiles.locationCity,
      sessionId: sessions.id
    })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .innerJoin(
      sessions,
      and(
        eq(sessions.id, verifiedToken.sessionId),
        eq(sessions.userId, users.id),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now)
      )
    )
    .where(eq(users.id, verifiedToken.userId))
    .limit(1);

  if (
    !row ||
    row.profileId !== verifiedToken.profileId ||
    row.sessionId !== verifiedToken.sessionId
  ) {
    return null;
  }

  return {
    email: row.email,
    emailVerifiedAt: row.emailVerifiedAt ? row.emailVerifiedAt.toISOString() : null,
    profile: {
      displayName: row.displayName,
      id: row.profileId,
      locationCity: row.locationCity
    },
    role: row.role,
    sessionId: row.sessionId,
    userId: row.userId
  };
}

function readBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;

  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}
