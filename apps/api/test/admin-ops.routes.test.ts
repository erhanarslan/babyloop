import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authHeader, createUser } from "./api-helpers.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";

const leakedTerms = [
  "SMTP_PASS",
  "RESEND_API_KEY",
  "S3_SECRET_ACCESS_KEY",
  "AWS_SECRET_ACCESS_KEY",
  "super-secret-storage-key",
  "super-secret-email-key",
  "password",
  "accessToken",
  "refreshToken"
];

describe("admin ops routes", () => {
  let app: TestApp;

  beforeEach(async () => {
    await resetTestDatabase();
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "super-secret-storage-key");
    vi.stubEnv("RESEND_API_KEY", "super-secret-email-key");
    vi.stubEnv("SMTP_PASS", "super-secret-smtp-password");
    app = await createTestApp();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (app) {
      await app.close();
    }
  });

  it("protects storage ops preview and returns secret-safe admin data", async () => {
    const user = await createUser(app);
    const admin = await createUser(app, { role: "admin" });

    const unauthenticated = await app.inject({
      method: "GET",
      url: "/api/v1/admin/storage/ops-preview"
    });
    const forbidden = await app.inject({
      headers: authHeader(user.accessToken),
      method: "GET",
      url: "/api/v1/admin/storage/ops-preview"
    });
    const ok = await app.inject({
      headers: authHeader(admin.accessToken),
      method: "GET",
      url: "/api/v1/admin/storage/ops-preview"
    });

    expect(unauthenticated.statusCode).toBe(401);
    expect(forbidden.statusCode).toBe(403);
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({
      ok: true,
      data: {
        uploadRoute: {
          routePrefix: "/api/v1/uploads/listings"
        }
      }
    });
    expectResponseToBeSecretSafe(ok.body);
  });

  it("protects notification ops preview with admin-only guards", async () => {
    const user = await createUser(app);
    const admin = await createUser(app, { role: "admin" });

    const unauthenticated = await app.inject({
      method: "GET",
      url: "/api/v1/admin/notifications/ops-preview"
    });
    const forbidden = await app.inject({
      headers: authHeader(user.accessToken),
      method: "GET",
      url: "/api/v1/admin/notifications/ops-preview"
    });

    expect(unauthenticated.statusCode).toBe(401);
    expect(forbidden.statusCode).toBe(403);
    expect(admin.accessToken).toBeTruthy();
  });
});

function expectResponseToBeSecretSafe(body: string): void {
  for (const leakedTerm of leakedTerms) {
    expect(body).not.toContain(leakedTerm);
  }
}
