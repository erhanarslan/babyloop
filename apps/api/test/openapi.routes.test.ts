import { API_PREFIX } from "@babyloop/config";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { readApiRuntimeConfig } from "../src/config/env.js";
import {
  readOpenApiRuntimeConfig,
  type OpenApiRuntimeConfig,
} from "../src/plugins/openapi.plugin.js";

const apps: ReturnType<typeof createApp>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("OpenAPI documentation", () => {
  it("forces enabled production documentation into readonly mode", () => {
    const config = readOpenApiRuntimeConfig({
      NODE_ENV: "production",
      API_DOCS_ENABLED: "true",
      API_DOCS_ACCESS_MODE: "interactive",
    });

    expect(config).toEqual({
      enabled: true,
      accessMode: "readonly",
      routePrefix: "/docs",
    });
  });

  it("serves Swagger UI and OpenAPI JSON when enabled", async () => {
    const app = createTestApp({
      enabled: true,
      accessMode: "readonly",
      routePrefix: "/docs"
    });

    await app.ready();

    const uiResponse = await app.inject({
      method: "GET",
      url: "/docs/"
    });
    const jsonResponse = await app.inject({
      method: "GET",
      url: "/docs/json"
    });

    expect(uiResponse.statusCode).toBe(200);
    expect(uiResponse.headers["content-type"]).toContain("text/html");
    expect(uiResponse.body).toContain("<title>BabyLoop API</title>");
    expect(uiResponse.body).toContain('id="swagger-ui"');
    expect(uiResponse.body).toContain("babyloop-swagger-tools.js");
    expect(uiResponse.body).toContain("babyloop-swagger-tools.css");

    const toolsScriptResponse = await app.inject({
      method: "GET",
      url: "/docs/babyloop-swagger-tools.js"
    });
    const toolsCssResponse = await app.inject({
      method: "GET",
      url: "/docs/babyloop-swagger-tools.css"
    });

    expect(toolsScriptResponse.statusCode).toBe(200);
    expect(toolsScriptResponse.headers["content-type"]).toContain(
      "application/javascript"
    );
    expect(toolsScriptResponse.headers["cache-control"]).toBe(
      "no-store"
    );
    expect(toolsScriptResponse.body).toContain(
      "babyloop-swagger-search"
    );

    expect(toolsCssResponse.statusCode).toBe(200);
    expect(toolsCssResponse.headers["content-type"]).toContain(
      "text/css"
    );
    expect(toolsCssResponse.headers["cache-control"]).toBe(
      "no-store"
    );
    expect(toolsCssResponse.body).toContain(
      ".babyloop-swagger-tools"
    );

    expect(jsonResponse.statusCode).toBe(200);

    const specification = jsonResponse.json<{
      openapi: string;
      info: {
        title: string;
      };
      paths: Record<
        string,
        Record<
          string,
          {
            operationId?: string;
            summary?: string;
            tags?: string[];
          }
        >
      >;
      components?: {
        securitySchemes?: Record<string, unknown>;
      };
    }>();

    expect(specification.openapi).toBe("3.0.3");
    expect(specification.info.title).toBe("BabyLoop API");

    const loginOperation =
      specification.paths["/api/v1/auth/login"]?.post;
    const createListingOperation =
      specification.paths["/api/v1/listings"]?.post;
    const listListingsOperation =
      specification.paths["/api/v1/listings"]?.get;
    const sendMessageOperation =
      specification.paths["/api/v1/conversations/{id}/messages"]?.post;
    const adminEmailOperation =
      specification.paths["/api/v1/admin/email/test-send"]?.post;

    expect(loginOperation?.requestBody).toBeDefined();
    expect(
      loginOperation?.requestBody?.content?.["application/json"]?.schema
        ?.properties?.email
    ).toBeDefined();

    expect(createListingOperation?.requestBody).toBeDefined();
    expect(
      createListingOperation?.requestBody?.content?.["application/json"]
        ?.schema?.properties?.categoryId
    ).toBeDefined();

    expect(
      listListingsOperation?.parameters?.some(
        (parameter: { in?: string; name?: string }) =>
          parameter.in === "query" && parameter.name === "hasImages"
      )
    ).toBe(true);

    expect(sendMessageOperation?.requestBody).toBeDefined();
    expect(adminEmailOperation?.requestBody).toBeDefined();

    expect(specification.paths["/health"]).toBeDefined();
    expect(specification.paths["/health/live"]).toBeDefined();
    expect(specification.paths["/health/ready"]).toBeDefined();
    expect(specification.paths["/internal/metrics"]).toBeUndefined();
    expect(
      specification.paths[`${API_PREFIX}/meta/capabilities`]
    ).toBeDefined();

    expect(
      specification.components?.securitySchemes
    ).toMatchObject({
      bearerAuth: expect.any(Object),
      publicCookieAuth: expect.any(Object),
      backofficeCookieAuth: expect.any(Object),
      csrfHeader: expect.any(Object)
    });

    const operations = Object.values(specification.paths).flatMap(
      (pathItem) =>
        Object.values(pathItem).filter(
          (operation) =>
            operation &&
            typeof operation === "object"
        )
    );

    expect(operations.length).toBeGreaterThan(5);

    for (const operation of operations) {
      expect(operation.operationId).toBeTruthy();
      expect(operation.summary).toBeTruthy();
      expect(operation.tags?.length).toBeGreaterThan(0);
    }

    const operationIds = operations
      .map((operation) => operation.operationId)
      .filter((value): value is string => Boolean(value));

    expect(new Set(operationIds).size).toBe(operationIds.length);
  });

  it("does not expose docs routes when documentation is disabled", async () => {
    const app = createTestApp({
      enabled: false,
      accessMode: "readonly",
      routePrefix: "/docs"
    });

    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/docs/json"
    });

    expect(response.statusCode).toBe(404);
  });

  it("exposes a safe product capabilities document", async () => {
    const app = createTestApp({
      enabled: true,
      accessMode: "readonly",
      routePrefix: "/docs"
    });

    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: `${API_PREFIX}/meta/capabilities`
    });

    expect(response.statusCode).toBe(200);

    const body = response.json<{
      ok: true;
      data: {
        docs: {
          enabled: boolean;
          accessMode: string;
        };
        modules: Record<string, boolean>;
      };
    }>();

    expect(body.ok).toBe(true);
    expect(body.data.docs).toEqual({
      enabled: true,
      accessMode: "readonly"
    });
    expect(body.data.modules).toHaveProperty("marketplace");
    expect(body.data.modules).toHaveProperty("rag");

    const serialized = JSON.stringify(body).toLowerCase();

    expect(serialized).not.toContain("postgresql://");
    expect(serialized).not.toContain("redis://");
    expect(serialized).not.toContain("smtp_password");
    expect(serialized).not.toContain("gemini_api_key");
    expect(serialized).not.toContain("openai_api_key");
    expect(serialized).not.toContain("expo_access_token");
  });

  it("does not place obvious secret values into the OpenAPI document", async () => {
    const app = createTestApp({
      enabled: true,
      accessMode: "readonly",
      routePrefix: "/docs"
    });

    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/docs/json"
    });

    const serialized = response.body.toLowerCase();

    expect(serialized).not.toContain("postgresql://");
    expect(serialized).not.toContain("smtp_password");
    expect(serialized).not.toContain("gemini_api_key");
    expect(serialized).not.toContain("openai_api_key");
    expect(serialized).not.toContain("expo_access_token");
    expect(serialized).not.toContain("rag_qdrant_api_key");
  });
});

function createTestApp(openApi: OpenApiRuntimeConfig) {
  const app = createApp({
    config: readApiRuntimeConfig({
      NODE_ENV: "test",
      ALLOW_AUTH_UNAVAILABLE: "true"
    }),
    openApi
  });

  apps.push(app);

  return app;
}
