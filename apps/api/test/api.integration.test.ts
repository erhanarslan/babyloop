import {
  aiModelRuns,
  authAccounts,
  conversations,
  emailVerificationTokens,
  events,
  favorites,
  listingImages,
  listings,
  mfaOtpChallenges,
  passwordResetTokens,
  profiles,
  sessions,
  users
} from "@babyloop/database/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import {
  REFRESH_TOKEN_COOKIE_NAME,
  hashRefreshToken
} from "../src/utils/refresh-token.js";
import { hashEmailVerificationToken } from "../src/utils/email-verification-token.js";
import {
  GOOGLE_OAUTH_STATE_COOKIE_NAME,
  type GoogleOAuthClient,
  type GoogleUserInfo
} from "../src/services/google-oauth.service.js";
import type {
  EmailDeliveryService,
  SendEmailVerificationEmailParams,
  SendMfaOtpEmailParams,
  SendPasswordResetEmailParams
} from "../src/services/email-delivery.service.js";
import { hashMfaOtpCode } from "../src/utils/mfa-otp.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  authHeader,
  createCategory,
  createListing,
  createUser,
  loginUser
} from "./api-helpers.js";
import { createTestApp, type TestApp } from "./test-app.js";
import { resetTestDatabase } from "./test-db.js";

let app!: TestApp;

beforeEach(async () => {
  await resetTestDatabase();
  app = await createTestApp();
});

afterEach(async () => {
  await app.close();
});

describe("auth API", () => {
  it("registers a valid user", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Ada Parent",
        email: "  ADA@Example.COM  ",
        password: "Password123!"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        user: {
          email: "ada@example.com"
        },
        profile: {
          displayName: "Ada Parent"
        }
      }
    });

    expect(response.json().data.accessToken).toEqual(expect.any(String));
    expect(response.body).not.toContain("passwordHash");
    expect(response.body).not.toContain("password_hash");
    expect(response.body).not.toContain("authAccounts");
    expect(response.body).not.toContain("auth_accounts");
    expect(response.body).not.toContain("providerAccountId");
    expect(response.body).not.toContain("provider_account_id");
  });

  it("trims and normalizes registered email", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Email Normalized",
        email: "  Mixed.Case@Example.COM  ",
        password: "Password123!"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.user.email).toBe("mixed.case@example.com");
  });

  it("creates a password auth account on register", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Account Linked",
        email: "  Account.Linked@Example.COM  ",
        password: "Password123!"
      }
    });

    expect(response.statusCode).toBe(201);

    const registeredUser = response.json().data.user;

    const login = await loginUser(app, "account.linked@example.com", "Password123!");

    const accountRows = await app.db
      .select({
        email: authAccounts.email,
        provider: authAccounts.provider,
        providerAccountId: authAccounts.providerAccountId,
        userId: authAccounts.userId
      })
      .from(authAccounts)
      .where(eq(authAccounts.userId, registeredUser.id));

    expect(login.user.id).toBe(registeredUser.id);
    expect(accountRows).toEqual([
      {
        email: "account.linked@example.com",
        provider: "password",
        providerAccountId: "account.linked@example.com",
        userId: registeredUser.id
      }
    ]);
  });

  it("register creates an email verification token and returns a dev token in test", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Needs Verification",
        email: "needs-verification@example.com",
        password: "Password123!"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.user.emailVerifiedAt).toBeNull();
    expect(response.json().data.devEmailVerificationToken).toEqual(expect.any(String));

    const tokenRows = await app.db
      .select({
        consumedAt: emailVerificationTokens.consumedAt,
        tokenHash: emailVerificationTokens.tokenHash,
        userId: emailVerificationTokens.userId
      })
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, response.json().data.user.id));

    expect(tokenRows).toHaveLength(1);
    expect(tokenRows[0]!.consumedAt).toBeNull();
    expect(tokenRows[0]!.tokenHash).not.toBe(response.json().data.devEmailVerificationToken);
  });

  it("register invokes the email verification delivery abstraction", async () => {
    const emailDelivery = await useEmailDeliveryTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Delivery Verification",
        email: "delivery-verification@example.com",
        password: "Password123!"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(emailDelivery.emailVerificationEmails).toHaveLength(1);
    expect(emailDelivery.emailVerificationEmails[0]).toMatchObject({
      displayName: "Delivery Verification",
      expiresInSeconds: 60 * 60 * 24,
      recipientEmail: "delivery-verification@example.com"
    });
    expect(emailDelivery.emailVerificationEmails[0]!.verificationUrl).toContain(
      "http://localhost:3000/auth/verify-email?token="
    );
  });

  it("confirms a valid email verification token", async () => {
    const register = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Verify Me",
        email: "verify-me@example.com",
        password: "Password123!"
      }
    });
    const registerBody = register.json();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/email-verification/confirm",
      payload: {
        token: registerBody.data.devEmailVerificationToken
      }
    });

    const [userRow] = await app.db
      .select({
        emailVerifiedAt: users.emailVerifiedAt
      })
      .from(users)
      .where(eq(users.id, registerBody.data.user.id));
    const [accountRow] = await app.db
      .select({
        emailVerifiedAt: authAccounts.emailVerifiedAt
      })
      .from(authAccounts)
      .where(
        and(
          eq(authAccounts.userId, registerBody.data.user.id),
          eq(authAccounts.provider, "password")
        )
      );
    const [tokenRow] = await app.db
      .select({
        consumedAt: emailVerificationTokens.consumedAt
      })
      .from(emailVerificationTokens)
      .where(
        eq(
          emailVerificationTokens.tokenHash,
          hashEmailVerificationToken(registerBody.data.devEmailVerificationToken)
        )
      );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        emailVerified: true
      }
    });
    expect(userRow?.emailVerifiedAt).toBeInstanceOf(Date);
    expect(accountRow?.emailVerifiedAt).toBeInstanceOf(Date);
    expect(tokenRow?.consumedAt).toBeInstanceOf(Date);
  });

  it("rejects invalid email verification tokens safely", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/email-verification/confirm",
      payload: {
        token: "not-a-real-token"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "EMAIL_VERIFICATION_TOKEN_INVALID"
      }
    });
  });

  it("rejects expired email verification tokens safely", async () => {
    const user = await createUser(app, {
      email: "expired-verification@example.com"
    });
    const expiredToken = "expired-email-verification-token";

    await app.db.insert(emailVerificationTokens).values({
      expiresAt: new Date(Date.now() - 60_000),
      tokenHash: hashEmailVerificationToken(expiredToken),
      userId: user.user.id
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/email-verification/confirm",
      payload: {
        token: expiredToken
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "EMAIL_VERIFICATION_TOKEN_INVALID"
      }
    });
  });

  it("rejects consumed email verification tokens safely", async () => {
    const register = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Consumed Verification",
        email: "consumed-verification@example.com",
        password: "Password123!"
      }
    });
    const token = register.json().data.devEmailVerificationToken;

    const firstConfirm = await app.inject({
      method: "POST",
      url: "/api/v1/auth/email-verification/confirm",
      payload: {
        token
      }
    });
    const secondConfirm = await app.inject({
      method: "POST",
      url: "/api/v1/auth/email-verification/confirm",
      payload: {
        token
      }
    });

    expect(firstConfirm.statusCode).toBe(200);
    expect(secondConfirm.statusCode).toBe(400);
    expect(secondConfirm.json()).toMatchObject({
      ok: false,
      error: {
        code: "EMAIL_VERIFICATION_TOKEN_INVALID"
      }
    });
  });

  it("email verification request is enumeration-safe for missing emails", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/email-verification/request",
      payload: {
        email: "missing-verification@example.com"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      data: {
        requested: true
      }
    });
  });

  it("email verification request creates a fresh token for an existing unverified user", async () => {
    const user = await createUser(app, {
      email: "request-verification@example.com"
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/email-verification/request",
      payload: {
        email: "request-verification@example.com"
      }
    });

    const tokenRows = await app.db
      .select({
        consumedAt: emailVerificationTokens.consumedAt,
        tokenHash: emailVerificationTokens.tokenHash
      })
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, user.user.id));
    const activeTokenRows = tokenRows.filter((row) => row.consumedAt === null);

    expect(response.statusCode).toBe(200);
    expect(response.json().data.requested).toBe(true);
    expect(response.json().data.devEmailVerificationToken).toEqual(expect.any(String));
    expect(activeTokenRows).toHaveLength(1);
    expect(activeTokenRows[0]!.tokenHash).toBe(
      hashEmailVerificationToken(response.json().data.devEmailVerificationToken)
    );
  });

  it("email verification request invokes the email delivery abstraction", async () => {
    const emailDelivery = await useEmailDeliveryTestApp();

    await createUser(app, {
      email: "verification-delivery-request@example.com"
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/email-verification/request",
      payload: {
        email: "verification-delivery-request@example.com"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(emailDelivery.emailVerificationEmails).toHaveLength(2);
    expect(emailDelivery.emailVerificationEmails[1]).toMatchObject({
      expiresInSeconds: 60 * 60 * 24,
      recipientEmail: "verification-delivery-request@example.com"
    });
    expect(emailDelivery.emailVerificationEmails[1]!.verificationUrl).toContain(
      "http://localhost:3000/auth/verify-email?token="
    );
  });

  it("email verification request for an already verified user remains generic", async () => {
    const user = await createUser(app, {
      email: "already-verified@example.com"
    });

    await app.db
      .update(users)
      .set({
        emailVerifiedAt: new Date()
      })
      .where(eq(users.id, user.user.id));

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/email-verification/request",
      payload: {
        email: "already-verified@example.com"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      data: {
        requested: true
      }
    });
  });

  it("register creates a session and sets an httpOnly refresh cookie", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Session Parent",
        email: "session-parent@example.com",
        password: "Password123!"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.accessToken).toEqual(expect.any(String));
    expect(response.body).not.toContain("refreshToken");
    expect(response.body).not.toContain("refresh_token");

    const refreshCookie = getRefreshSetCookie(response);
    const refreshToken = getCookieValue(refreshCookie);

    expect(refreshCookie).toContain("HttpOnly");
    expect(refreshCookie).toContain("SameSite=Lax");
    expect(refreshCookie).toContain("Path=/api/v1/auth");
    expect(refreshToken).toEqual(expect.any(String));

    const sessionRows = await app.db
      .select({
        refreshTokenHash: sessions.refreshTokenHash,
        revokedAt: sessions.revokedAt,
        userId: sessions.userId
      })
      .from(sessions)
      .where(eq(sessions.userId, response.json().data.user.id));

    expect(sessionRows).toEqual([
      {
        refreshTokenHash: hashRefreshToken(refreshToken),
        revokedAt: null,
        userId: response.json().data.user.id
      }
    ]);
    expect(sessionRows[0]?.refreshTokenHash).not.toBe(refreshToken);
  });

  it("login creates a session and sets an httpOnly refresh cookie", async () => {
    const user = await createUser(app, {
      email: "login-session@example.com",
      password: "Password123!"
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "login-session@example.com",
        password: "Password123!"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.accessToken).toEqual(expect.any(String));
    expect(response.body).not.toContain("refreshToken");
    expect(response.body).not.toContain("refresh_token");

    const refreshCookie = getRefreshSetCookie(response);
    const refreshToken = getCookieValue(refreshCookie);

    expect(refreshCookie).toContain("HttpOnly");
    expect(refreshCookie).toContain("SameSite=Lax");
    expect(refreshCookie).toContain("Path=/api/v1/auth");
    expect(refreshToken).toEqual(expect.any(String));

    const sessionRows = await app.db
      .select({
        refreshTokenHash: sessions.refreshTokenHash,
        userId: sessions.userId
      })
      .from(sessions)
      .where(eq(sessions.userId, user.user.id));

    expect(sessionRows).toHaveLength(2);
    expect(sessionRows.some((row) => row.refreshTokenHash === hashRefreshToken(refreshToken))).toBe(true);
  });

  it("returns 401 for auth refresh without a refresh cookie", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "UNAUTHORIZED"
      }
    });
  });

  it("returns 401 for auth refresh with an invalid refresh cookie", async () => {
    const response = await app.inject({
      headers: {
        cookie: `${REFRESH_TOKEN_COOKIE_NAME}=not-a-valid-refresh-token`
      },
      method: "POST",
      url: "/api/v1/auth/refresh"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "UNAUTHORIZED"
      }
    });
  });

  it("refreshes access token with a valid refresh cookie", async () => {
    const registerResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Refresh Parent",
        email: "refresh-parent@example.com",
        password: "Password123!"
      }
    });

    const firstRefreshCookie = getRefreshSetCookie(registerResponse);

    const refreshResponse = await app.inject({
      headers: {
        cookie: toCookieHeader(firstRefreshCookie)
      },
      method: "POST",
      url: "/api/v1/auth/refresh"
    });

    expect(refreshResponse.statusCode).toBe(200);
    expect(refreshResponse.json()).toMatchObject({
      ok: true,
      data: {
        user: {
          email: "refresh-parent@example.com"
        },
        profile: {
          displayName: "Refresh Parent"
        }
      }
    });
    expect(refreshResponse.json().data.accessToken).toEqual(expect.any(String));
    expect(refreshResponse.body).not.toContain("refreshToken");
    expect(refreshResponse.body).not.toContain("refresh_token");

    const nextRefreshCookie = getRefreshSetCookie(refreshResponse);

    expect(nextRefreshCookie).toContain("HttpOnly");
    expect(nextRefreshCookie).toContain("SameSite=Lax");
    expect(nextRefreshCookie).toContain("Path=/api/v1/auth");
  });

  it("rotates refresh token and rejects the old refresh cookie", async () => {
    const registerResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Rotated Parent",
        email: "rotated-parent@example.com",
        password: "Password123!"
      }
    });

    const firstRefreshCookie = getRefreshSetCookie(registerResponse);

    const firstRefreshResponse = await app.inject({
      headers: {
        cookie: toCookieHeader(firstRefreshCookie)
      },
      method: "POST",
      url: "/api/v1/auth/refresh"
    });

    expect(firstRefreshResponse.statusCode).toBe(200);

    const secondRefreshCookie = getRefreshSetCookie(firstRefreshResponse);

    expect(getCookieValue(secondRefreshCookie)).not.toBe(getCookieValue(firstRefreshCookie));

    const oldTokenResponse = await app.inject({
      headers: {
        cookie: toCookieHeader(firstRefreshCookie)
      },
      method: "POST",
      url: "/api/v1/auth/refresh"
    });

    expect(oldTokenResponse.statusCode).toBe(401);
    expect(oldTokenResponse.json()).toMatchObject({
      ok: false,
      error: {
        code: "UNAUTHORIZED"
      }
    });

    const newTokenResponse = await app.inject({
      headers: {
        cookie: toCookieHeader(secondRefreshCookie)
      },
      method: "POST",
      url: "/api/v1/auth/refresh"
    });

    expect(newTokenResponse.statusCode).toBe(200);
    expect(newTokenResponse.json().data.accessToken).toEqual(expect.any(String));
  });

  it("rejects refresh for a revoked session", async () => {
    const registerResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Revoked Parent",
        email: "revoked-parent@example.com",
        password: "Password123!"
      }
    });

    const refreshCookie = getRefreshSetCookie(registerResponse);

    await app.db
      .update(sessions)
      .set({
        revokedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(sessions.userId, registerResponse.json().data.user.id));

    const response = await app.inject({
      headers: {
        cookie: toCookieHeader(refreshCookie)
      },
      method: "POST",
      url: "/api/v1/auth/refresh"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "UNAUTHORIZED"
      }
    });
  });

  it("rejects refresh for an expired session", async () => {
    const registerResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Expired Parent",
        email: "expired-parent@example.com",
        password: "Password123!"
      }
    });

    const refreshCookie = getRefreshSetCookie(registerResponse);

    await app.db
      .update(sessions)
      .set({
        expiresAt: new Date(Date.now() - 60 * 1000),
        updatedAt: new Date()
      })
      .where(eq(sessions.userId, registerResponse.json().data.user.id));

    const response = await app.inject({
      headers: {
        cookie: toCookieHeader(refreshCookie)
      },
      method: "POST",
      url: "/api/v1/auth/refresh"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "UNAUTHORIZED"
      }
    });
  });

  it("logs out without a refresh cookie and clears the refresh cookie", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        loggedOut: true
      }
    });

    const clearCookie = getRefreshSetCookie(response);

    expect(clearCookie).toContain("HttpOnly");
    expect(clearCookie).toContain("SameSite=Lax");
    expect(clearCookie).toContain("Path=/api/v1/auth");
    expect(clearCookie).toContain("Max-Age=0");
    expect(clearCookie).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  });

  it("logout clears the refresh cookie", async () => {
    const registerResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Cookie Logout Parent",
        email: "cookie-logout-parent@example.com",
        password: "Password123!"
      }
    });

    const refreshCookie = getRefreshSetCookie(registerResponse);

    const logoutResponse = await app.inject({
      headers: {
        cookie: toCookieHeader(refreshCookie)
      },
      method: "POST",
      url: "/api/v1/auth/logout"
    });

    expect(logoutResponse.statusCode).toBe(200);

    const clearCookie = getRefreshSetCookie(logoutResponse);

    expect(clearCookie).toContain("Max-Age=0");
    expect(clearCookie).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    expect(clearCookie).toContain("HttpOnly");
    expect(clearCookie).toContain("SameSite=Lax");
    expect(clearCookie).toContain("Path=/api/v1/auth");
  });

  it("logout revokes the current refresh session", async () => {
    const registerResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Revoked Logout Parent",
        email: "revoked-logout-parent@example.com",
        password: "Password123!"
      }
    });

    const refreshCookie = getRefreshSetCookie(registerResponse);
    const refreshToken = getCookieValue(refreshCookie);

    const logoutResponse = await app.inject({
      headers: {
        cookie: toCookieHeader(refreshCookie)
      },
      method: "POST",
      url: "/api/v1/auth/logout"
    });

    expect(logoutResponse.statusCode).toBe(200);

    const [sessionRow] = await app.db
      .select({
        revokedAt: sessions.revokedAt
      })
      .from(sessions)
      .where(eq(sessions.refreshTokenHash, hashRefreshToken(refreshToken)))
      .limit(1);

    expect(sessionRow?.revokedAt).toBeInstanceOf(Date);
  });

  it("rejects refresh after logout", async () => {
    const registerResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Refresh After Logout Parent",
        email: "refresh-after-logout-parent@example.com",
        password: "Password123!"
      }
    });

    const refreshCookie = getRefreshSetCookie(registerResponse);

    const logoutResponse = await app.inject({
      headers: {
        cookie: toCookieHeader(refreshCookie)
      },
      method: "POST",
      url: "/api/v1/auth/logout"
    });

    expect(logoutResponse.statusCode).toBe(200);

    const refreshResponse = await app.inject({
      headers: {
        cookie: toCookieHeader(refreshCookie)
      },
      method: "POST",
      url: "/api/v1/auth/refresh"
    });

    expect(refreshResponse.statusCode).toBe(401);
    expect(refreshResponse.json()).toMatchObject({
      ok: false,
      error: {
        code: "UNAUTHORIZED"
      }
    });
  });

  it("logout with an invalid refresh cookie still returns 200", async () => {
    const response = await app.inject({
      headers: {
        cookie: `${REFRESH_TOKEN_COOKIE_NAME}=not-a-valid-refresh-token`
      },
      method: "POST",
      url: "/api/v1/auth/logout"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        loggedOut: true
      }
    });

    const clearCookie = getRefreshSetCookie(response);

    expect(clearCookie).toContain("Max-Age=0");
  });

  it("password reset request returns generic success and stores only a token hash", async () => {
    const user = await createUser(app, {
      email: "reset-existing@example.com"
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/password-reset/request",
      payload: {
        email: " RESET-EXISTING@Example.COM "
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        requested: true
      }
    });

    const resetToken = getDevResetToken(response);
    const tokenRows = await app.db
      .select({
        consumedAt: passwordResetTokens.consumedAt,
        tokenHash: passwordResetTokens.tokenHash,
        userId: passwordResetTokens.userId
      })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.user.id));

    expect(tokenRows).toHaveLength(1);
    expect(tokenRows[0]!.consumedAt).toBeNull();
    expect(tokenRows[0]!.tokenHash).toEqual(expect.any(String));
    expect(tokenRows[0]!.tokenHash).not.toBe(resetToken);
    expect(tokenRows[0]!.userId).toBe(user.user.id);
  });

  it("password reset request invokes the email delivery abstraction", async () => {
    const emailDelivery = await useEmailDeliveryTestApp();

    await createUser(app, {
      email: "reset-delivery@example.com"
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/password-reset/request",
      payload: {
        email: "reset-delivery@example.com"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(emailDelivery.passwordResetEmails).toHaveLength(1);
    expect(emailDelivery.passwordResetEmails[0]).toMatchObject({
      expiresInSeconds: 60 * 30,
      recipientEmail: "reset-delivery@example.com"
    });
    expect(emailDelivery.passwordResetEmails[0]!.resetUrl).toContain(
      "http://localhost:3000/reset-password?token="
    );
  });

  it("password reset request returns the same generic success for a missing email", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/password-reset/request",
      payload: {
        email: "missing@example.com"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      data: {
        requested: true
      }
    });

    const tokenRows = await app.db
      .select({ id: passwordResetTokens.id })
      .from(passwordResetTokens);

    expect(tokenRows).toHaveLength(0);
  });

  it("password reset confirm changes password, revokes sessions, and prevents token reuse", async () => {
    const user = await createUser(app, {
      email: "reset-confirm@example.com",
      password: "OldPassword123!"
    });
    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "reset-confirm@example.com",
        password: "OldPassword123!"
      }
    });
    const refreshCookie = getRefreshSetCookie(loginResponse);

    const requestResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/password-reset/request",
      payload: {
        email: "reset-confirm@example.com"
      }
    });
    const resetToken = getDevResetToken(requestResponse);

    const confirmResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/password-reset/confirm",
      payload: {
        newPassword: "NewPassword123!",
        token: resetToken
      }
    });

    expect(confirmResponse.statusCode).toBe(200);
    expect(confirmResponse.json()).toEqual({
      ok: true,
      data: {
        passwordReset: true
      }
    });

    const reusedTokenResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/password-reset/confirm",
      payload: {
        newPassword: "AnotherPassword123!",
        token: resetToken
      }
    });
    const oldPasswordLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "reset-confirm@example.com",
        password: "OldPassword123!"
      }
    });
    const newPasswordLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "reset-confirm@example.com",
        password: "NewPassword123!"
      }
    });
    const refreshResponse = await app.inject({
      headers: {
        cookie: toCookieHeader(refreshCookie)
      },
      method: "POST",
      url: "/api/v1/auth/refresh"
    });
    const activeSessions = await app.db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.userId, user.user.id), isNull(sessions.revokedAt)));

    expect(reusedTokenResponse.statusCode).toBe(400);
    expect(reusedTokenResponse.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_PASSWORD_RESET_TOKEN"
      }
    });
    expect(oldPasswordLogin.statusCode).toBe(401);
    expect(newPasswordLogin.statusCode).toBe(200);
    expect(refreshResponse.statusCode).toBe(401);
    expect(activeSessions).toHaveLength(1);
  });

  it("password reset confirm rejects expired tokens", async () => {
    const user = await createUser(app, {
      email: "expired-reset@example.com"
    });
    const requestResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/password-reset/request",
      payload: {
        email: "expired-reset@example.com"
      }
    });
    const resetToken = getDevResetToken(requestResponse);

    await app.db
      .update(passwordResetTokens)
      .set({
        expiresAt: new Date(Date.now() - 60 * 1000)
      })
      .where(eq(passwordResetTokens.userId, user.user.id));

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/password-reset/confirm",
      payload: {
        newPassword: "NewPassword123!",
        token: resetToken
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_PASSWORD_RESET_TOKEN"
      }
    });
  });

  it("authenticated password change requires current password, updates password, and revokes sessions", async () => {
    const user = await createUser(app, {
      email: "change-password@example.com",
      password: "OldPassword123!"
    });
    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "change-password@example.com",
        password: "OldPassword123!"
      }
    });
    const refreshCookie = getRefreshSetCookie(loginResponse);
    const token = loginResponse.json().data.accessToken;

    const wrongPasswordResponse = await app.inject({
      headers: authHeader(token),
      method: "POST",
      url: "/api/v1/auth/password/change",
      payload: {
        currentPassword: "WrongPassword123!",
        newPassword: "NewPassword123!"
      }
    });

    expect(wrongPasswordResponse.statusCode).toBe(401);
    expect(wrongPasswordResponse.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_CREDENTIALS"
      }
    });

    const changeResponse = await app.inject({
      headers: authHeader(token),
      method: "POST",
      url: "/api/v1/auth/password/change",
      payload: {
        currentPassword: "OldPassword123!",
        newPassword: "NewPassword123!"
      }
    });

    expect(changeResponse.statusCode).toBe(200);
    expect(changeResponse.json()).toEqual({
      ok: true,
      data: {
        passwordChanged: true
      }
    });
    expect(getRefreshSetCookie(changeResponse)).toContain("Max-Age=0");

    const oldPasswordLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "change-password@example.com",
        password: "OldPassword123!"
      }
    });
    const newPasswordLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "change-password@example.com",
        password: "NewPassword123!"
      }
    });
    const refreshResponse = await app.inject({
      headers: {
        cookie: toCookieHeader(refreshCookie)
      },
      method: "POST",
      url: "/api/v1/auth/refresh"
    });
    const activeSessions = await app.db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.userId, user.user.id), isNull(sessions.revokedAt)));

    expect(oldPasswordLogin.statusCode).toBe(401);
    expect(newPasswordLogin.statusCode).toBe(200);
    expect(refreshResponse.statusCode).toBe(401);
    expect(activeSessions).toHaveLength(1);
  });

  it("google start redirects to Google and sets an httpOnly oauth state cookie", async () => {
    await useGoogleOAuthTestApp({});

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/google/start"
    });

    expect(response.statusCode).toBe(302);

    const location = String(response.headers.location);
    const redirectUrl = new URL(location);

    expect(redirectUrl.origin).toBe("https://accounts.google.com");
    expect(redirectUrl.searchParams.get("client_id")).toBe("test-google-client-id");
    expect(redirectUrl.searchParams.get("redirect_uri")).toBe(
      "http://localhost:4000/api/v1/auth/google/callback"
    );
    expect(redirectUrl.searchParams.get("response_type")).toBe("code");
    expect(redirectUrl.searchParams.get("scope")).toBe("openid email profile");
    expect(redirectUrl.searchParams.get("state")).toEqual(expect.any(String));

    const stateCookie = getGoogleOAuthStateSetCookie(response);

    expect(stateCookie).toContain("HttpOnly");
    expect(stateCookie).toContain("SameSite=Lax");
    expect(stateCookie).toContain("Path=/api/v1/auth/google");
    expect(getCookieValue(stateCookie)).toBe(redirectUrl.searchParams.get("state"));
  });

  it("google start returns a controlled unavailable error when Google OAuth is not configured", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/google/start"
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "GOOGLE_AUTH_UNAVAILABLE",
        message: "Google OAuth is not configured."
      }
    });
  });

  it("google callback redirects to login unavailable error when Google OAuth is not configured", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/google/callback?state=state-a&code=google-code"
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(
      "http://localhost:3000/login?error=google_auth_unavailable"
    );
  });

  it("google callback rejects missing state", async () => {
    await useGoogleOAuthTestApp({});

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/google/callback?code=google-code"
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("http://localhost:3000/login?error=google_auth_failed");
  });

  it("google callback rejects mismatched state", async () => {
    await useGoogleOAuthTestApp({});

    const response = await app.inject({
      headers: {
        cookie: `${GOOGLE_OAUTH_STATE_COOKIE_NAME}=state-from-cookie`
      },
      method: "GET",
      url: "/api/v1/auth/google/callback?state=query-state&code=google-code"
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("http://localhost:3000/login?error=google_auth_failed");
  });

  it("google callback rejects missing code", async () => {
    await useGoogleOAuthTestApp({});

    const response = await app.inject({
      headers: {
        cookie: `${GOOGLE_OAUTH_STATE_COOKIE_NAME}=state-a`
      },
      method: "GET",
      url: "/api/v1/auth/google/callback?state=state-a"
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("http://localhost:3000/login?error=google_auth_failed");
  });

  it("google callback creates a new verified Google user, profile, auth account, and session", async () => {
    await useGoogleOAuthTestApp({
      "new-user-code": {
        email: "  Google.Parent@Example.COM  ",
        email_verified: true,
        name: "Google Parent",
        sub: "google-sub-new-user"
      }
    });

    const response = await app.inject({
      headers: {
        cookie: `${GOOGLE_OAUTH_STATE_COOKIE_NAME}=state-new`
      },
      method: "GET",
      url: "/api/v1/auth/google/callback?state=state-new&code=new-user-code"
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("http://localhost:3000/auth/callback?status=success");

    const refreshCookie = getRefreshSetCookie(response);
    const stateCookie = getGoogleOAuthStateSetCookie(response);

    expect(refreshCookie).toContain("HttpOnly");
    expect(stateCookie).toContain("Max-Age=0");

    const [userRow] = await app.db
      .select({
        email: users.email,
        emailVerifiedAt: users.emailVerifiedAt,
        id: users.id
      })
      .from(users)
      .where(eq(users.email, "google.parent@example.com"));

    expect(userRow).toBeDefined();
    expect(userRow?.emailVerifiedAt).toBeInstanceOf(Date);

    const profileRows = await app.db
      .select({
        displayName: profiles.displayName,
        userId: profiles.userId
      })
      .from(profiles)
      .where(eq(profiles.userId, userRow!.id));

    const accountRows = await app.db
      .select({
        email: authAccounts.email,
        provider: authAccounts.provider,
        providerAccountId: authAccounts.providerAccountId,
        userId: authAccounts.userId
      })
      .from(authAccounts)
      .where(eq(authAccounts.userId, userRow!.id));

    const sessionRows = await app.db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.userId, userRow!.id));

    expect(profileRows).toEqual([
      {
        displayName: "Google Parent",
        userId: userRow!.id
      }
    ]);
    expect(accountRows).toEqual([
      {
        email: "google.parent@example.com",
        provider: "google",
        providerAccountId: "google-sub-new-user",
        userId: userRow!.id
      }
    ]);
    expect(sessionRows).toHaveLength(1);
  });

  it("google callback links an existing password user by normalized email", async () => {
    await useGoogleOAuthTestApp({
      "link-code": {
        email: " LINKED@Example.COM ",
        email_verified: true,
        name: "Linked Google",
        sub: "google-sub-linked"
      }
    });
    const existingUser = await createUser(app, {
      email: "linked@example.com"
    });

    const response = await app.inject({
      headers: {
        cookie: `${GOOGLE_OAUTH_STATE_COOKIE_NAME}=state-link`
      },
      method: "GET",
      url: "/api/v1/auth/google/callback?state=state-link&code=link-code"
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("http://localhost:3000/auth/callback?status=success");

    const userRows = await app.db
      .select({ emailVerifiedAt: users.emailVerifiedAt, id: users.id })
      .from(users)
      .where(eq(users.email, "linked@example.com"));

    const googleAccountRows = await app.db
      .select({
        provider: authAccounts.provider,
        providerAccountId: authAccounts.providerAccountId,
        userId: authAccounts.userId
      })
      .from(authAccounts)
      .where(
        and(
          eq(authAccounts.provider, "google"),
          eq(authAccounts.providerAccountId, "google-sub-linked")
        )
      );

    expect(userRows).toHaveLength(1);
    expect(userRows[0]!.id).toBe(existingUser.user.id);
    expect(userRows[0]!.emailVerifiedAt).toBeInstanceOf(Date);
    expect(googleAccountRows).toEqual([
      {
        provider: "google",
        providerAccountId: "google-sub-linked",
        userId: existingUser.user.id
      }
    ]);
  });

  it("google callback reuses an existing Google auth account", async () => {
    await useGoogleOAuthTestApp({
      "first-code": {
        email: "reuse@example.com",
        email_verified: true,
        name: "Reuse Parent",
        sub: "google-sub-reuse"
      },
      "second-code": {
        email: "reuse@example.com",
        email_verified: true,
        name: "Reuse Parent",
        sub: "google-sub-reuse"
      }
    });

    for (const code of ["first-code", "second-code"]) {
      const response = await app.inject({
        headers: {
          cookie: `${GOOGLE_OAUTH_STATE_COOKIE_NAME}=state-${code}`
        },
        method: "GET",
        url: `/api/v1/auth/google/callback?state=state-${code}&code=${code}`
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe("http://localhost:3000/auth/callback?status=success");
    }

    const userRows = await app.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, "reuse@example.com"));

    expect(userRows).toHaveLength(1);

    const accountRows = await app.db
      .select({ id: authAccounts.id, userId: authAccounts.userId })
      .from(authAccounts)
      .where(
        and(
          eq(authAccounts.provider, "google"),
          eq(authAccounts.providerAccountId, "google-sub-reuse")
        )
      );

    const sessionRows = await app.db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.userId, userRows[0]!.id));

    expect(accountRows).toHaveLength(1);
    expect(accountRows[0]!.userId).toBe(userRows[0]!.id);
    expect(sessionRows).toHaveLength(2);
  });

  it("google callback rejects unverified email without creating account state", async () => {
    await useGoogleOAuthTestApp({
      "unverified-code": {
        email: "unverified@example.com",
        email_verified: false,
        name: "Unverified",
        sub: "google-sub-unverified"
      }
    });

    const response = await app.inject({
      headers: {
        cookie: `${GOOGLE_OAUTH_STATE_COOKIE_NAME}=state-unverified`
      },
      method: "GET",
      url: "/api/v1/auth/google/callback?state=state-unverified&code=unverified-code"
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("http://localhost:3000/login?error=google_auth_failed");

    const userRows = await app.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, "unverified@example.com"));
    const accountRows = await app.db
      .select({ id: authAccounts.id })
      .from(authAccounts)
      .where(
        and(
          eq(authAccounts.provider, "google"),
          eq(authAccounts.providerAccountId, "google-sub-unverified")
        )
      );

    expect(userRows).toHaveLength(0);
    expect(accountRows).toHaveLength(0);
  });

  it("google callback rejects profile without email", async () => {
    await useGoogleOAuthTestApp({
      "no-email-code": {
        email_verified: true,
        name: "No Email",
        sub: "google-sub-no-email"
      }
    });

    const response = await app.inject({
      headers: {
        cookie: `${GOOGLE_OAUTH_STATE_COOKIE_NAME}=state-no-email`
      },
      method: "GET",
      url: "/api/v1/auth/google/callback?state=state-no-email&code=no-email-code"
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("http://localhost:3000/login?error=google_auth_failed");

    const accountRows = await app.db
      .select({ id: authAccounts.id })
      .from(authAccounts)
      .where(
        and(
          eq(authAccounts.provider, "google"),
          eq(authAccounts.providerAccountId, "google-sub-no-email")
        )
      );

    expect(accountRows).toHaveLength(0);
  });

  it("rolls back user and profile when password auth account creation fails", async () => {
    const existingUser = await createUser(app, {
      email: "existing-account-owner@example.com"
    });

    const conflictEmail = "conflict@example.com";

    await app.db.insert(authAccounts).values({
      email: conflictEmail,
      provider: "password",
      providerAccountId: conflictEmail,
      userId: existingUser.user.id
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Rollback Candidate",
        email: conflictEmail,
        password: "Password123!"
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "EMAIL_ALREADY_REGISTERED"
      }
    });

    expect(response.body).not.toContain("auth_accounts_provider_account_unique");
    expect(response.body).not.toContain("users_email_unique");
    expect(response.body).not.toContain("23505");
    expect(response.body).not.toContain("duplicate key");
    expect(response.body).not.toContain("violates unique constraint");

    const userRows = await app.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, conflictEmail));

    const profileRows = await app.db
      .select({ id: profiles.id })
      .from(profiles)
      .innerJoin(users, eq(profiles.userId, users.id))
      .where(eq(users.email, conflictEmail));

    const accountRows = await app.db
      .select({
        provider: authAccounts.provider,
        providerAccountId: authAccounts.providerAccountId,
        userId: authAccounts.userId
      })
      .from(authAccounts)
      .where(
        and(
          eq(authAccounts.provider, "password"),
          eq(authAccounts.providerAccountId, conflictEmail)
        )
      );

    expect(userRows).toHaveLength(0);
    expect(profileRows).toHaveLength(0);
    expect(accountRows).toEqual([
      {
        provider: "password",
        providerAccountId: conflictEmail,
        userId: existingUser.user.id
      }
    ]);
  });

  it("rejects invalid register email", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Invalid Email",
        email: "not-an-email",
        password: "Password123!"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_REQUEST"
      }
    });
  });

  it("rejects short register password", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Short Password",
        email: "short-password@example.com",
        password: "short"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_REQUEST"
      }
    });
  });

  it("rejects duplicate email", async () => {
    const user = await createUser(app, {
      email: "duplicate@example.com"
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Duplicate",
        email: user.user.email,
        password: "Password123!"
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "EMAIL_ALREADY_REGISTERED"
      }
    });

    expect(response.body).not.toContain("users_email_unique");
    expect(response.body).not.toContain("auth_accounts_provider_account_unique");
    expect(response.body).not.toContain("23505");

    const userRows = await app.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, "duplicate@example.com"));

    const accountRows = await app.db
      .select({ id: authAccounts.id })
      .from(authAccounts)
      .where(
        and(
          eq(authAccounts.provider, "password"),
          eq(authAccounts.providerAccountId, "duplicate@example.com")
        )
      );

    expect(userRows).toHaveLength(1);
    expect(accountRows).toHaveLength(1);
  });

  it("rejects duplicate normalized email", async () => {
    await createUser(app, {
      email: "Parent@Example.com"
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "Duplicate Normalized",
        email: " parent@example.COM ",
        password: "Password123!"
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "EMAIL_ALREADY_REGISTERED"
      }
    });

    expect(response.body).not.toContain("users_email_unique");
    expect(response.body).not.toContain("auth_accounts_provider_account_unique");
    expect(response.body).not.toContain("23505");

    const userRows = await app.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, "parent@example.com"));

    const accountRows = await app.db
      .select({ id: authAccounts.id })
      .from(authAccounts)
      .where(
        and(
          eq(authAccounts.provider, "password"),
          eq(authAccounts.providerAccountId, "parent@example.com")
        )
      );

    expect(userRows).toHaveLength(1);
    expect(accountRows).toHaveLength(1);
  });

  it("logs in a valid user", async () => {
    await createUser(app, {
      email: "login@example.com",
      password: "Password123!"
    });

    const login = await loginUser(app, " LOGIN@Example.COM ", "Password123!");

    expect(login.accessToken).toEqual(expect.any(String));
    expect(login.user.email).toBe("login@example.com");
  });

  it("normalizes login email", async () => {
    await createUser(app, {
      email: "normalized-login@example.com",
      password: "Password123!"
    });

    const login = await loginUser(app, "  NORMALIZED-LOGIN@Example.COM  ", "Password123!");

    expect(login.user.email).toBe("normalized-login@example.com");
  });

  it("rejects invalid password", async () => {
    await createUser(app, {
      email: "wrong-password@example.com",
      password: "Password123!"
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "wrong-password@example.com",
        password: "WrongPassword"
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_CREDENTIALS"
      }
    });
  });

  it("normal login is unchanged when MFA is disabled", async () => {
    const user = await createUser(app, {
      email: "mfa-disabled@example.com"
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "mfa-disabled@example.com",
        password: "Password123!"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.accessToken).toEqual(expect.any(String));
    expect(response.json().data.user.id).toBe(user.user.id);
    expect(getRefreshSetCookie(response)).toContain("HttpOnly");
  });

  it("MFA enabled login returns a challenge without issuing a session", async () => {
    const emailDelivery = await useEmailDeliveryTestApp();
    const user = await createUser(app, {
      email: "mfa-enabled@example.com"
    });

    await app.db
      .update(users)
      .set({
        mfaEnabled: true
      })
      .where(eq(users.id, user.user.id));

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "mfa-enabled@example.com",
        password: "Password123!"
      }
    });
    const sessionRows = await app.db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.userId, user.user.id));

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        challengeId: expect.any(String),
        devOtpCode: expect.stringMatching(/^\d{6}$/),
        mfaRequired: true
      }
    });
    expect(response.body).not.toContain("accessToken");
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(sessionRows).toHaveLength(1);
    expect(emailDelivery.mfaOtpEmails).toHaveLength(1);
    expect(emailDelivery.mfaOtpEmails[0]).toMatchObject({
      code: response.json().data.devOtpCode,
      expiresInSeconds: 60 * 10,
      recipientEmail: "mfa-enabled@example.com"
    });
  });

  it("MFA verify accepts a valid OTP and creates an auth session", async () => {
    const user = await createUser(app, {
      email: "mfa-verify@example.com"
    });

    await app.db
      .update(users)
      .set({
        mfaEnabled: true
      })
      .where(eq(users.id, user.user.id));

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "mfa-verify@example.com",
        password: "Password123!"
      }
    });
    const verify = await app.inject({
      method: "POST",
      url: "/api/v1/auth/mfa/verify",
      payload: {
        challengeId: login.json().data.challengeId,
        code: login.json().data.devOtpCode
      }
    });

    const [challengeRow] = await app.db
      .select({ consumedAt: mfaOtpChallenges.consumedAt })
      .from(mfaOtpChallenges)
      .where(eq(mfaOtpChallenges.id, login.json().data.challengeId));

    expect(verify.statusCode).toBe(200);
    expect(verify.json().data.accessToken).toEqual(expect.any(String));
    expect(getRefreshSetCookie(verify)).toContain("HttpOnly");
    expect(challengeRow?.consumedAt).toBeInstanceOf(Date);
  });

  it("MFA verify rejects invalid, expired, and reused OTP codes", async () => {
    const user = await createUser(app, {
      email: "mfa-invalid@example.com"
    });
    const validCode = "123456";
    const expiredCode = "654321";

    await app.db.insert(mfaOtpChallenges).values([
      {
        codeHash: hashMfaOtpCode(validCode),
        expiresAt: new Date(Date.now() + 60_000),
        purpose: "login",
        userId: user.user.id
      },
      {
        codeHash: hashMfaOtpCode(expiredCode),
        expiresAt: new Date(Date.now() - 60_000),
        purpose: "login",
        userId: user.user.id
      }
    ]);

    const [validChallenge] = await app.db
      .select({ id: mfaOtpChallenges.id })
      .from(mfaOtpChallenges)
      .where(eq(mfaOtpChallenges.codeHash, hashMfaOtpCode(validCode)));
    const [expiredChallenge] = await app.db
      .select({ id: mfaOtpChallenges.id })
      .from(mfaOtpChallenges)
      .where(eq(mfaOtpChallenges.codeHash, hashMfaOtpCode(expiredCode)));

    const invalid = await app.inject({
      method: "POST",
      url: "/api/v1/auth/mfa/verify",
      payload: {
        challengeId: validChallenge!.id,
        code: "000000"
      }
    });
    const expired = await app.inject({
      method: "POST",
      url: "/api/v1/auth/mfa/verify",
      payload: {
        challengeId: expiredChallenge!.id,
        code: expiredCode
      }
    });
    const firstUse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/mfa/verify",
      payload: {
        challengeId: validChallenge!.id,
        code: validCode
      }
    });
    const reused = await app.inject({
      method: "POST",
      url: "/api/v1/auth/mfa/verify",
      payload: {
        challengeId: validChallenge!.id,
        code: validCode
      }
    });

    expect(invalid.statusCode).toBe(400);
    expect(expired.statusCode).toBe(400);
    expect(firstUse.statusCode).toBe(200);
    expect(reused.statusCode).toBe(400);
    expect(reused.json()).toMatchObject({
      ok: false,
      error: {
        code: "MFA_CODE_INVALID"
      }
    });
  });

  it("MFA challenge response does not expose devOtpCode outside test mode", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const user = await createUser(app, {
        email: "mfa-production@example.com"
      });

      await app.db
        .update(users)
        .set({
          mfaEnabled: true
        })
        .where(eq(users.id, user.user.id));

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: "mfa-production@example.com",
          password: "Password123!"
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.mfaRequired).toBe(true);
      expect(response.body).not.toContain("devOtpCode");
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it("returns auth/me with a valid token", async () => {
    const user = await createUser(app);

    const response = await app.inject({
      headers: authHeader(user.accessToken),
      method: "GET",
      url: "/api/v1/auth/me"
    });

    expect(response.statusCode).toBe(200);

    expect(response.body).not.toContain("passwordHash");
    expect(response.body).not.toContain("password_hash");
    expect(response.body).not.toContain("authAccounts");
    expect(response.body).not.toContain("auth_accounts");
    expect(response.body).not.toContain("providerAccountId");
    expect(response.body).not.toContain("provider_account_id");
    expect(response.body).not.toContain("refreshToken");
    expect(response.body).not.toContain("refresh_token");

    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        user: {
          id: user.user.id
        },
        profile: {
          id: user.profile.id
        }
      }
    });
  });

  it("returns 401 for auth/me without token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "UNAUTHORIZED"
      }
    });
  });

  it("returns 401 for auth/me with an invalid token", async () => {
    const response = await app.inject({
      headers: authHeader("not-a-valid-token"),
      method: "GET",
      url: "/api/v1/auth/me"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "UNAUTHORIZED"
      }
    });
  });

  it("rate limits auth login attempts", async () => {
    await app.close();

    app = await createTestApp({
      authRateLimitMax: 1,
      authRateLimitWindowSeconds: 60
    });

    const first = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "missing@example.com",
        password: "Password123!"
      }
    });

    const limited = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "missing@example.com",
        password: "Password123!"
      }
    });

    expect(first.statusCode).toBe(401);
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({
      ok: false,
      error: {
        code: "RATE_LIMITED"
      }
    });
  });
});

describe("listings API", () => {
  it("publicly lists active listings", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/listings"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.listings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: listing.id
        })
      ])
    );
  });

  it("searches active listings by title", async () => {
    const seller = await createUser(app);
    const stroller = await createListing(app, seller.accessToken, {
      title: "Blue Nuna stroller"
    });
    const puzzle = await createListing(app, seller.accessToken, {
      title: "Wooden puzzle set"
    });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/listings?q=stroller"
    });
    const listingIds = response.json().data.listings.map((listing: { id: string }) => listing.id);

    expect(response.statusCode).toBe(200);
    expect(listingIds).toContain(stroller.id);
    expect(listingIds).not.toContain(puzzle.id);
  });

  it("searches active listings by partial case-insensitive title", async () => {
    const seller = await createUser(app);
    const stroller = await createListing(app, seller.accessToken, {
      title: "Blue Nuna stroller"
    });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/listings?q=NuNa"
    });
    const listingIds = response.json().data.listings.map((listing: { id: string }) => listing.id);

    expect(response.statusCode).toBe(200);
    expect(listingIds).toContain(stroller.id);
  });

  it("does not narrow listing search below three characters", async () => {
    const seller = await createUser(app);
    const stroller = await createListing(app, seller.accessToken, {
      title: "Blue Nuna stroller"
    });
    const puzzle = await createListing(app, seller.accessToken, {
      title: "Wooden puzzle set"
    });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/listings?q=nu"
    });
    const listingIds = response.json().data.listings.map((listing: { id: string }) => listing.id);

    expect(response.statusCode).toBe(200);
    expect(listingIds).toContain(stroller.id);
    expect(listingIds).toContain(puzzle.id);
  });

  it("does not publicly list inactive listings", async () => {
    const seller = await createUser(app);
    const activeListing = await createListing(app, seller.accessToken);
    const archivedListing = await createListing(app, seller.accessToken);
    await app.db
      .update(listings)
      .set({ status: "archived" })
      .where(eq(listings.id, archivedListing.id));

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/listings"
    });
    const listingIds = response.json().data.listings.map((listing: { id: string }) => listing.id);

    expect(response.statusCode).toBe(200);
    expect(listingIds).toContain(activeListing.id);
    expect(listingIds).not.toContain(archivedListing.id);
  });

  it("publicly returns active listing detail", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/listings/${listing.id}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        listing: {
          id: listing.id,
          seller: {
            id: seller.profile.id
          }
        }
      }
    });
  });

  it("does not publicly return inactive listing detail", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    await app.db
      .update(listings)
      .set({ status: "archived" })
      .where(eq(listings.id, listing.id));

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/listings/${listing.id}`
    });

    expect(response.statusCode).toBe(404);
  });

  it("returns 401 for unauthenticated listing creation", async () => {
    const category = await createCategory(app.db);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        categoryId: category.id,
        condition: "good",
        listingType: "sale",
        title: "Unauthenticated listing"
      }
    });

    expect(response.statusCode).toBe(401);
  });

  it("rejects listing creation with unknown categoryId", async () => {
    const seller = await createUser(app);
    const response = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        categoryId: "99999999-9999-4999-8999-999999999999",
        condition: "good",
        listingType: "sale",
        title: "Unknown category listing"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_CATEGORY"
      }
    });
  });

  it("rejects invalid listing image URLs and more than five image URLs", async () => {
    const seller = await createUser(app);
    const category = await createCategory(app.db);
    const invalidUrl = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        categoryId: category.id,
        condition: "good",
        imageUrls: ["not-a-url"],
        listingType: "sale",
        title: "Invalid image URL listing"
      }
    });
    const tooManyUrls = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        categoryId: category.id,
        condition: "good",
        imageUrls: [
          "https://example.com/1.jpg",
          "https://example.com/2.jpg",
          "https://example.com/3.jpg",
          "https://example.com/4.jpg",
          "https://example.com/5.jpg",
          "https://example.com/6.jpg"
        ],
        listingType: "sale",
        title: "Too many image URLs listing"
      }
    });

    expect(invalidUrl.statusCode).toBe(400);
    expect(tooManyUrls.statusCode).toBe(400);
  });

  it("creates a listing for authenticated user", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    expect(listing.id).toEqual(expect.any(String));
  });

  it("creates listings for active MVP listing types", async () => {
    const seller = await createUser(app);
    const sale = await createListing(app, seller.accessToken, {
      listingType: "sale",
      title: "Sale listing"
    });
    const donation = await createListing(app, seller.accessToken, {
      listingType: "donation",
      title: "Donation listing"
    });
    const swap = await createListing(app, seller.accessToken, {
      listingType: "swap",
      title: "Swap listing"
    });

    expect(sale.id).toEqual(expect.any(String));
    expect(donation.id).toEqual(expect.any(String));
    expect(swap.id).toEqual(expect.any(String));
  });

  it("rejects rent listing creation because rentals are deferred from MVP scope", async () => {
    const seller = await createUser(app);
    const category = await createCategory(app.db);
    const response = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        categoryId: category.id,
        condition: "good",
        listingType: "rent",
        title: "Rental listing should be rejected"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_REQUEST"
      }
    });
  });

  it("stores listing images in sortOrder order", async () => {
    const seller = await createUser(app);
    const category = await createCategory(app.db);
    const imageUrls = [
      "https://example.com/first.jpg",
      "https://example.com/second.jpg",
      "https://example.com/third.jpg"
    ];
    const response = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        categoryId: category.id,
        condition: "good",
        imageUrls,
        listingType: "sale",
        title: "Ordered image listing"
      }
    });
    const listingId = response.json().data.listing.id;
    const images = await app.db
      .select({
        sortOrder: listingImages.sortOrder,
        url: listingImages.url
      })
      .from(listingImages)
      .where(eq(listingImages.listingId, listingId))
      .orderBy(asc(listingImages.sortOrder));

    expect(response.statusCode).toBe(201);
    expect(images).toEqual([
      { sortOrder: 0, url: imageUrls[0] },
      { sortOrder: 1, url: imageUrls[1] },
      { sortOrder: 2, url: imageUrls[2] }
    ]);
  });

  it("rejects client seller profile spoofing", async () => {
    const seller = await createUser(app);
    const category = await createCategory(app.db);
    const response = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        categoryId: category.id,
        condition: "good",
        listingType: "sale",
        sellerProfileId: "10000000-0000-4000-8000-000000000001",
        title: "Spoofed seller listing"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_REQUEST"
      }
    });
  });

  it("rejects invalid listingType, invalid condition, and unknown extra fields", async () => {
    const seller = await createUser(app);
    const category = await createCategory(app.db);
    const basePayload = {
      categoryId: category.id,
      condition: "good",
      listingType: "sale",
      title: "Invalid contract listing"
    };

    const invalidListingType = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        ...basePayload,
        listingType: "auction"
      }
    });
    const invalidCondition = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        ...basePayload,
        condition: "excellent"
      }
    });
    const extraFields = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/listings",
      payload: {
        ...basePayload,
        sellerProfileId: seller.profile.id,
        status: "archived"
      }
    });

    expect(invalidListingType.statusCode).toBe(400);
    expect(invalidCondition.statusCode).toBe(400);
    expect(extraFields.statusCode).toBe(400);
    expect(extraFields.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_REQUEST"
      }
    });
  });

  it("returns 401 for unauthenticated current user listings", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/me/listings"
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns only listings owned by the authenticated user", async () => {
    const owner = await createUser(app);
    const otherUser = await createUser(app);
    const ownerActiveListing = await createListing(app, owner.accessToken);
    const ownerArchivedListing = await createListing(app, owner.accessToken);
    const otherListing = await createListing(app, otherUser.accessToken);
    await app.db
      .update(listings)
      .set({ status: "archived" })
      .where(eq(listings.id, ownerArchivedListing.id));

    const response = await app.inject({
      headers: authHeader(owner.accessToken),
      method: "GET",
      url: "/api/v1/me/listings"
    });
    const ownedListingIds = response.json().data.listings.map((listing: { id: string }) => listing.id);

    expect(response.statusCode).toBe(200);
    expect(ownedListingIds).toContain(ownerActiveListing.id);
    expect(ownedListingIds).toContain(ownerArchivedListing.id);
    expect(ownedListingIds).not.toContain(otherListing.id);
  });

  it("does not expose internal seller user id in public listing list", async () => {
    const seller = await createUser(app);
    await createListing(app, seller.accessToken);
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/listings"
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain(seller.user.id);
    expect(response.body).not.toContain("userId");
    expect(response.body).not.toContain("user_id");
  });

  it("does not expose password hash or user email in listing detail", async () => {
    const seller = await createUser(app, { email: "seller-private@example.com" });
    const listing = await createListing(app, seller.accessToken);
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/listings/${listing.id}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain("passwordHash");
    expect(response.body).not.toContain("password_hash");
    expect(response.body).not.toContain("seller-private@example.com");
  });
});

describe("favorites API", () => {
  it("returns 401 for unauthenticated favorite action", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });

    expect(response.statusCode).toBe(401);
  });

  it("accepts listingId body and rejects old listing_id body", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    const okResponse = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });

    const oldContractResponse = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listing_id: listing.id
      }
    });

    expect(okResponse.statusCode).toBe(201);
    expect(oldContractResponse.statusCode).toBe(400);
  });

  it("rejects favoriting own listing without logging an event", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    const response = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });
    const favoriteAddedEvents = await countEvents("favorite_added", listing.id);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "CANNOT_FAVORITE_OWN_LISTING"
      }
    });
    expect(favoriteAddedEvents).toBe(0);
  });

  it("rejects favoriting inactive listings", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    await app.db
      .update(listings)
      .set({ status: "archived" })
      .where(eq(listings.id, listing.id));

    const response = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "LISTING_NOT_ACTIVE"
      }
    });
  });

  it("handles duplicate favorite idempotently and removes favorite", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    const first = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });
    const duplicate = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });
    const removed = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "DELETE",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });
    const removedAgain = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "DELETE",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });
    const favoriteAddedEvents = await countEvents("favorite_added", listing.id);
    const favoriteRemovedEvents = await countEvents("favorite_removed", listing.id);

    expect(first.statusCode).toBe(201);
    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json().data.created).toBe(false);
    expect(removed.statusCode).toBe(200);
    expect(removed.json().data.removed).toBe(true);
    expect(removedAgain.statusCode).toBe(200);
    expect(removedAgain.json().data.removed).toBe(false);
    expect(favoriteAddedEvents).toBe(1);
    expect(favoriteRemovedEvents).toBe(1);
  });

  it("requires auth to list favorites", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/favorites"
    });

    expect(response.statusCode).toBe(401);
  });

  it("lists only current user's favorites", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const otherBuyer = await createUser(app);
    const buyerListing = await createListing(app, seller.accessToken, {
      title: "Buyer favorite listing"
    });
    const otherBuyerListing = await createListing(app, seller.accessToken, {
      title: "Other buyer favorite listing"
    });

    await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId: buyerListing.id
      }
    });
    await app.inject({
      headers: authHeader(otherBuyer.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId: otherBuyerListing.id
      }
    });

    const response = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "GET",
      url: "/api/v1/favorites"
    });
    const favoriteIds = response.json().data.favorites.map((favorite: { id: string }) => favorite.id);

    expect(response.statusCode).toBe(200);
    expect(favoriteIds).toContain(buyerListing.id);
    expect(favoriteIds).not.toContain(otherBuyerListing.id);
  });

  it("cannot delete someone else's favorite by listingId", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const otherBuyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });
    const response = await app.inject({
      headers: authHeader(otherBuyer.accessToken),
      method: "DELETE",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });
    const remainingFavorites = await app.db
      .select({
        id: favorites.id
      })
      .from(favorites)
      .where(and(eq(favorites.profileId, buyer.profile.id), eq(favorites.listingId, listing.id)));
    const favoriteRemovedEvents = await countEvents("favorite_removed", listing.id);

    expect(response.statusCode).toBe(200);
    expect(response.json().data.removed).toBe(false);
    expect(remainingFavorites).toHaveLength(1);
    expect(favoriteRemovedEvents).toBe(0);
  });

  it("keeps profile favorites route self-only", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const otherBuyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/favorites",
      payload: {
        listingId: listing.id
      }
    });

    const own = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "GET",
      url: `/api/v1/profiles/${buyer.profile.id}/favorites`
    });
    const other = await app.inject({
      headers: authHeader(otherBuyer.accessToken),
      method: "GET",
      url: `/api/v1/profiles/${buyer.profile.id}/favorites`
    });

    expect(own.statusCode).toBe(200);
    expect(own.json().data.favorites.map((favorite: { id: string }) => favorite.id)).toContain(listing.id);
    expect(other.statusCode).toBe(403);
  });
});

describe("messaging API", () => {
  it("returns 401 for unauthenticated conversation create", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/conversations",
      payload: {
        listingId: listing.id
      }
    });

    expect(response.statusCode).toBe(401);
  });

  it("rejects conversation create for inactive listing", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    await app.db
      .update(listings)
      .set({ status: "archived" })
      .where(eq(listings.id, listing.id));

    const response = await createConversation(buyer.accessToken, listing.id);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_LISTING"
      }
    });
  });

  it("rejects invalid conversation listingId and extra profile fields", async () => {
    const buyer = await createUser(app);
    const invalidListingId = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/conversations",
      payload: {
        listingId: "not-a-uuid"
      }
    });
    const extraFields = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/conversations",
      payload: {
        buyerProfileId: buyer.profile.id,
        listingId: "99999999-9999-4999-8999-999999999999",
        profileHighId: buyer.profile.id,
        profileLowId: buyer.profile.id,
        sellerProfileId: buyer.profile.id
      }
    });

    expect(invalidListingId.statusCode).toBe(400);
    expect(extraFields.statusCode).toBe(400);
    expect(extraFields.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_REQUEST"
      }
    });
  });

  it("accepts listingId and prevents seller messaging own listing", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    const buyerResponse = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: "/api/v1/conversations",
      payload: {
        listingId: listing.id
      }
    });
    const sellerResponse = await app.inject({
      headers: authHeader(seller.accessToken),
      method: "POST",
      url: "/api/v1/conversations",
      payload: {
        listingId: listing.id
      }
    });

    expect(buyerResponse.statusCode).toBe(201);
    expect(sellerResponse.statusCode).toBe(400);
    expect(sellerResponse.json()).toMatchObject({
      ok: false,
      error: {
        code: "CANNOT_MESSAGE_SELF"
      }
    });
  });

  it("reuses the same conversation for the same two profiles", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);

    const first = await createConversation(buyer.accessToken, listing.id);
    const second = await createConversation(buyer.accessToken, listing.id);

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json().data.conversation.id).toBe(first.json().data.conversation.id);
  });

  it("requires auth to list conversations and returns only current user's conversations", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const otherSeller = await createUser(app);
    const outsider = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const otherListing = await createListing(app, otherSeller.accessToken);
    const buyerConversation = (await createConversation(buyer.accessToken, listing.id)).json().data.conversation;
    const outsiderConversation = (await createConversation(outsider.accessToken, otherListing.id)).json().data.conversation;

    const unauthenticated = await app.inject({
      method: "GET",
      url: "/api/v1/conversations"
    });
    const buyerList = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "GET",
      url: "/api/v1/conversations"
    });
    const conversationIds = buyerList.json().data.conversations.map(
      (conversation: { id: string }) => conversation.id
    );

    expect(unauthenticated.statusCode).toBe(401);
    expect(buyerList.statusCode).toBe(200);
    expect(conversationIds).toContain(buyerConversation.id);
    expect(conversationIds).not.toContain(outsiderConversation.id);
  });

  it("returns one conversation summary for participants only", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const outsider = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const conversation = (await createConversation(buyer.accessToken, listing.id)).json().data.conversation;

    const participant = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "GET",
      url: `/api/v1/conversations/${conversation.id}`
    });
    const nonParticipant = await app.inject({
      headers: authHeader(outsider.accessToken),
      method: "GET",
      url: `/api/v1/conversations/${conversation.id}`
    });
    const missing = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "GET",
      url: "/api/v1/conversations/99999999-9999-4999-8999-999999999999"
    });

    expect(participant.statusCode).toBe(200);
    expect(participant.json()).toMatchObject({
      ok: true,
      data: {
        conversation: {
          id: conversation.id,
          contextListing: {
            id: listing.id
          }
        }
      }
    });
    expect(nonParticipant.statusCode).toBe(403);
    expect(missing.statusCode).toBe(404);
  });

  it("allows participants to send messages and blocks non-participants", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const outsider = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const conversation = (await createConversation(buyer.accessToken, listing.id)).json().data.conversation;

    const participantMessage = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      payload: {
        body: "Is this still available?"
      }
    });
    const outsiderMessage = await app.inject({
      headers: authHeader(outsider.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      payload: {
        body: "I should not be here."
      }
    });

    expect(participantMessage.statusCode).toBe(201);
    expect(outsiderMessage.statusCode).toBe(403);
  });

  it("requires auth to list messages and blocks non-participants from reading thread", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const outsider = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const conversation = (await createConversation(buyer.accessToken, listing.id)).json().data.conversation;

    await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      payload: {
        body: "Participant-only message"
      }
    });

    const unauthenticated = await app.inject({
      method: "GET",
      url: `/api/v1/conversations/${conversation.id}/messages`
    });
    const outsiderRead = await app.inject({
      headers: authHeader(outsider.accessToken),
      method: "GET",
      url: `/api/v1/conversations/${conversation.id}/messages`
    });
    const participantRead = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "GET",
      url: `/api/v1/conversations/${conversation.id}/messages`
    });

    expect(unauthenticated.statusCode).toBe(401);
    expect(outsiderRead.statusCode).toBe(403);
    expect(participantRead.statusCode).toBe(200);
    expect(participantRead.json().data.messages).toHaveLength(1);
  });

  it("rejects blank messages and updates lastMessageAt on send", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const conversation = (await createConversation(buyer.accessToken, listing.id)).json().data.conversation;

    const blank = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      payload: {
        body: "   "
      }
    });
    const sent = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      payload: {
        body: "Can we arrange pickup?"
      }
    });
    const listed = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "GET",
      url: "/api/v1/conversations"
    });

    expect(blank.statusCode).toBe(400);
    expect(sent.statusCode).toBe(201);
    expect(listed.json().data.conversations[0].lastMessageAt).toEqual(expect.any(String));
    expect(listed.json().data.conversations[0].latestMessage).toMatchObject({
      body: "Can we arrange pickup?",
      senderProfileId: buyer.profile.id,
      createdAt: expect.any(String)
    });

    const [row] = await app.db
      .select({
        lastMessageAt: conversations.lastMessageAt
      })
      .from(conversations)
      .where(eq(conversations.id, conversation.id))
      .limit(1);

    expect(row?.lastMessageAt).toBeInstanceOf(Date);
  });

  it("trims message body and rejects overlong message body", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const conversation = (await createConversation(buyer.accessToken, listing.id)).json().data.conversation;

    const trimmed = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      payload: {
        body: "  Trimmed message  "
      }
    });
    const overlong = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      payload: {
        body: "a".repeat(5001)
      }
    });

    expect(trimmed.statusCode).toBe(201);
    expect(trimmed.json().data.message.body).toBe("Trimmed message");
    expect(overlong.statusCode).toBe(400);
    expect(overlong.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_REQUEST"
      }
    });
  });

  it("blocks moderated message bodies before persisting them", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const conversation = (await createConversation(buyer.accessToken, listing.id)).json().data.conversation;
    const blockedBodies = [
      "f.u.c.k you",
      "send nude photos",
      "I will kill you",
      "buy buy buy buy buy buy"
    ];

    for (const body of blockedBodies) {
      const response = await app.inject({
        headers: authHeader(buyer.accessToken),
        method: "POST",
        url: `/api/v1/conversations/${conversation.id}/messages`,
        payload: {
          body
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        ok: false,
        error: {
          code: "MESSAGE_BLOCKED"
        }
      });
    }

    const messagesResponse = await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "GET",
      url: `/api/v1/conversations/${conversation.id}/messages`
    });

    expect(messagesResponse.statusCode).toBe(200);
    expect(messagesResponse.json().data.messages).toHaveLength(0);
  });

  it("does not leak latestMessage conversation summaries to outsiders", async () => {
    const seller = await createUser(app);
    const buyer = await createUser(app);
    const outsider = await createUser(app);
    const listing = await createListing(app, seller.accessToken);
    const conversation = (await createConversation(buyer.accessToken, listing.id)).json().data.conversation;

    await app.inject({
      headers: authHeader(buyer.accessToken),
      method: "POST",
      url: `/api/v1/conversations/${conversation.id}/messages`,
      payload: {
        body: "Private latest message"
      }
    });

    const outsiderList = await app.inject({
      headers: authHeader(outsider.accessToken),
      method: "GET",
      url: "/api/v1/conversations"
    });
    const outsiderDirectRead = await app.inject({
      headers: authHeader(outsider.accessToken),
      method: "GET",
      url: `/api/v1/conversations/${conversation.id}`
    });

    expect(outsiderList.statusCode).toBe(200);
    expect(outsiderList.json().data.conversations).toHaveLength(0);
    expect(outsiderList.body).not.toContain("Private latest message");
    expect(outsiderDirectRead.statusCode).toBe(403);
  });
});

describe("AI listing suggestion API", () => {
  it("returns mock suggestion and logs ai_model_runs", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/ai/listing-suggestions",
      payload: {
        categoryName: "Strollers",
        condition: "good",
        title: "Bugaboo stroller"
      }
    });
    const rows = await app.db
      .select({
        feature: aiModelRuns.feature,
        status: aiModelRuns.status
      })
      .from(aiModelRuns);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        suggestion: {
          providerName: "mock-listing-suggestion"
        }
      }
    });
    expect(rows).toHaveLength(1);
    expect(rows).toEqual([
      {
        feature: "listing_suggestion",
        status: "success"
      }
    ]);
  });

  it("rejects invalid listing suggestion payload without inserting a successful ai_model_runs row", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/ai/listing-suggestions",
      payload: {
        title: ""
      }
    });
    const successRows = await app.db
      .select({
        id: aiModelRuns.id
      })
      .from(aiModelRuns)
      .where(eq(aiModelRuns.status, "success"));

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_REQUEST"
      }
    });
    expect(successRows).toHaveLength(0);
  });
});

async function createConversation(token: string, listingId: string) {
  return app.inject({
    headers: authHeader(token),
    method: "POST",
    url: "/api/v1/conversations",
    payload: {
      listingId
    }
  });
}

async function countEvents(eventType: string, entityId: string): Promise<number> {
  const rows = await app.db
    .select({
      id: events.id
    })
    .from(events)
    .where(and(eq(events.eventType, eventType), eq(events.entityId, entityId)));

  return rows.length;
}

async function useGoogleOAuthTestApp(profilesByCode: Record<string, GoogleUserInfo>): Promise<void> {
  await app.close();
  app = await createTestApp({
    googleOAuthClient: createFakeGoogleOAuthClient(profilesByCode)
  });
}

async function useEmailDeliveryTestApp(): Promise<RecordingEmailDeliveryService> {
  const emailDelivery = createRecordingEmailDeliveryService();

  await app.close();
  app = await createTestApp({
    emailDelivery
  });

  return emailDelivery;
}

type RecordingEmailDeliveryService = EmailDeliveryService & {
  emailVerificationEmails: SendEmailVerificationEmailParams[];
  mfaOtpEmails: SendMfaOtpEmailParams[];
  passwordResetEmails: SendPasswordResetEmailParams[];
};

function createRecordingEmailDeliveryService(): RecordingEmailDeliveryService {
  const emailVerificationEmails: SendEmailVerificationEmailParams[] = [];
  const mfaOtpEmails: SendMfaOtpEmailParams[] = [];
  const passwordResetEmails: SendPasswordResetEmailParams[] = [];

  return {
    emailVerificationEmails,
    mfaOtpEmails,
    passwordResetEmails,
    async sendEmailVerificationEmail(params) {
      emailVerificationEmails.push(params);
    },
    async sendMfaOtpEmail(params) {
      mfaOtpEmails.push(params);
    },
    async sendPasswordResetEmail(params) {
      passwordResetEmails.push(params);
    }
  };
}

function createFakeGoogleOAuthClient(
  profilesByCode: Record<string, GoogleUserInfo>
): GoogleOAuthClient {
  return {
    async exchangeCodeForTokens(code) {
      return {
        accessToken: `fake-google-access-token:${code}`
      };
    },
    async fetchUserInfo(accessToken) {
      const code = accessToken.replace("fake-google-access-token:", "");
      const profile = profilesByCode[code];

      if (!profile) {
        throw new Error(`Missing fake Google profile for code ${code}.`);
      }

      return profile;
    }
  };
}


type ResponseWithHeaders = {
  headers: Record<string, string | string[] | number | undefined>;
};

function getRefreshSetCookie(response: ResponseWithHeaders): string {
  const refreshCookie = getSetCookieHeaders(response).find((header) =>
    header.startsWith(`${REFRESH_TOKEN_COOKIE_NAME}=`)
  );

  if (!refreshCookie) {
    throw new Error(`Missing ${REFRESH_TOKEN_COOKIE_NAME} Set-Cookie header.`);
  }

  return refreshCookie;
}

function getGoogleOAuthStateSetCookie(response: ResponseWithHeaders): string {
  const stateCookie = getSetCookieHeaders(response).find((header) =>
    header.startsWith(`${GOOGLE_OAUTH_STATE_COOKIE_NAME}=`)
  );

  if (!stateCookie) {
    throw new Error(`Missing ${GOOGLE_OAUTH_STATE_COOKIE_NAME} Set-Cookie header.`);
  }

  return stateCookie;
}

function getSetCookieHeaders(response: ResponseWithHeaders): string[] {
  const setCookieHeader = response.headers["set-cookie"];

  if (!setCookieHeader) {
    return [];
  }

  if (Array.isArray(setCookieHeader)) {
    return setCookieHeader;
  }

  return [String(setCookieHeader)];
}

function toCookieHeader(setCookieHeader: string): string {
  const [cookiePair] = setCookieHeader.split(";");

  if (!cookiePair) {
    throw new Error("Invalid Set-Cookie header.");
  }

  return cookiePair;
}

function getCookieValue(setCookieHeader: string): string {
  const cookiePair = toCookieHeader(setCookieHeader);
  const [, value] = cookiePair.split("=");

  if (!value) {
    throw new Error("Invalid refresh cookie value.");
  }

  return decodeURIComponent(value);
}

function getDevResetToken(response: { json: () => unknown }): string {
  const body = response.json() as {
    ok?: boolean;
    data?: {
      devResetToken?: unknown;
    };
  };

  const token = body.data?.devResetToken;

  if (body.ok !== true || typeof token !== "string" || !token) {
    throw new Error("Missing dev password reset token.");
  }

  return token;
}
