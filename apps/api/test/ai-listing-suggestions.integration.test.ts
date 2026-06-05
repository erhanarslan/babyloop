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
