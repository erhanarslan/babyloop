import {
  aiModelRuns,
  authAccounts,
  conversations,
  emailVerificationTokens,
  favorites,
  listingImages,
  listings,
  loginApprovalChallenges,
  mfaOtpChallenges,
  passwordResetTokens,
  profiles,
  sessions,
  users
} from "@babyloop/database/schema";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  REALTIME_EVENTS,
  realtimeConversationRoom,
  realtimeProfileRoom,
  type ConversationUpdatedPayload,
  type MessageCreatedPayload,
  type RealtimeErrorPayload
} from "@babyloop/shared";
import { REFRESH_TOKEN_COOKIE_NAME, hashRefreshToken } from "../src/utils/refresh-token.js";
import { BACKOFFICE_ACCESS_TOKEN_COOKIE_NAME } from "../src/utils/backoffice-access-token-cookie.js";
import { PUBLIC_ACCESS_TOKEN_COOKIE_NAME } from "../src/utils/public-access-token-cookie.js";
import {
  BACKOFFICE_CSRF_COOKIE_NAME,
  BACKOFFICE_CSRF_HEADER_NAME
} from "../src/utils/backoffice-csrf.js";
import {
  PUBLIC_CSRF_COOKIE_NAME,
  PUBLIC_CSRF_HEADER_NAME
} from "../src/utils/public-csrf.js";
import { hashEmailVerificationToken } from "../src/utils/email-verification-token.js";
import { hashMfaOtpCode } from "../src/utils/mfa-otp.js";
import { GOOGLE_OAUTH_STATE_COOKIE_NAME, type GoogleUserInfo } from "../src/services/google-oauth.service.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";
import { authHeader, createUser, loginUser } from "./helpers/auth.js";
import { countEvents, createCategory, createConversation, createListing, getListingSellerProfileId } from "./helpers/fixtures.js";
import { getCookieValue, getDevResetToken, getGoogleOAuthStateSetCookie, getRefreshSetCookie, getSetCookieHeaders, toCookieHeader } from "./helpers/cookies.js";
import { createRecordingEmailDeliveryService, type RecordingEmailDeliveryService } from "./helpers/email.js";
import { createFakeGoogleOAuthClient } from "./helpers/google-oauth.js";
import { connectRealtimeSocket, delay, expectUnauthenticatedSocketRejected, getListeningBaseUrl, onceSocketEvent, waitForConversationRoomSize } from "./helpers/realtime.js";

let app!: TestApp;

beforeEach(async () => {
  await resetTestDatabase();
  app = await createTestApp();
});

afterEach(async () => {
  vi.restoreAllMocks();
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

  it("backoffice admin login sets an httpOnly access cookie without returning an access token", async () => {
    await createUser(app, {
      email: "backoffice-admin-login@example.com",
      password: "Password123!",
      role: "admin"
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/backoffice/login",
      payload: {
        email: "backoffice-admin-login@example.com",
        password: "Password123!"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        user: {
          email: "backoffice-admin-login@example.com",
          role: "admin"
        }
      }
    });
    expect(response.json().data.accessToken).toBeUndefined();
    expect(response.body).not.toContain("accessToken");

    const accessCookie = getBackofficeAccessSetCookie(response);
    const refreshCookie = getRefreshSetCookie(response);

    expect(accessCookie).toContain("HttpOnly");
    expect(accessCookie).toContain("SameSite=Lax");
    expect(accessCookie).toContain("Path=/");
    expect(accessCookie).toContain("Max-Age=");
    expect(refreshCookie).toContain("HttpOnly");

    const meResponse = await app.inject({
      headers: {
        cookie: toCookieHeader(accessCookie)
      },
      method: "GET",
      url: "/api/v1/auth/backoffice/me"
    });

    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json()).toMatchObject({
      ok: true,
      data: {
        user: {
          role: "admin"
        }
      }
    });
  });

  it("backoffice login rejects non-admin users without issuing an access cookie", async () => {
    await createUser(app, {
      email: "backoffice-non-admin@example.com",
      password: "Password123!"
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/backoffice/login",
      payload: {
        email: "backoffice-non-admin@example.com",
        password: "Password123!"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "FORBIDDEN"
      }
    });
    expect(response.body).not.toContain("accessToken");

    const accessCookie = getBackofficeAccessSetCookie(response);

    expect(accessCookie).toContain("HttpOnly");
    expect(accessCookie).toContain("Max-Age=0");
  });

  it("backoffice refresh rotates session cookies without returning an access token", async () => {
    await createUser(app, {
      email: "backoffice-refresh-admin@example.com",
      password: "Password123!",
      role: "admin"
    });
    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/backoffice/login",
      payload: {
        email: "backoffice-refresh-admin@example.com",
        password: "Password123!"
      }
    });
    const refreshCookie = getRefreshSetCookie(loginResponse);

    const refreshResponse = await app.inject({
      headers: {
        cookie: toCookieHeader(refreshCookie)
      },
      method: "POST",
      url: "/api/v1/auth/backoffice/refresh"
    });

    expect(refreshResponse.statusCode).toBe(200);
    expect(refreshResponse.json()).toMatchObject({
      ok: true,
      data: {
        user: {
          email: "backoffice-refresh-admin@example.com",
          role: "admin"
        }
      }
    });
    expect(refreshResponse.json().data.accessToken).toBeUndefined();
    expect(refreshResponse.body).not.toContain("accessToken");
    expect(getBackofficeAccessSetCookie(refreshResponse)).toContain("HttpOnly");
    expect(getRefreshSetCookie(refreshResponse)).toContain("HttpOnly");
  });

  it("requires a CSRF token for cookie-authenticated backoffice mutations", async () => {
    await createUser(app, {
      email: "backoffice-csrf-admin@example.com",
      password: "Password123!",
      role: "admin"
    });

    const loginResponse = await app.inject({
      method: "POST",
      payload: {
        email: "backoffice-csrf-admin@example.com",
        password: "Password123!"
      },
      url: "/api/v1/auth/backoffice/login"
    });

    const accessCookie = getBackofficeAccessSetCookie(loginResponse);
    const csrfCookie = getBackofficeCsrfSetCookie(loginResponse);
    const csrfToken = getCookieValue(csrfCookie);

    const missingCsrf = await app.inject({
      headers: {
        cookie: toCookieHeader(accessCookie)
      },
      method: "POST",
      url: "/api/v1/auth/backoffice/logout"
    });

    expect(missingCsrf.statusCode).toBe(403);
    expect(missingCsrf.json()).toMatchObject({
      ok: false,
      error: {
        code: "CSRF_TOKEN_REQUIRED"
      }
    });

    const validCsrf = await app.inject({
      headers: {
        [BACKOFFICE_CSRF_HEADER_NAME]: csrfToken,
        cookie: `${toCookieHeader(accessCookie)}; ${toCookieHeader(csrfCookie)}`
      },
      method: "POST",
      url: "/api/v1/auth/backoffice/logout"
    });

    expect(validCsrf.statusCode).toBe(200);
    expect(validCsrf.json()).toMatchObject({
      ok: true
    });
  });

  it("issues a public CSRF token for cookie-authenticated public sessions", async () => {
    await createUser(app, {
      email: "public-csrf-token@example.com",
      password: "Password123!"
    });

    const loginResponse = await app.inject({
      method: "POST",
      payload: {
        email: "public-csrf-token@example.com",
        password: "Password123!"
      },
      url: "/api/v1/auth/login"
    });
    const publicAccessCookie = getPublicAccessSetCookie(loginResponse);

    const csrfResponse = await app.inject({
      headers: {
        cookie: toCookieHeader(publicAccessCookie)
      },
      method: "GET",
      url: "/api/v1/auth/csrf"
    });

    expect(csrfResponse.statusCode).toBe(200);
    expect(csrfResponse.json()).toMatchObject({
      ok: true,
      data: {
        csrfToken: expect.any(String)
      }
    });

    const publicCsrfCookie = getPublicCsrfSetCookie(csrfResponse);

    expect(publicCsrfCookie).toContain("SameSite=Lax");
    expect(publicCsrfCookie).toContain("Path=/");
    expect(publicCsrfCookie).toContain("Max-Age=");
    expect(getCookieValue(publicCsrfCookie)).toBe(csrfResponse.json().data.csrfToken);
  });

  it("requires a public CSRF token for cookie-authenticated public mutations", async () => {
    await createUser(app, {
      email: "public-csrf-missing@example.com",
      password: "Password123!"
    });
    const category = await createCategory(app.db, {
      name: "Public CSRF Missing",
      slug: "public-csrf-missing"
    });
    const loginResponse = await app.inject({
      method: "POST",
      payload: {
        email: "public-csrf-missing@example.com",
        password: "Password123!"
      },
      url: "/api/v1/auth/login"
    });
    const publicAccessCookie = getPublicAccessSetCookie(loginResponse);

    const response = await app.inject({
      headers: {
        cookie: toCookieHeader(publicAccessCookie)
      },
      method: "POST",
      payload: {
        categoryId: category.id,
        condition: "good",
        currency: "TRY",
        listingType: "sale",
        priceAmount: "1200.00",
        title: "Cookie mutation without CSRF"
      },
      url: "/api/v1/listings"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "PUBLIC_CSRF_TOKEN_REQUIRED"
      }
    });
  });

  it("accepts a valid public CSRF token for cookie-authenticated public mutations", async () => {
    await createUser(app, {
      email: "public-csrf-valid@example.com",
      password: "Password123!"
    });
    const category = await createCategory(app.db, {
      name: "Public CSRF Valid",
      slug: "public-csrf-valid"
    });
    const loginResponse = await app.inject({
      method: "POST",
      payload: {
        email: "public-csrf-valid@example.com",
        password: "Password123!"
      },
      url: "/api/v1/auth/login"
    });
    const publicAccessCookie = getPublicAccessSetCookie(loginResponse);
    const publicCsrfCookie = getPublicCsrfSetCookie(loginResponse);
    const publicCsrfToken = getCookieValue(publicCsrfCookie);

    const response = await app.inject({
      headers: {
        [PUBLIC_CSRF_HEADER_NAME]: publicCsrfToken,
        cookie: `${toCookieHeader(publicAccessCookie)}; ${toCookieHeader(publicCsrfCookie)}`
      },
      method: "POST",
      payload: {
        categoryId: category.id,
        condition: "good",
        currency: "TRY",
        listingType: "sale",
        priceAmount: "1500.00",
        title: "Cookie mutation with CSRF"
      },
      url: "/api/v1/listings"
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        listing: {
          title: "Cookie mutation with CSRF"
        }
      }
    });
  });

  it("does not require public CSRF for bearer-authenticated public mutations", async () => {
    const user = await createUser(app, {
      email: "public-csrf-bearer@example.com"
    });
    const category = await createCategory(app.db, {
      name: "Public CSRF Bearer",
      slug: "public-csrf-bearer"
    });

    const response = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      payload: {
        categoryId: category.id,
        condition: "good",
        currency: "TRY",
        listingType: "sale",
        priceAmount: "1800.00",
        title: "Bearer mutation without CSRF"
      },
      url: "/api/v1/listings"
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        listing: {
          title: "Bearer mutation without CSRF"
        }
      }
    });
  });

  it("does not require public CSRF for safe cookie-authenticated reads or auth bootstrap endpoints", async () => {
    await createUser(app, {
      email: "public-csrf-safe@example.com",
      password: "Password123!"
    });
    const loginResponse = await app.inject({
      method: "POST",
      payload: {
        email: "public-csrf-safe@example.com",
        password: "Password123!"
      },
      url: "/api/v1/auth/login"
    });
    const publicAccessCookie = getPublicAccessSetCookie(loginResponse);

    const meResponse = await app.inject({
      headers: {
        cookie: toCookieHeader(publicAccessCookie)
      },
      method: "GET",
      url: "/api/v1/auth/me"
    });

    expect(meResponse.statusCode).toBe(200);

    const logoutResponse = await app.inject({
      headers: {
        cookie: toCookieHeader(publicAccessCookie)
      },
      method: "POST",
      url: "/api/v1/auth/logout"
    });

    expect(logoutResponse.statusCode).toBe(200);
  });

  it("returns 401 for public CSRF token requests without authentication", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/csrf"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "UNAUTHORIZED"
      }
    });
  });

  it("register sets public access and CSRF cookies for cookie-backed sessions", async () => {
    const response = await app.inject({
      method: "POST",
      payload: {
        displayName: "Register Cookie Parent",
        email: "register-cookie-session@example.com",
        password: "Password123!"
      },
      url: "/api/v1/auth/register"
    });

    expect(response.statusCode).toBe(201);

    const publicAccessCookie = getPublicAccessSetCookie(response);
    const publicCsrfCookie = getPublicCsrfSetCookie(response);

    expect(publicAccessCookie).toContain("HttpOnly");
    expect(publicAccessCookie).toContain("SameSite=Lax");
    expect(publicAccessCookie).toContain("Path=/");
    expect(publicAccessCookie).toContain("Max-Age=");
    expect(getCookieValue(publicAccessCookie)).toEqual(expect.any(String));

    expect(publicCsrfCookie).toContain("SameSite=Lax");
    expect(publicCsrfCookie).toContain("Path=/");
    expect(publicCsrfCookie).toContain("Max-Age=");
    expect(getCookieValue(publicCsrfCookie)).toEqual(expect.any(String));
  });

  it("login sets public access and CSRF cookies for cookie-backed sessions", async () => {
    await createUser(app, {
      email: "login-cookie-session@example.com",
      password: "Password123!"
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        email: "login-cookie-session@example.com",
        password: "Password123!"
      },
      url: "/api/v1/auth/login"
    });

    expect(response.statusCode).toBe(200);

    const publicAccessCookie = getPublicAccessSetCookie(response);
    const publicCsrfCookie = getPublicCsrfSetCookie(response);

    expect(publicAccessCookie).toContain("HttpOnly");
    expect(publicAccessCookie).toContain("SameSite=Lax");
    expect(publicAccessCookie).toContain("Path=/");
    expect(publicAccessCookie).toContain("Max-Age=");
    expect(getCookieValue(publicAccessCookie)).toEqual(expect.any(String));

    expect(publicCsrfCookie).toContain("SameSite=Lax");
    expect(publicCsrfCookie).toContain("Path=/");
    expect(publicCsrfCookie).toContain("Max-Age=");
    expect(getCookieValue(publicCsrfCookie)).toEqual(expect.any(String));
  });

  it("auth/me accepts the public access cookie without a bearer token", async () => {
    await createUser(app, {
      email: "cookie-auth-me@example.com",
      password: "Password123!"
    });

    const loginResponse = await app.inject({
      method: "POST",
      payload: {
        email: "cookie-auth-me@example.com",
        password: "Password123!"
      },
      url: "/api/v1/auth/login"
    });
    const publicAccessCookie = getPublicAccessSetCookie(loginResponse);

    const response = await app.inject({
      headers: {
        cookie: toCookieHeader(publicAccessCookie)
      },
      method: "GET",
      url: "/api/v1/auth/me"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        user: {
          email: "cookie-auth-me@example.com"
        }
      }
    });
    expect(response.body).not.toContain("refreshToken");
    expect(response.body).not.toContain("refresh_token");
    expect(response.body).not.toContain("passwordHash");
    expect(response.body).not.toContain("password_hash");
  });

  it("refresh sets a new public access cookie and public CSRF cookie", async () => {
    const registerResponse = await app.inject({
      method: "POST",
      payload: {
        displayName: "Refresh Cookie Parent",
        email: "refresh-cookie-session@example.com",
        password: "Password123!"
      },
      url: "/api/v1/auth/register"
    });
    const firstRefreshCookie = getRefreshSetCookie(registerResponse);
    const firstPublicCsrfCookie = getPublicCsrfSetCookie(registerResponse);

    const response = await app.inject({
      headers: {
        cookie: toCookieHeader(firstRefreshCookie)
      },
      method: "POST",
      url: "/api/v1/auth/refresh"
    });

    expect(response.statusCode).toBe(200);

    const nextPublicAccessCookie = getPublicAccessSetCookie(response);
    const nextPublicCsrfCookie = getPublicCsrfSetCookie(response);

    expect(nextPublicAccessCookie).toContain("HttpOnly");
    expect(nextPublicAccessCookie).toContain("SameSite=Lax");
    expect(nextPublicAccessCookie).toContain("Path=/");
    expect(nextPublicAccessCookie).toContain("Max-Age=");
    expect(getCookieValue(nextPublicAccessCookie)).toEqual(expect.any(String));

    expect(nextPublicCsrfCookie).toContain("SameSite=Lax");
    expect(nextPublicCsrfCookie).toContain("Path=/");
    expect(nextPublicCsrfCookie).toContain("Max-Age=");
    expect(getCookieValue(nextPublicCsrfCookie)).toEqual(expect.any(String));
    expect(getCookieValue(nextPublicCsrfCookie)).not.toBe(getCookieValue(firstPublicCsrfCookie));
  });


  it("lists active auth sessions without exposing refresh tokens", async () => {
    await createUser(app, {
      email: "session-list@example.com",
      password: "Password123!"
    });

    const loginResponse = await app.inject({
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) BabyLoopWeb"
      },
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "session-list@example.com",
        password: "Password123!"
      }
    });
    const publicAccessCookie = getPublicAccessSetCookie(loginResponse);
    const refreshCookie = getRefreshSetCookie(loginResponse);

    const response = await app.inject({
      headers: {
        cookie: `${toCookieHeader(publicAccessCookie)}; ${toCookieHeader(refreshCookie)}`
      },
      method: "GET",
      url: "/api/v1/auth/sessions"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        currentSessionId: expect.any(String),
        sessions: expect.arrayContaining([
          expect.objectContaining({
            current: true,
            deviceLabel: "Mac tarayıcı",
            id: expect.any(String),
            expiresAt: expect.any(String)
          })
        ])
      }
    });
    expect(response.body).not.toContain("refreshToken");
    expect(response.body).not.toContain("refresh_token");
    expect(response.body).not.toContain("refreshTokenHash");
    expect(response.body).not.toContain("passwordHash");
    expect(response.body).not.toContain("accessToken");
  });

  it("revokes one auth session owned by the current user", async () => {
    await createUser(app, {
      email: "session-revoke@example.com",
      password: "Password123!"
    });

    const firstLogin = await app.inject({
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) BabyLoopWeb"
      },
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "session-revoke@example.com",
        password: "Password123!"
      }
    });
    const secondLogin = await app.inject({
      headers: {
        "user-agent": "BabyLoopMobile Android"
      },
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "session-revoke@example.com",
        password: "Password123!"
      }
    });

    const secondRefreshCookie = getRefreshSetCookie(secondLogin);
    const secondRefreshToken = getCookieValue(secondRefreshCookie);
    const [secondSession] = await app.db
      .select({
        id: sessions.id
      })
      .from(sessions)
      .where(eq(sessions.refreshTokenHash, hashRefreshToken(secondRefreshToken)))
      .limit(1);

    expect(secondSession).toBeDefined();

    const revokeResponse = await app.inject({
      headers: authHeader(firstLogin.json().data.accessToken),
      method: "POST",
      url: `/api/v1/auth/sessions/${secondSession!.id}/revoke`
    });
    const refreshResponse = await app.inject({
      headers: {
        cookie: toCookieHeader(secondRefreshCookie)
      },
      method: "POST",
      url: "/api/v1/auth/refresh"
    });

    expect(revokeResponse.statusCode).toBe(200);
    expect(revokeResponse.json()).toMatchObject({
      ok: true,
      data: {
        currentSessionRevoked: false,
        revoked: true,
        sessionId: secondSession!.id
      }
    });
    expect(refreshResponse.statusCode).toBe(401);
    expect(revokeResponse.body).not.toContain("refreshToken");
    expect(revokeResponse.body).not.toContain("passwordHash");
  });

  it("revokes all auth sessions and clears public auth cookies", async () => {
    await createUser(app, {
      email: "session-revoke-all@example.com",
      password: "Password123!"
    });

    const firstLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "session-revoke-all@example.com",
        password: "Password123!"
      }
    });
    const secondLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "session-revoke-all@example.com",
        password: "Password123!"
      }
    });
    const firstPublicAccessCookie = getPublicAccessSetCookie(firstLogin);
    const firstRefreshCookie = getRefreshSetCookie(firstLogin);
    const secondRefreshCookie = getRefreshSetCookie(secondLogin);

    const revokeAllResponse = await app.inject({
      headers: {
        cookie: `${toCookieHeader(firstPublicAccessCookie)}; ${toCookieHeader(firstRefreshCookie)}`
      },
      method: "POST",
      url: "/api/v1/auth/sessions/revoke-all"
    });
    const firstRefreshResponse = await app.inject({
      headers: {
        cookie: toCookieHeader(firstRefreshCookie)
      },
      method: "POST",
      url: "/api/v1/auth/refresh"
    });
    const secondRefreshResponse = await app.inject({
      headers: {
        cookie: toCookieHeader(secondRefreshCookie)
      },
      method: "POST",
      url: "/api/v1/auth/refresh"
    });
    const activeSessions = await app.db
      .select({
        id: sessions.id
      })
      .from(sessions)
      .where(and(isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())));

    expect(revokeAllResponse.statusCode).toBe(200);
    expect(revokeAllResponse.json()).toMatchObject({
      ok: true,
      data: {
        revokedCount: expect.any(Number)
      }
    });
    expect(revokeAllResponse.json().data.revokedCount).toBeGreaterThanOrEqual(2);
    expect(getRefreshSetCookie(revokeAllResponse)).toContain("Max-Age=0");
    expect(getPublicAccessSetCookie(revokeAllResponse)).toContain("Max-Age=0");
    expect(getPublicCsrfSetCookie(revokeAllResponse)).toContain("Max-Age=0");
    expect(firstRefreshResponse.statusCode).toBe(401);
    expect(secondRefreshResponse.statusCode).toBe(401);
    expect(activeSessions).toHaveLength(0);
    expect(revokeAllResponse.body).not.toContain("refreshToken");
    expect(revokeAllResponse.body).not.toContain("passwordHash");
  });

  it("requires auth for session management endpoints", async () => {
    const listResponse = await app.inject({
      method: "GET",
      url: "/api/v1/auth/sessions"
    });
    const revokeAllResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/sessions/revoke-all"
    });
    const revokeOneResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/sessions/00000000-0000-4000-8000-000000000000/revoke"
    });

    expect(listResponse.statusCode).toBe(401);
    expect(revokeAllResponse.statusCode).toBe(401);
    expect(revokeOneResponse.statusCode).toBe(401);
  });

  it("returns and updates mobile login approval preference with the current password", async () => {
    const user = await createUser(app, {
      email: "login-approval-preference@example.com",
      password: "Password123!"
    });

    const initialStatus = await app.inject({
      headers: authHeader(user.accessToken),
      method: "GET",
      url: "/api/v1/auth/login-approval/status"
    });

    const wrongPassword = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      payload: {
        currentPassword: "WrongPassword123!"
      },
      url: "/api/v1/auth/login-approval/enable"
    });

    const enable = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      payload: {
        currentPassword: "Password123!"
      },
      url: "/api/v1/auth/login-approval/enable"
    });

    const enabledStatus = await app.inject({
      headers: authHeader(user.accessToken),
      method: "GET",
      url: "/api/v1/auth/login-approval/status"
    });

    const disable = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      payload: {
        currentPassword: "Password123!"
      },
      url: "/api/v1/auth/login-approval/disable"
    });

    const [userRow] = await app.db
      .select({ mobileLoginApprovalEnabled: users.mobileLoginApprovalEnabled })
      .from(users)
      .where(eq(users.id, user.user.id));

    expect(initialStatus.statusCode).toBe(200);
    expect(initialStatus.json()).toEqual({
      ok: true,
      data: {
        delivery: "in_app",
        method: "mobile_approval",
        mobileLoginApprovalEnabled: false
      }
    });

    expect(wrongPassword.statusCode).toBe(401);
    expect(wrongPassword.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_CREDENTIALS"
      }
    });

    expect(enable.statusCode).toBe(200);
    expect(enable.json()).toEqual({
      ok: true,
      data: {
        delivery: "in_app",
        method: "mobile_approval",
        mobileLoginApprovalEnabled: true,
        updated: true
      }
    });

    expect(enabledStatus.json().data.mobileLoginApprovalEnabled).toBe(true);

    expect(disable.statusCode).toBe(200);
    expect(disable.json().data).toMatchObject({
      delivery: "in_app",
      method: "mobile_approval",
      mobileLoginApprovalEnabled: false,
      updated: true
    });

    expect(userRow?.mobileLoginApprovalEnabled).toBe(false);

    for (const response of [initialStatus, wrongPassword, enable, enabledStatus, disable]) {
      expect(response.body).not.toContain("passwordHash");
      expect(response.body).not.toContain("password_hash");
      expect(response.body).not.toContain("currentPassword");
      expect(response.body).not.toContain("refreshToken");
      expect(response.body).not.toContain("refresh_token");
      expect(response.body).not.toContain("accessToken");
    }
  });

  it("lists and resolves pending mobile login approval challenges without exposing secrets", async () => {
    const user = await createUser(app, {
      email: "login-approval-list@example.com",
      password: "Password123!"
    });
    const otherUser = await createUser(app, {
      email: "login-approval-other@example.com",
      password: "Password123!"
    });

    const loginResponse = await app.inject({
      method: "POST",
      payload: {
        email: "login-approval-list@example.com",
        password: "Password123!"
      },
      url: "/api/v1/auth/login"
    });
    const refreshCookie = getRefreshSetCookie(loginResponse);

    const [pendingApproval] = await app.db
      .insert(loginApprovalChallenges)
      .values({
        approvalTokenHash: "pending-approval-token-hash",
        expiresAt: new Date(Date.now() + 60_000),
        requestIpAddress: "10.0.0.10",
        requestUserAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X) BabyLoopWeb",
        status: "pending",
        userId: user.user.id
      })
      .returning({ id: loginApprovalChallenges.id });

    const [denyApproval] = await app.db
      .insert(loginApprovalChallenges)
      .values({
        approvalTokenHash: "deny-approval-token-hash",
        expiresAt: new Date(Date.now() + 60_000),
        requestIpAddress: "10.0.0.11",
        requestUserAgent: "BabyLoopMobile Android",
        status: "pending",
        userId: user.user.id
      })
      .returning({ id: loginApprovalChallenges.id });

    await app.db.insert(loginApprovalChallenges).values([
      {
        approvalTokenHash: "expired-approval-token-hash",
        expiresAt: new Date(Date.now() - 60_000),
        requestIpAddress: "10.0.0.12",
        requestUserAgent: "Expired Browser",
        status: "pending",
        userId: user.user.id
      },
      {
        approvalTokenHash: "other-user-approval-token-hash",
        expiresAt: new Date(Date.now() + 60_000),
        requestIpAddress: "10.0.0.13",
        requestUserAgent: "Other Browser",
        status: "pending",
        userId: otherUser.user.id
      }
    ]);

    const list = await app.inject({
      headers: authHeader(user.accessToken),
      method: "GET",
      url: "/api/v1/auth/login-approvals"
    });

    const approve = await app.inject({
      headers: {
        ...authHeader(user.accessToken),
        cookie: toCookieHeader(refreshCookie)
      },
      method: "POST",
      url: `/api/v1/auth/login-approvals/${pendingApproval!.id}/approve`
    });

    const deny = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      url: `/api/v1/auth/login-approvals/${denyApproval!.id}/deny`
    });

    const missing = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      url: "/api/v1/auth/login-approvals/00000000-0000-4000-8000-000000000000/approve"
    });

    const resolvedRows = await app.db
      .select({
        id: loginApprovalChallenges.id,
        status: loginApprovalChallenges.status,
        resolvedAt: loginApprovalChallenges.resolvedAt,
        approvedBySessionId: loginApprovalChallenges.approvedBySessionId
      })
      .from(loginApprovalChallenges)
      .where(eq(loginApprovalChallenges.userId, user.user.id))
      .orderBy(asc(loginApprovalChallenges.createdAt));

    expect(list.statusCode).toBe(200);
    expect(list.json()).toMatchObject({
      ok: true,
      data: {
        approvals: expect.arrayContaining([
          expect.objectContaining({
            id: pendingApproval!.id,
            status: "pending",
            deviceLabel: "Mac tarayıcı",
            requestIpAddress: "10.0.0.10"
          }),
          expect.objectContaining({
            id: denyApproval!.id,
            status: "pending",
            deviceLabel: "Android cihaz",
            requestIpAddress: "10.0.0.11"
          })
        ])
      }
    });
    expect(list.json().data.approvals).toHaveLength(2);

    expect(approve.statusCode).toBe(200);
    expect(approve.json()).toEqual({
      ok: true,
      data: {
        approvalId: pendingApproval!.id,
        resolved: true,
        status: "approved"
      }
    });

    expect(deny.statusCode).toBe(200);
    expect(deny.json()).toEqual({
      ok: true,
      data: {
        approvalId: denyApproval!.id,
        resolved: true,
        status: "denied"
      }
    });

    expect(missing.statusCode).toBe(404);
    expect(resolvedRows.find((row) => row.id === pendingApproval!.id)).toMatchObject({
      status: "approved",
      resolvedAt: expect.any(Date),
      approvedBySessionId: expect.any(String)
    });
    expect(resolvedRows.find((row) => row.id === denyApproval!.id)).toMatchObject({
      status: "denied",
      resolvedAt: expect.any(Date),
      approvedBySessionId: null
    });

    for (const response of [list, approve, deny, missing]) {
      expect(response.body).not.toContain("approvalTokenHash");
      expect(response.body).not.toContain("approval_token_hash");
      expect(response.body).not.toContain("passwordHash");
      expect(response.body).not.toContain("refreshToken");
      expect(response.body).not.toContain("accessToken");
    }
  });

  it("requires authentication for mobile login approval endpoints", async () => {
    const status = await app.inject({
      method: "GET",
      url: "/api/v1/auth/login-approval/status"
    });
    const enable = await app.inject({
      method: "POST",
      payload: {
        currentPassword: "Password123!"
      },
      url: "/api/v1/auth/login-approval/enable"
    });
    const disable = await app.inject({
      method: "POST",
      payload: {
        currentPassword: "Password123!"
      },
      url: "/api/v1/auth/login-approval/disable"
    });
    const list = await app.inject({
      method: "GET",
      url: "/api/v1/auth/login-approvals"
    });
    const approve = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login-approvals/00000000-0000-4000-8000-000000000000/approve"
    });
    const deny = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login-approvals/00000000-0000-4000-8000-000000000000/deny"
    });

    expect(status.statusCode).toBe(401);
    expect(enable.statusCode).toBe(401);
    expect(disable.statusCode).toBe(401);
    expect(list.statusCode).toBe(401);
    expect(approve.statusCode).toBe(401);
    expect(deny.statusCode).toBe(401);
  });

  it("logout clears public access and CSRF cookies", async () => {
    await createUser(app, {
      email: "logout-cookie-session@example.com",
      password: "Password123!"
    });

    const loginResponse = await app.inject({
      method: "POST",
      payload: {
        email: "logout-cookie-session@example.com",
        password: "Password123!"
      },
      url: "/api/v1/auth/login"
    });

    const refreshCookie = getRefreshSetCookie(loginResponse);
    const publicAccessCookie = getPublicAccessSetCookie(loginResponse);
    const publicCsrfCookie = getPublicCsrfSetCookie(loginResponse);

    const response = await app.inject({
      headers: {
        cookie: [
          toCookieHeader(refreshCookie),
          toCookieHeader(publicAccessCookie),
          toCookieHeader(publicCsrfCookie)
        ].join("; ")
      },
      method: "POST",
      url: "/api/v1/auth/logout"
    });

    expect(response.statusCode).toBe(200);
    expect(getRefreshSetCookie(response)).toContain("Max-Age=0");
    expect(getPublicAccessSetCookie(response)).toContain("Max-Age=0");
    expect(getPublicCsrfSetCookie(response)).toContain("Max-Age=0");
  });

  it("password change clears public access and CSRF cookies for cookie-authenticated sessions", async () => {
    await createUser(app, {
      email: "password-change-cookie-session@example.com",
      password: "OldPassword123!"
    });

    const loginResponse = await app.inject({
      method: "POST",
      payload: {
        email: "password-change-cookie-session@example.com",
        password: "OldPassword123!"
      },
      url: "/api/v1/auth/login"
    });

    const publicAccessCookie = getPublicAccessSetCookie(loginResponse);
    const publicCsrfCookie = getPublicCsrfSetCookie(loginResponse);
    const publicCsrfToken = getCookieValue(publicCsrfCookie);

    const response = await app.inject({
      headers: {
        [PUBLIC_CSRF_HEADER_NAME]: publicCsrfToken,
        cookie: `${toCookieHeader(publicAccessCookie)}; ${toCookieHeader(publicCsrfCookie)}`
      },
      method: "POST",
      payload: {
        currentPassword: "OldPassword123!",
        newPassword: "NewPassword123!"
      },
      url: "/api/v1/auth/password/change"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      data: {
        passwordChanged: true
      }
    });
    expect(getRefreshSetCookie(response)).toContain("Max-Age=0");
    expect(getPublicAccessSetCookie(response)).toContain("Max-Age=0");
    expect(getPublicCsrfSetCookie(response)).toContain("Max-Age=0");
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

  it("mobile login approval enabled login returns a challenge without issuing a session", async () => {
    const user = await createUser(app, {
      email: "login-approval-required@example.com",
      password: "Password123!"
    });

    await app.db
      .update(users)
      .set({
        mobileLoginApprovalEnabled: true
      })
      .where(eq(users.id, user.user.id));

    const response = await app.inject({
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) BabyLoopWeb"
      },
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "login-approval-required@example.com",
        password: "Password123!"
      }
    });

    const challengeRows = await app.db
      .select({
        id: loginApprovalChallenges.id,
        status: loginApprovalChallenges.status,
        approvalTokenHash: loginApprovalChallenges.approvalTokenHash
      })
      .from(loginApprovalChallenges)
      .where(eq(loginApprovalChallenges.userId, user.user.id));

    const sessionRows = await app.db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.userId, user.user.id));

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: {
        approvalId: expect.any(String),
        approvalToken: expect.any(String),
        deviceLabel: "Mac tarayıcı",
        expiresAt: expect.any(String),
        loginApprovalRequired: true
      }
    });
    expect(response.body).not.toContain("accessToken");
    expect(response.body).not.toContain("refreshToken");
    expect(response.body).not.toContain("passwordHash");
    expect(response.body).not.toContain("approvalTokenHash");
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(challengeRows).toHaveLength(1);
    expect(challengeRows[0].status).toBe("pending");
    expect(challengeRows[0].approvalTokenHash).not.toBe(response.json().data.approvalToken);
    expect(sessionRows).toHaveLength(1);
  });

  it("mobile login approval complete creates a session only after approval and consumes the challenge", async () => {
    const user = await createUser(app, {
      email: "login-approval-complete@example.com",
      password: "Password123!"
    });

    await app.db
      .update(users)
      .set({
        mobileLoginApprovalEnabled: true
      })
      .where(eq(users.id, user.user.id));

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "login-approval-complete@example.com",
        password: "Password123!"
      }
    });

    const approvalId = login.json().data.approvalId;
    const approvalToken = login.json().data.approvalToken;

    const beforeApproval = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login-approval/complete",
      payload: {
        approvalToken
      }
    });

    const approve = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      url: `/api/v1/auth/login-approvals/${approvalId}/approve`
    });

    const complete = await app.inject({
      headers: {
        "user-agent": "BabyLoopMobile Android"
      },
      method: "POST",
      url: "/api/v1/auth/login-approval/complete",
      payload: {
        approvalToken
      }
    });

    const reused = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login-approval/complete",
      payload: {
        approvalToken
      }
    });

    const [challengeRow] = await app.db
      .select({
        status: loginApprovalChallenges.status
      })
      .from(loginApprovalChallenges)
      .where(eq(loginApprovalChallenges.id, approvalId));

    expect(beforeApproval.statusCode).toBe(400);
    expect(beforeApproval.json()).toMatchObject({
      ok: false,
      error: {
        code: "LOGIN_APPROVAL_INVALID"
      }
    });

    expect(approve.statusCode).toBe(200);

    expect(complete.statusCode).toBe(200);
    expect(complete.json()).toMatchObject({
      ok: true,
      data: {
        accessToken: expect.any(String),
        user: {
          id: user.user.id,
          email: "login-approval-complete@example.com"
        }
      }
    });
    expect(getRefreshSetCookie(complete)).toContain("HttpOnly");
    expect(challengeRow?.status).toBe("consumed");

    expect(reused.statusCode).toBe(400);
    expect(reused.json()).toMatchObject({
      ok: false,
      error: {
        code: "LOGIN_APPROVAL_INVALID"
      }
    });

    for (const response of [beforeApproval, approve, complete, reused]) {
      expect(response.body).not.toContain("approvalTokenHash");
      expect(response.body).not.toContain("passwordHash");
      expect(response.body).not.toContain("refreshToken");
    }
  });

  it("MFA verify returns mobile login approval challenge before issuing a session when both are enabled", async () => {
    const user = await createUser(app, {
      email: "mfa-then-login-approval@example.com"
    });

    await app.db
      .update(users)
      .set({
        mfaEnabled: true,
        mobileLoginApprovalEnabled: true
      })
      .where(eq(users.id, user.user.id));

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "mfa-then-login-approval@example.com",
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

    const loginApprovalRows = await app.db
      .select({
        id: loginApprovalChallenges.id,
        status: loginApprovalChallenges.status
      })
      .from(loginApprovalChallenges)
      .where(eq(loginApprovalChallenges.userId, user.user.id));

    expect(login.statusCode).toBe(200);
    expect(login.json().data.mfaRequired).toBe(true);
    expect(login.body).not.toContain("loginApprovalRequired");

    expect(verify.statusCode).toBe(200);
    expect(verify.json()).toMatchObject({
      ok: true,
      data: {
        approvalId: expect.any(String),
        approvalToken: expect.any(String),
        loginApprovalRequired: true
      }
    });
    expect(verify.body).not.toContain("accessToken");
    expect(verify.body).not.toContain("refreshToken");
    expect(verify.headers["set-cookie"]).toBeUndefined();
    expect(loginApprovalRows).toHaveLength(1);
    expect(loginApprovalRows[0].status).toBe("pending");
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

  it("returns and updates MFA preference with the current password", async () => {
    const user = await createUser(app, {
      email: "mfa-preference@example.com",
      password: "Password123!"
    });

    const initialStatus = await app.inject({
      headers: authHeader(user.accessToken),
      method: "GET",
      url: "/api/v1/auth/mfa/status"
    });

    const wrongPassword = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      payload: {
        currentPassword: "WrongPassword123!"
      },
      url: "/api/v1/auth/mfa/enable"
    });

    const enable = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      payload: {
        currentPassword: "Password123!"
      },
      url: "/api/v1/auth/mfa/enable"
    });

    const enabledStatus = await app.inject({
      headers: authHeader(user.accessToken),
      method: "GET",
      url: "/api/v1/auth/mfa/status"
    });

    const disable = await app.inject({
      headers: authHeader(user.accessToken),
      method: "POST",
      payload: {
        currentPassword: "Password123!"
      },
      url: "/api/v1/auth/mfa/disable"
    });

    const [userRow] = await app.db
      .select({ mfaEnabled: users.mfaEnabled })
      .from(users)
      .where(eq(users.id, user.user.id));

    expect(initialStatus.statusCode).toBe(200);
    expect(initialStatus.json()).toEqual({
      ok: true,
      data: {
        delivery: "email",
        method: "email_otp",
        mfaEnabled: false
      }
    });

    expect(wrongPassword.statusCode).toBe(401);
    expect(wrongPassword.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_CREDENTIALS"
      }
    });

    expect(enable.statusCode).toBe(200);
    expect(enable.json()).toEqual({
      ok: true,
      data: {
        delivery: "email",
        method: "email_otp",
        mfaEnabled: true,
        updated: true
      }
    });

    expect(enabledStatus.json().data.mfaEnabled).toBe(true);

    expect(disable.statusCode).toBe(200);
    expect(disable.json().data).toMatchObject({
      delivery: "email",
      method: "email_otp",
      mfaEnabled: false,
      updated: true
    });

    expect(userRow?.mfaEnabled).toBe(false);

    for (const response of [initialStatus, wrongPassword, enable, enabledStatus, disable]) {
      expect(response.body).not.toContain("passwordHash");
      expect(response.body).not.toContain("password_hash");
      expect(response.body).not.toContain("currentPassword");
      expect(response.body).not.toContain("refreshToken");
      expect(response.body).not.toContain("refresh_token");
    }
  });

  it("requires authentication for MFA preference endpoints", async () => {
    const status = await app.inject({
      method: "GET",
      url: "/api/v1/auth/mfa/status"
    });
    const enable = await app.inject({
      method: "POST",
      payload: {
        currentPassword: "Password123!"
      },
      url: "/api/v1/auth/mfa/enable"
    });
    const disable = await app.inject({
      method: "POST",
      payload: {
        currentPassword: "Password123!"
      },
      url: "/api/v1/auth/mfa/disable"
    });

    expect(status.statusCode).toBe(401);
    expect(enable.statusCode).toBe(401);
    expect(disable.statusCode).toBe(401);
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

function getPublicAccessSetCookie(response: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const accessCookie = getSetCookieHeaders(response).find((header) =>
    header.startsWith(`${PUBLIC_ACCESS_TOKEN_COOKIE_NAME}=`)
  );

  if (!accessCookie) {
    throw new Error("Public access cookie was not set.");
  }

  return accessCookie;
}

function getPublicCsrfSetCookie(response: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const csrfCookie = getSetCookieHeaders(response).find((header) =>
    header.startsWith(`${PUBLIC_CSRF_COOKIE_NAME}=`)
  );

  if (!csrfCookie) {
    throw new Error("Public CSRF cookie was not set.");
  }

  return csrfCookie;
}

function getBackofficeAccessSetCookie(response: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const accessCookie = getSetCookieHeaders(response).find((header) =>
    header.startsWith(`${BACKOFFICE_ACCESS_TOKEN_COOKIE_NAME}=`)
  );

  if (!accessCookie) {
    throw new Error("Backoffice access cookie was not set.");
  }

  return accessCookie;
}

function getBackofficeCsrfSetCookie(response: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const csrfCookie = getSetCookieHeaders(response).find((header) =>
    header.startsWith(`${BACKOFFICE_CSRF_COOKIE_NAME}=`)
  );

  if (!csrfCookie) {
    throw new Error("Backoffice CSRF cookie was not set.");
  }

  return csrfCookie;
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
