import type { Database } from "@babyloop/database";
import type { FastifyInstance } from "fastify";
import path from "node:path";
import { tmpdir } from "node:os";
import { createApp } from "../../src/app.js";
import type { EmailDeliveryService } from "../../src/services/email-delivery.service.js";
import type {
  GoogleOAuthClient,
  GoogleOAuthConfig
} from "../../src/services/google-oauth.service.js";
import { getTestDatabaseUrl } from "./db.js";

export const TEST_AUTH_SECRET = "babyloop-test-auth-secret-change-me-32chars";

export const TEST_GOOGLE_OAUTH_CONFIG: GoogleOAuthConfig = {
  clientId: "test-google-client-id",
  clientSecret: "test-google-client-secret",
  redirectUri: "http://localhost:4000/api/v1/auth/google/callback",
  webAppUrl: "http://localhost:3000"
};

type TestAppOptions = Partial<{
  authRateLimitMax: number;
  authRateLimitWindowSeconds: number;
  emailDelivery: EmailDeliveryService;
  googleOAuth: GoogleOAuthConfig;
  googleOAuthClient: GoogleOAuthClient;
  uploadRoot: string;
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
      emailDeliveryMode: "noop",
      ...(googleOAuth ? { googleOAuth } : {}),
      host: "127.0.0.1",
      port: 0,
      uploadRoot: options.uploadRoot ?? path.join(tmpdir(), "babyloop-test-uploads"),
      webAppUrl: "http://localhost:3000"
    },
    ...(options.emailDelivery ? { emailDelivery: options.emailDelivery } : {}),
    ...(options.googleOAuthClient ? { googleOAuthClient: options.googleOAuthClient } : {})
  });

  await app.ready();

  return app as TestApp;
}
