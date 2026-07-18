import { describe, expect, it } from "vitest";

import { applyOpenApiRouteContract } from "../src/openapi/openapi-contracts.js";

describe("OpenAPI route contracts", () => {
  it("documents executable auth request bodies", () => {
    const schema = applyOpenApiRouteContract({
      method: "POST",
      schema: {},
      url: "/api/v1/auth/login"
    });

    expect(schema.body).toMatchObject({
      type: "object",
      required: ["email", "password"],
      properties: {
        email: {
          type: "string",
          format: "email"
        },
        password: {
          type: "string"
        },
        clientType: {
          enum: ["web", "mobile", "backoffice"]
        }
      }
    });
  });

  it("separates public and backoffice login contracts", () => {
    const publicLogin = applyOpenApiRouteContract({
      method: "POST",
      schema: {},
      url: "/api/v1/auth/login"
    });

    const backofficeLogin = applyOpenApiRouteContract({
      method: "POST",
      schema: {},
      url: "/api/v1/auth/backoffice/login"
    });

    expect(publicLogin.body).toMatchObject({
      properties: {
        clientType: {
          example: "mobile"
        }
      }
    });

    expect(backofficeLogin.body).toMatchObject({
      required: ["email", "password"],
      properties: {
        email: {
          format: "email"
        },
        password: {
          type: "string"
        }
      }
    });

    expect(
      (
        backofficeLogin.body as {
          properties?: Record<string, unknown>;
        }
      ).properties
    ).not.toHaveProperty("clientType");
  });

  it("documents listing filters and pagination", () => {
    const schema = applyOpenApiRouteContract({
      method: "GET",
      schema: {},
      url: "/api/v1/listings"
    });

    expect(schema.querystring).toMatchObject({
      type: "object",
      properties: {
        q: {
          type: "string"
        },
        categoryId: {
          format: "uuid"
        },
        hasImages: {
          type: "boolean"
        },
        limit: {
          type: "integer"
        },
        offset: {
          type: "integer"
        }
      }
    });
  });

  it("automatically documents every dynamic path parameter", () => {
    const schema = applyOpenApiRouteContract({
      method: "POST",
      schema: {},
      url: "/api/v1/admin/listings/:listingId/images/:imageId/actions"
    });

    expect(schema.params).toMatchObject({
      type: "object",
      required: ["listingId", "imageId"],
      properties: {
        listingId: {
          type: "string",
          format: "uuid"
        },
        imageId: {
          type: "string",
          format: "uuid"
        }
      }
    });
  });

  it("preserves route-owned schema fields over documentation defaults", () => {
    const schema = applyOpenApiRouteContract({
      method: "POST",
      schema: {
        body: {
          type: "object",
          required: ["customField"],
          properties: {
            customField: {
              type: "string"
            }
          }
        },
        summary: "Existing summary"
      },
      url: "/api/v1/auth/login"
    });

    expect(schema.summary).toBe("Existing summary");
    expect(schema.body).toMatchObject({
      required: ["customField"],
      properties: {
        customField: {
          type: "string"
        }
      }
    });
  });

  it("adds common safe response envelopes", () => {
    const schema = applyOpenApiRouteContract({
      method: "GET",
      schema: {},
      url: "/api/v1/categories"
    });

    expect(schema.response).toMatchObject({
      "200": {
        properties: {
          ok: {
            enum: [true]
          },
          data: {
            type: "object"
          }
        }
      },
      "400": {
        properties: {
          ok: {
            enum: [false]
          },
          error: {
            type: "object"
          }
        }
      },
      "401": expect.any(Object),
      "403": expect.any(Object),
      "404": expect.any(Object),
      "429": expect.any(Object),
      "503": expect.any(Object)
    });
  });
});
