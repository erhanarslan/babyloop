import {
  aiModelRuns,
  authAccounts,
  conversations,
  emailVerificationTokens,
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
import { hashEmailVerificationToken } from "../src/utils/email-verification-token.js";
import { hashMfaOtpCode } from "../src/utils/mfa-otp.js";
import { GOOGLE_OAUTH_STATE_COOKIE_NAME, type GoogleUserInfo } from "../src/services/google-oauth.service.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";
import { authHeader, createUser, loginUser } from "./helpers/auth.js";
import { countEvents, createCategory, createConversation, createListing, getListingSellerProfileId } from "./helpers/fixtures.js";
import { getCookieValue, getDevResetToken, getGoogleOAuthStateSetCookie, getRefreshSetCookie, toCookieHeader } from "./helpers/cookies.js";
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

describe("health API", () => {
  it("returns API health status", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);

    const responseTimeHeader = response.headers["x-response-time-ms"];
    expect(responseTimeHeader).toBeDefined();
    expect(Number(responseTimeHeader)).toBeGreaterThanOrEqual(0);
    const body = response.json();
    expect(body).toMatchObject({
      ok: true,
      service: "babyloop-api",
      dependencies: {
        auth: {
          configured: true
        },
        database: {
          configured: true
        },
        email: {
          mode: expect.any(String)
        },
        rag: {
          enabled: expect.any(Boolean)
        },
        storage: {
          configured: expect.any(Boolean),
          driver: expect.any(String),
          localFallback: expect.any(Boolean)
        }
      }
    });
    expect(body.version).toEqual(expect.any(String));
    expect(body.environment).toEqual(expect.any(String));
    expect(body.timestamp).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(["memory", "redis", null]).toContain(body.dependencies.rag.cacheBackend);
    expect(["memory", "redis", null]).toContain(body.dependencies.rag.metricsBackend);
    expect(["memory", "redis", null]).toContain(body.dependencies.rag.usageLimitsBackend);

    const serializedBody = JSON.stringify(body);
    expect(serializedBody).not.toContain("postgres://");
    expect(serializedBody).not.toContain("postgresql://");
    expect(serializedBody).not.toContain("AUTH_SECRET");
    expect(serializedBody).not.toContain("SECRET_ACCESS_KEY");
    expect(serializedBody).not.toContain("ACCESS_KEY_ID");
    expect(serializedBody).not.toContain("refreshToken");
    expect(serializedBody).not.toContain("accessToken");
  });
});
