import { authAccounts, profiles, sessions, users } from "@babyloop/database/schema";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BACKOFFICE_ACCESS_TOKEN_COOKIE_NAME } from "../src/utils/backoffice-access-token-cookie.js";
import { BACKOFFICE_REFRESH_TOKEN_COOKIE_NAME } from "../src/utils/backoffice-refresh-token.js";
import { PUBLIC_ACCESS_TOKEN_COOKIE_NAME } from "../src/utils/public-access-token-cookie.js";
import { REFRESH_TOKEN_COOKIE_NAME } from "../src/utils/refresh-token.js";
import { resetGoogleOAuthReplayGuardForTests } from "../src/services/google-oauth.service.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { createUser } from "./helpers/auth.js";
import { getGoogleOAuthStateSetCookie, getSetCookieHeaders, toCookieHeader } from "./helpers/cookies.js";
import { resetTestDatabase } from "./helpers/db.js";
import { createFakeGoogleOAuthClient } from "./helpers/google-oauth.js";

let app!: TestApp;

beforeEach(async () => {
  await resetTestDatabase();
  resetGoogleOAuthReplayGuardForTests();
});

afterEach(async () => {
  await app?.close();
});

describe("backoffice Google OAuth", () => {
  it.each([
    ["admin", "staff"],
    ["moderator", "staff"],
    ["support", "staff"],
    ["backoffice_viewer", "staff"],
    ["user", "preview"]
  ] as const)("creates an isolated %s backoffice session with %s access", async (role, accessMode) => {
    const email = `${role}@babyloop.test`;
    app = await createTestApp({
      googleOAuthClient: createFakeGoogleOAuthClient({
        login: { sub: `google-${role}`, email, email_verified: true }
      })
    });
    const user = await createLinkedGoogleUser(email, role, `google-${role}`);
    const { state, cookie } = await startBackofficeOAuth("/listings?status=active");

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/auth/google/callback?state=${encodeURIComponent(state)}&code=login`,
      headers: { cookie }
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(
      "http://localhost:3001/auth/callback?status=success&next=%2Flistings%3Fstatus%3Dactive"
    );
    const cookies = getSetCookieHeaders(response);
    expect(cookies.some((value) => value.startsWith(`${BACKOFFICE_ACCESS_TOKEN_COOKIE_NAME}=`))).toBe(true);
    expect(cookies.some((value) => value.startsWith(`${BACKOFFICE_REFRESH_TOKEN_COOKIE_NAME}=`))).toBe(true);
    expect(cookies.some((value) => value.startsWith(`${PUBLIC_ACCESS_TOKEN_COOKIE_NAME}=`))).toBe(false);
    expect(cookies.some((value) => value.startsWith(`${REFRESH_TOKEN_COOKIE_NAME}=`))).toBe(false);

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/backoffice/me",
      headers: { cookie: cookies.map(toCookieHeader).join("; ") }
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ data: { accessMode, user: { id: user.user.id, role } } });
  });

  it("does not create users, profiles, auth accounts, or sessions for an unknown Google identity", async () => {
    app = await createTestApp({
      googleOAuthClient: createFakeGoogleOAuthClient({
        missing: { sub: "google-missing", email: "missing@babyloop.test", email_verified: true }
      })
    });
    const before = await countAuthRows();
    const { state, cookie } = await startBackofficeOAuth();
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/auth/google/callback?state=${encodeURIComponent(state)}&code=missing`,
      headers: { cookie }
    });

    expect(response.headers.location).toBe(
      "http://localhost:3001/login?authError=google_account_not_found"
    );
    expect(await countAuthRows()).toEqual(before);
  });

  it("rejects unsafe next values and refuses a consumed state replay", async () => {
    app = await createTestApp({
      googleOAuthClient: createFakeGoogleOAuthClient({
        login: { sub: "google-replay", email: "replay@babyloop.test", email_verified: true }
      })
    });
    await createLinkedGoogleUser("replay@babyloop.test", "admin", "google-replay");
    const { state, cookie } = await startBackofficeOAuth("//evil.example/steal");
    const request = {
      method: "GET" as const,
      url: `/api/v1/auth/google/callback?state=${encodeURIComponent(state)}&code=login`,
      headers: { cookie }
    };

    const first = await app.inject(request);
    const replay = await app.inject(request);
    expect(first.headers.location).toBe("http://localhost:3001/auth/callback?status=success");
    expect(replay.headers.location).toBe("http://localhost:3001/login?authError=google_auth_failed");
    expect(String(first.headers.location)).not.toContain("evil.example");
  });

  it("fails closed when the existing Google link does not match the provider subject", async () => {
    app = await createTestApp({
      googleOAuthClient: createFakeGoogleOAuthClient({
        login: { sub: "wrong-subject", email: "linked@babyloop.test", email_verified: true }
      })
    });
    await createLinkedGoogleUser("linked@babyloop.test", "admin", "expected-subject");
    const { state, cookie } = await startBackofficeOAuth();
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/auth/google/callback?state=${encodeURIComponent(state)}&code=login`,
      headers: { cookie }
    });
    expect(response.headers.location).toBe(
      "http://localhost:3001/login?authError=google_account_not_linked"
    );
  });

  it("fails closed when an existing user has no linked Google account", async () => {
    app = await createTestApp({
      googleOAuthClient: createFakeGoogleOAuthClient({
        login: { sub: "google-unlinked", email: "unlinked@babyloop.test", email_verified: true }
      })
    });
    const user = await createUser(app, { email: "unlinked@babyloop.test", role: "admin" });
    await app.db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, user.user.id));
    const { state, cookie } = await startBackofficeOAuth();

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/auth/google/callback?state=${encodeURIComponent(state)}&code=login`,
      headers: { cookie }
    });

    expect(response.headers.location).toBe(
      "http://localhost:3001/login?authError=google_account_not_linked"
    );
  });

  it("fails closed when the user has multiple Google account links", async () => {
    app = await createTestApp({
      googleOAuthClient: createFakeGoogleOAuthClient({
        login: { sub: "google-primary", email: "duplicate-link@babyloop.test", email_verified: true }
      })
    });
    const user = await createLinkedGoogleUser(
      "duplicate-link@babyloop.test",
      "admin",
      "google-primary"
    );
    await app.db.insert(authAccounts).values({
      userId: user.user.id,
      provider: "google",
      providerAccountId: "google-secondary",
      email: "duplicate-link@babyloop.test",
      emailVerifiedAt: new Date()
    });
    const { state, cookie } = await startBackofficeOAuth();

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/auth/google/callback?state=${encodeURIComponent(state)}&code=login`,
      headers: { cookie }
    });

    expect(response.headers.location).toBe(
      "http://localhost:3001/login?authError=google_account_not_linked"
    );
  });

  it("fails closed for unsupported database roles", async () => {
    app = await createTestApp({
      googleOAuthClient: createFakeGoogleOAuthClient({
        login: { sub: "google-owner", email: "owner@babyloop.test", email_verified: true }
      })
    });
    const user = await createLinkedGoogleUser("owner@babyloop.test", "admin", "google-owner");
    await app.db.update(users).set({ role: "owner" }).where(eq(users.id, user.user.id));
    const { state, cookie } = await startBackofficeOAuth();

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/auth/google/callback?state=${encodeURIComponent(state)}&code=login`,
      headers: { cookie }
    });

    expect(response.headers.location).toBe(
      "http://localhost:3001/login?authError=google_auth_failed"
    );
  });

  it("maps provider exchange failures to a controlled error", async () => {
    app = await createTestApp({ googleOAuthClient: createFakeGoogleOAuthClient({}) });
    const { state, cookie } = await startBackofficeOAuth();

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/auth/google/callback?state=${encodeURIComponent(state)}&code=unknown`,
      headers: { cookie }
    });

    expect(response.headers.location).toBe(
      "http://localhost:3001/login?authError=google_auth_failed"
    );
    expect(String(response.headers.location)).not.toContain("unknown");
  });

  it("never turns a public OAuth audience into a backoffice session", async () => {
    app = await createTestApp({
      googleOAuthClient: createFakeGoogleOAuthClient({
        login: { sub: "google-public", email: "public@babyloop.test", email_verified: true }
      })
    });
    await createLinkedGoogleUser("public@babyloop.test", "admin", "google-public");
    const start = await app.inject({ method: "GET", url: "/api/v1/auth/google/start" });
    const state = new URL(String(start.headers.location)).searchParams.get("state");
    const stateCookie = getGoogleOAuthStateSetCookie(start).split(";")[0];

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/auth/google/callback?state=${encodeURIComponent(state!)}&code=login`,
      headers: { cookie: stateCookie }
    });
    const cookies = getSetCookieHeaders(response);

    expect(response.headers.location).toBe("http://localhost:3000/auth/callback?status=success");
    expect(cookies.some((value) => value.startsWith(`${PUBLIC_ACCESS_TOKEN_COOKIE_NAME}=`))).toBe(true);
    expect(cookies.some((value) => value.startsWith(`${BACKOFFICE_ACCESS_TOKEN_COOKIE_NAME}=`))).toBe(false);
    expect(cookies.some((value) => value.startsWith(`${BACKOFFICE_REFRESH_TOKEN_COOKIE_NAME}=`))).toBe(false);
  });

  it.each([
    ["loginDisabled", "account_disabled"],
    ["mfaEnabled", "session_establishment_failed"],
    ["mobileLoginApprovalEnabled", "session_establishment_failed"]
  ] as const)("fails closed when %s is enabled", async (field, error) => {
    app = await createTestApp({
      googleOAuthClient: createFakeGoogleOAuthClient({
        login: { sub: `google-${field}`, email: `${field}@babyloop.test`, email_verified: true }
      })
    });
    const user = await createLinkedGoogleUser(`${field}@babyloop.test`, "admin", `google-${field}`);
    await app.db.update(users).set({ [field]: true }).where(eq(users.id, user.user.id));
    const { state, cookie } = await startBackofficeOAuth();
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/auth/google/callback?state=${encodeURIComponent(state)}&code=login`,
      headers: { cookie }
    });
    expect(response.headers.location).toBe(`http://localhost:3001/login?authError=${error}`);
  });

  it("maps provider cancellation without exposing state", async () => {
    app = await createTestApp({ googleOAuthClient: createFakeGoogleOAuthClient({}) });
    const { state, cookie } = await startBackofficeOAuth("/profiles");
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/auth/google/callback?state=${encodeURIComponent(state)}&error=access_denied`,
      headers: { cookie }
    });
    expect(response.headers.location).toBe(
      "http://localhost:3001/login?authError=access_denied&next=%2Fprofiles"
    );
    expect(String(response.headers.location)).not.toContain(state);
  });
});

async function startBackofficeOAuth(next?: string) {
  const suffix = next ? `?next=${encodeURIComponent(next)}` : "";
  const response = await app.inject({ method: "GET", url: `/api/v1/auth/backoffice/google/start${suffix}` });
  expect(response.statusCode).toBe(302);
  const state = new URL(String(response.headers.location)).searchParams.get("state");
  expect(state).toBeTruthy();
  const stateCookie = getGoogleOAuthStateSetCookie(response);
  return { state: state!, cookie: `${stateCookie.split(";")[0]}` };
}

async function createLinkedGoogleUser(email: string, role: string, subject: string) {
  const user = await createUser(app, { email, role });
  const now = new Date();
  await app.db.update(users).set({ emailVerifiedAt: now }).where(eq(users.id, user.user.id));
  await app.db.insert(authAccounts).values({
    userId: user.user.id,
    provider: "google",
    providerAccountId: subject,
    email,
    emailVerifiedAt: now
  });
  return user;
}

async function countAuthRows() {
  const [userRows, profileRows, accountRows, sessionRows] = await Promise.all([
    app.db.select({ id: users.id }).from(users),
    app.db.select({ id: profiles.id }).from(profiles),
    app.db.select({ id: authAccounts.id }).from(authAccounts),
    app.db.select({ id: sessions.id }).from(sessions)
  ]);
  return [userRows.length, profileRows.length, accountRows.length, sessionRows.length];
}
