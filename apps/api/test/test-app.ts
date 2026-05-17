import { createApp } from "../src/app.js";
import { getTestDatabaseUrl } from "./test-db.js";

const TEST_AUTH_SECRET = "babyloop-test-auth-secret-change-me-32chars";

type TestAppOptions = Partial<{
  authRateLimitMax: number;
  authRateLimitWindowSeconds: number;
}>;

export async function createTestApp(options: TestAppOptions = {}) {
  const app = createApp({
    config: {
      allowAuthUnavailable: false,
      authRateLimitMax: options.authRateLimitMax ?? 100,
      authRateLimitWindowSeconds: options.authRateLimitWindowSeconds ?? 60,
      authSecret: TEST_AUTH_SECRET,
      authTokenTtlSeconds: 60 * 60,
      corsOrigins: ["http://localhost:3000"],
      databaseUrl: getTestDatabaseUrl(),
      host: "127.0.0.1",
      port: 0
    }
  });

  await app.ready();

  return app;
}
