import { CURRENT_TERMS_VERSION } from "@babyloop/shared";
import {
  emailVerificationTokens,
  mfaOtpChallenges,
  passwordResetTokens,
  users
} from "@babyloop/database/schema";
import { and, eq, isNull } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { hashEmailVerificationToken } from "../src/utils/email-verification-token.js";
import { hashMfaOtpCode } from "../src/utils/mfa-otp.js";
import { hashPasswordResetToken } from "../src/utils/password-reset-token.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { createUser } from "./helpers/auth.js";
import { resetTestDatabase } from "./helpers/db.js";

let app!: TestApp;

beforeEach(async () => {
  await resetTestDatabase();
  app = await createTestApp();
});

afterEach(async () => {
  await app.close();
});

describe("auth security edge cases", () => {
  it("rate limits repeated auth attempts", async () => {
    await app.close();

    app = await createTestApp({
      authRateLimitMax: 2,
      authRateLimitWindowSeconds: 60
    });

    const payload = {
      email: "rate-limit@example.com",
      password: "WrongPassword123!"
    };

    const first = await app.inject({
      method: "POST",
      payload,
      url: "/api/v1/auth/login"
    });

    const second = await app.inject({
      method: "POST",
      payload,
      url: "/api/v1/auth/login"
    });

    const third = await app.inject({
      method: "POST",
      payload,
      url: "/api/v1/auth/login"
    });

    expect(first.statusCode).toBe(401);
    expect(second.statusCode).toBe(401);
    expect(third.statusCode).toBe(429);
    expect(third.body).not.toContain("password");
    expect(third.body).not.toContain("accessToken");
    expect(third.body).not.toContain("refreshToken");
  });

  it("password reset stores only token hashes and consumes previous active reset tokens", async () => {
    const user = await createUser(app, {
      email: "reset-token-rotation@example.com",
      password: "Password123!"
    });

    const first = await app.inject({
      method: "POST",
      payload: {
        email: user.user.email
      },
      url: "/api/v1/auth/password-reset/request"
    });

    const firstToken = first.json().data.devResetToken as string;

    const second = await app.inject({
      method: "POST",
      payload: {
        email: user.user.email
      },
      url: "/api/v1/auth/password-reset/request"
    });

    const secondToken = second.json().data.devResetToken as string;

    const rows = await app.db
      .select({
        consumedAt: passwordResetTokens.consumedAt,
        tokenHash: passwordResetTokens.tokenHash
      })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.user.id));

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(firstToken).not.toBe(secondToken);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.tokenHash)).toEqual(
      expect.arrayContaining([
        hashPasswordResetToken(firstToken),
        hashPasswordResetToken(secondToken)
      ])
    );
    expect(rows.some((row) => row.tokenHash === firstToken)).toBe(false);
    expect(rows.some((row) => row.tokenHash === secondToken)).toBe(false);
    expect(rows.filter((row) => row.consumedAt === null)).toHaveLength(1);

    const oldTokenConfirm = await app.inject({
      method: "POST",
      payload: {
        newPassword: "NewPassword123!",
        token: firstToken
      },
      url: "/api/v1/auth/password-reset/confirm"
    });

    const currentTokenConfirm = await app.inject({
      method: "POST",
      payload: {
        newPassword: "NewPassword123!",
        token: secondToken
      },
      url: "/api/v1/auth/password-reset/confirm"
    });

    expect(oldTokenConfirm.statusCode).toBe(400);
    expect(oldTokenConfirm.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_PASSWORD_RESET_TOKEN"
      }
    });
    expect(currentTokenConfirm.statusCode).toBe(200);
  });

  it("email verification tokens are single-use and never exposed as hashes", async () => {
    const register = await app.inject({
      method: "POST",
      payload: {
        displayName: "Verify Once",
        email: "verify-once@example.com",
        locationCity: "İstanbul",
        password: "Password123!",
        termsAccepted: true,
        termsVersion: CURRENT_TERMS_VERSION
      },
      url: "/api/v1/auth/register"
    });

    expect(register.statusCode).toBe(201);

    const token = register.json().data.devEmailVerificationToken as string;
    const tokenHash = hashEmailVerificationToken(token);

    const rowsBefore = await app.db
      .select({
        consumedAt: emailVerificationTokens.consumedAt,
        tokenHash: emailVerificationTokens.tokenHash
      })
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.tokenHash, tokenHash));

    expect(rowsBefore).toHaveLength(1);
    expect(rowsBefore[0]?.tokenHash).toBe(tokenHash);
    expect(rowsBefore[0]?.tokenHash).not.toBe(token);
    expect(register.body).not.toContain(tokenHash);

    const firstConfirm = await app.inject({
      method: "POST",
      payload: {
        token
      },
      url: "/api/v1/auth/email-verification/confirm"
    });

    const secondConfirm = await app.inject({
      method: "POST",
      payload: {
        token
      },
      url: "/api/v1/auth/email-verification/confirm"
    });

    const [userRow] = await app.db
      .select({
        emailVerifiedAt: users.emailVerifiedAt
      })
      .from(users)
      .where(eq(users.email, "verify-once@example.com"));

    const [tokenRow] = await app.db
      .select({
        consumedAt: emailVerificationTokens.consumedAt
      })
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.tokenHash, tokenHash));

    expect(firstConfirm.statusCode).toBe(200);
    expect(secondConfirm.statusCode).toBe(400);
    expect(secondConfirm.json()).toMatchObject({
      ok: false,
      error: {
        code: "EMAIL_VERIFICATION_TOKEN_INVALID"
      }
    });
    expect(userRow?.emailVerifiedAt).toBeInstanceOf(Date);
    expect(tokenRow?.consumedAt).toBeInstanceOf(Date);
  });

  it("MFA OTP rejects wrong, expired, and reused codes without issuing cookies", async () => {
    const user = await createUser(app, {
      email: "mfa-edge-cases@example.com",
      password: "Password123!"
    });

    await app.db
      .update(users)
      .set({ mfaEnabled: true })
      .where(eq(users.id, user.user.id));

    const login = await app.inject({
      method: "POST",
      payload: {
        email: user.user.email,
        password: "Password123!"
      },
      url: "/api/v1/auth/login"
    });

    const challengeId = login.json().data.challengeId as string;
    const validCode = login.json().data.devOtpCode as string;

    const wrong = await app.inject({
      method: "POST",
      payload: {
        challengeId,
        code: "000000"
      },
      url: "/api/v1/auth/mfa/verify"
    });

    await app.db
      .update(mfaOtpChallenges)
      .set({
        expiresAt: new Date(Date.now() - 60_000)
      })
      .where(eq(mfaOtpChallenges.id, challengeId));

    const expired = await app.inject({
      method: "POST",
      payload: {
        challengeId,
        code: validCode
      },
      url: "/api/v1/auth/mfa/verify"
    });

    const [freshChallenge] = await app.db
      .insert(mfaOtpChallenges)
      .values({
        codeHash: hashMfaOtpCode("123456"),
        expiresAt: new Date(Date.now() + 60_000),
        purpose: "login",
        userId: user.user.id
      })
      .returning({
        id: mfaOtpChallenges.id
      });

    const firstUse = await app.inject({
      method: "POST",
      payload: {
        challengeId: freshChallenge.id,
        code: "123456"
      },
      url: "/api/v1/auth/mfa/verify"
    });

    const reused = await app.inject({
      method: "POST",
      payload: {
        challengeId: freshChallenge.id,
        code: "123456"
      },
      url: "/api/v1/auth/mfa/verify"
    });

    const activeChallenges = await app.db
      .select({
        id: mfaOtpChallenges.id
      })
      .from(mfaOtpChallenges)
      .where(and(
        eq(mfaOtpChallenges.userId, user.user.id),
        isNull(mfaOtpChallenges.consumedAt)
      ));

    expect(login.statusCode).toBe(200);
    expect(login.json().data.mfaRequired).toBe(true);

    for (const response of [wrong, expired, reused]) {
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        ok: false,
        error: {
          code: "MFA_CODE_INVALID"
        }
      });
      expect(response.headers["set-cookie"]).toBeUndefined();
      expect(response.body).not.toContain("accessToken");
      expect(response.body).not.toContain("refreshToken");
      expect(response.body).not.toContain("passwordHash");
      expect(response.body).not.toContain("codeHash");
    }

    expect(firstUse.statusCode).toBe(200);
    expect(firstUse.headers["set-cookie"]).toBeDefined();
    expect(activeChallenges.map((challenge) => challenge.id)).not.toContain(freshChallenge.id);
  });
});
