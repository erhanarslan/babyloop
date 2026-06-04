import type { Database } from "@babyloop/database";
import type { FastifyInstance } from "fastify";
import { createApp } from "../src/app.js";
import type {
  GoogleOAuthClient,
  GoogleOAuthConfig
} from "../src/services/google-oauth.service.js";
import { getTestDatabaseUrl } from "./test-db.js";

const TEST_AUTH_SECRET = "babyloop-test-auth-secret-change-me-32chars";
const TEST_GOOGLE_OAUTH_CONFIG: GoogleOAuthConfig = {
  clientId: "test-google-client-id",
  clientSecret: "test-google-client-secret",
  redirectUri: "http://localhost:4000/api/v1/auth/google/callback",
  webAppUrl: "http://localhost:3000"
};

type TestAppOptions = Partial<{
  authRateLimitMax: number;
  authRateLimitWindowSeconds: number;
  googleOAuth: GoogleOAuthConfig;
  googleOAuthClient: GoogleOAuthClient;
}>;

export type TestApp = FastifyInstance & {
  db: Database;
};

export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const googleOAuth =
    options.googleOAuthClient ? options.googleOAuth ?? TEST_GOOGLE_OAUTH_CONFIG : options.googleOAuth;

  const app = createApp({
    config: {
      allowAuthUnavailable: false,
      authRateLimitMax: options.authRateLimitMax ?? 100,
      authRateLimitWindowSeconds: options.authRateLimitWindowSeconds ?? 60,
      authSecret: TEST_AUTH_SECRET,
      authTokenTtlSeconds: 60 * 60,
      corsOrigins: ["http://localhost:3000"],
      databaseUrl: getTestDatabaseUrl(),
      ...(googleOAuth ? { googleOAuth } : {}),
      host: "127.0.0.1",
      port: 0
    },
    ...(options.googleOAuthClient ? { googleOAuthClient: options.googleOAuthClient } : {})
  });

  await app.ready();

  return app as TestApp;
}
