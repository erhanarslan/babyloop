import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authHeader, createUser } from "./api-helpers.js";
import { createTestApp, type TestApp } from "./helpers/app.js";

describe("admin rag routes", () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("requires admin permissions", async () => {
    const user = await createUser(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/rag/health",
      headers: authHeader(user.accessToken)
    });

    expect(response.statusCode).toBe(403);
  });

  it("returns RAG health and documents for admin users", async () => {
    const admin = await createUser(app, { role: "admin" });

    const healthResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/rag/health",
      headers: authHeader(admin.accessToken)
    });
    const documentsResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/rag/documents",
      headers: authHeader(admin.accessToken)
    });

    expect(healthResponse.statusCode).toBe(200);
    expect(healthResponse.json()).toMatchObject({
      ok: true,
      data: {
        health: {
          enabled: false
        }
      }
    });
    expect(documentsResponse.statusCode).toBe(200);
    expect(documentsResponse.json().data.documents.length).toBeGreaterThanOrEqual(20);
  });

  it("runs mock eval and rejects live eval when disabled", async () => {
    const admin = await createUser(app, { role: "admin" });

    const mockResponse = await app.inject({
      method: "POST",
      url: "/api/v1/admin/rag/eval/run",
      headers: authHeader(admin.accessToken),
      payload: {
        mode: "mock",
        limit: 3
      }
    });
    const liveResponse = await app.inject({
      method: "POST",
      url: "/api/v1/admin/rag/eval/run",
      headers: authHeader(admin.accessToken),
      payload: {
        mode: "live",
        limit: 1
      }
    });

    expect(mockResponse.statusCode).toBe(200);
    expect(mockResponse.json()).toMatchObject({
      ok: true,
      data: {
        mode: "mock",
        total: 3
      }
    });
    expect(liveResponse.statusCode).toBe(400);
    expect(liveResponse.json()).toMatchObject({
      ok: false,
      error: {
        code: "RAG_LIVE_EVAL_DISABLED"
      }
    });
  });

  it("returns cache stats and can clear cache", async () => {
    const admin = await createUser(app, { role: "admin" });

    const statsResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/rag/cache/stats",
      headers: authHeader(admin.accessToken)
    });
    const clearResponse = await app.inject({
      method: "POST",
      url: "/api/v1/admin/rag/cache/clear",
      headers: authHeader(admin.accessToken)
    });

    expect(statsResponse.statusCode).toBe(200);
    expect(statsResponse.json()).toMatchObject({
      ok: true,
      data: {
        cache: {
          enabled: false
        }
      }
    });
    expect(clearResponse.statusCode).toBe(200);
  });
});
