import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";
import {
  buildOpenApiRouteSchema,
  openApiTags,
  readRouteMethod
} from "../openapi/openapi-catalog.js";
import {
  BABYLOOP_SWAGGER_UI_CSS,
  BABYLOOP_SWAGGER_UI_SCRIPT
} from "../openapi/openapi-ui-assets.js";
import {
  BABYLOOP_SWAGGER_AUTH_CSS,
  BABYLOOP_SWAGGER_AUTH_SCRIPT
} from "../openapi/openapi-auth-ui-assets.js";

export type OpenApiAccessMode = "interactive" | "readonly";

export type OpenApiRuntimeConfig = {
  accessMode: OpenApiAccessMode;
  enabled: boolean;
  routePrefix: "/docs";
};

const DEFAULT_API_VERSION = "0.1.0";

export function readOpenApiRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): OpenApiRuntimeConfig {
  const production = env.NODE_ENV === "production";
  const enabled = readBoolean(
    env.API_DOCS_ENABLED,
    !production
  );
  const requestedAccessMode = readAccessMode(
    env.API_DOCS_ACCESS_MODE,
    production ? "readonly" : "interactive"
  );

  return {
    enabled,
    accessMode: production ? "readonly" : requestedAccessMode,
    routePrefix: "/docs"
  };
}

export function registerOpenApiPlugins(
  app: FastifyInstance,
  options: OpenApiRuntimeConfig
): void {
  if (!options.enabled) {
    return;
  }

  app.register(swagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "BabyLoop API",
        description:
          "BabyLoop pazaryeri, ebeveyn araçları, mesajlaşma, bildirim, AI/RAG ve backoffice operasyon API'leri.",
        version:
          process.env.npm_package_version?.trim() ||
          DEFAULT_API_VERSION
      },
      servers: [
        {
          url: "/",
          description: "Geçerli BabyLoop API sunucusu"
        }
      ],
      tags: openApiTags,
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description:
              "Mobil istemci veya geliştirme araçlarında kullanılan BabyLoop access token."
          },
          publicCookieAuth: {
            type: "apiKey",
            in: "cookie",
            name: "babyloop_public_access_token",
            description:
              "Web istemcisinin HttpOnly public access cookie'si."
          },
          backofficeCookieAuth: {
            type: "apiKey",
            in: "cookie",
            name: "babyloop_backoffice_access_token",
            description:
              "Backoffice istemcisinin HttpOnly access cookie'si."
          },
          refreshCookieAuth: {
            type: "apiKey",
            in: "cookie",
            name: "babyloop_refresh_token",
            description:
              "Oturum yenileme için kullanılan HttpOnly refresh cookie."
          },
          csrfHeader: {
            type: "apiKey",
            in: "header",
            name: "x-babyloop-csrf-token",
            description:
              "Cookie tabanlı authenticated mutation işlemlerinde, eşleşen CSRF cookie değeriyle birlikte gönderilir."
          }
        },
        schemas: {
          ApiError: {
            type: "object",
            additionalProperties: false,
            required: ["ok", "error"],
            properties: {
              ok: {
                type: "boolean",
                enum: [false]
              },
              error: {
                type: "object",
                additionalProperties: true,
                required: ["code", "message"],
                properties: {
                  code: {
                    type: "string",
                    example: "INVALID_REQUEST"
                  },
                  message: {
                    type: "string",
                    example: "İstek geçersiz."
                  }
                }
              }
            }
          }
        }
      }
    },
    exposeHeadRoutes: false,
    hideUntagged: false,
    transform: ({ schema, url, route }) => {
      return {
        schema: buildOpenApiRouteSchema({
          method: readRouteMethod(route),
          schema,
          url
        }),
        url
      };
    }
  });

  registerOpenApiUiAssetRoutes(app, options.routePrefix);

  app.register(swaggerUi, {
    routePrefix: options.routePrefix,
    staticCSP: true,
    transformStaticCSP: (header) => header,
    uiConfig: {
      deepLinking: true,
      displayOperationId: true,
      displayRequestDuration: true,
      docExpansion: "list",
      filter: false,
      operationsSorter: "alpha",
      persistAuthorization: false,
      showCommonExtensions: true,
      showMutatedRequest: false,
      tagsSorter: "alpha",
      tryItOutEnabled: options.accessMode === "interactive",
      withCredentials: true,
      requestInterceptor: async function (request) {
        request.credentials = "include";
        request.withCredentials = true;
        request.headers = request.headers ?? {};

        const method = String(request.method ?? "GET").toUpperCase();

        if (["GET", "HEAD", "OPTIONS"].includes(method)) {
          return request;
        }

        const locationValue = Reflect.get(globalThis, "location");
        const origin =
          locationValue &&
          typeof locationValue === "object" &&
          "origin" in locationValue
            ? String(Reflect.get(locationValue, "origin"))
            : "http://localhost";

        const requestUrl = new URL(String(request.url ?? ""), origin);
        const path = requestUrl.pathname;

        const authorization =
          request.headers.Authorization ??
          request.headers.authorization;

        if (authorization) {
          return request;
        }

        const csrfExemptPaths = [
          "/api/v1/auth/register",
          "/api/v1/auth/login",
          "/api/v1/auth/backoffice/login",
          "/api/v1/auth/refresh",
          "/api/v1/auth/backoffice/refresh",
          "/api/v1/auth/mfa/verify",
          "/api/v1/auth/login-approval/complete",
          "/api/v1/auth/password-reset/request",
          "/api/v1/auth/password-reset/confirm",
          "/api/v1/auth/email-verification/request",
          "/api/v1/auth/email-verification/confirm"
        ];

        if (
          csrfExemptPaths.some(
            (csrfExemptPath) =>
              path === csrfExemptPath ||
              path.startsWith(`${csrfExemptPath}/`)
          )
        ) {
          return request;
        }

        const backofficeRequest =
          path.startsWith("/api/v1/admin/") ||
          path.startsWith("/api/v1/auth/backoffice/");

        const storageValue = Reflect.get(globalThis, "sessionStorage");
        const browserStorage =
          storageValue &&
          typeof storageValue === "object" &&
          typeof Reflect.get(storageValue, "getItem") === "function" &&
          typeof Reflect.get(storageValue, "setItem") === "function"
            ? storageValue
            : null;

        const storageKey = backofficeRequest
          ? "babyloop-swagger-backoffice-csrf"
          : "babyloop-swagger-public-csrf";

        let csrfToken = browserStorage
          ? Reflect.get(browserStorage, "getItem").call(
              browserStorage,
              storageKey
            )
          : null;

        if (!csrfToken) {
          const fetchValue = Reflect.get(globalThis, "fetch");

          if (typeof fetchValue === "function") {
            const csrfPath = backofficeRequest
              ? "/api/v1/auth/backoffice/csrf"
              : "/api/v1/auth/csrf";

            try {
              const csrfResponse = await fetchValue(csrfPath, {
                method: "GET",
                credentials: "include",
                headers: {
                  Accept: "application/json"
                }
              });

              if (csrfResponse.ok) {
                const csrfBody: unknown = await csrfResponse.json();
                const csrfData =
                  csrfBody && typeof csrfBody === "object"
                    ? Reflect.get(csrfBody, "data")
                    : null;
                const responseToken =
                  csrfData && typeof csrfData === "object"
                    ? Reflect.get(csrfData, "csrfToken")
                    : null;

                if (typeof responseToken === "string" && responseToken) {
                  csrfToken = responseToken;

                  if (browserStorage) {
                    Reflect.get(browserStorage, "setItem").call(
                      browserStorage,
                      storageKey,
                      responseToken
                    );
                  }
                }
              }
            } catch {
              csrfToken = null;
            }
          }
        }

        if (csrfToken) {
          request.headers["x-babyloop-csrf-token"] = csrfToken;
        }

        return request;
      },
      responseInterceptor: function (response) {
        let body = response.obj;

        if (
          (!body || typeof body !== "object") &&
          typeof response.data === "string"
        ) {
          try {
            body = JSON.parse(response.data);
          } catch {
            body = null;
          }
        }

        const responseData =
          body &&
          typeof body === "object" &&
          body.data &&
          typeof body.data === "object"
            ? body.data
            : null;

        const csrfToken =
          responseData && typeof responseData.csrfToken === "string"
            ? responseData.csrfToken
            : null;

        const locationValue = Reflect.get(globalThis, "location");
        const origin =
          locationValue &&
          typeof locationValue === "object" &&
          "origin" in locationValue
            ? String(Reflect.get(locationValue, "origin"))
            : "http://localhost";

        const responseUrl = new URL(
          String(response.url ?? ""),
          origin
        );
        const responsePath = responseUrl.pathname;

        const storageValue = Reflect.get(globalThis, "sessionStorage");
        const browserStorage =
          storageValue &&
          typeof storageValue === "object" &&
          typeof Reflect.get(storageValue, "setItem") === "function" &&
          typeof Reflect.get(storageValue, "removeItem") === "function"
            ? storageValue
            : null;

        if (csrfToken && browserStorage) {
          const storageKey = responsePath.includes("/auth/backoffice/csrf")
            ? "babyloop-swagger-backoffice-csrf"
            : "babyloop-swagger-public-csrf";

          Reflect.get(browserStorage, "setItem").call(
            browserStorage,
            storageKey,
            csrfToken
          );
        }

        const accessToken =
          responseData && typeof responseData.accessToken === "string"
            ? responseData.accessToken
            : null;

        if (accessToken) {
          const swaggerUi = Reflect.get(globalThis, "ui");

          if (
            swaggerUi &&
            typeof swaggerUi === "object" &&
            typeof Reflect.get(swaggerUi, "preauthorizeApiKey") === "function"
          ) {
            Reflect.get(swaggerUi, "preauthorizeApiKey").call(
              swaggerUi,
              "bearerAuth",
              accessToken
            );
          }
        }

        const errorCode =
          body &&
          typeof body === "object" &&
          body.error &&
          typeof body.error === "object" &&
          typeof body.error.code === "string"
            ? body.error.code
            : null;

        if (
          browserStorage &&
          (errorCode === "CSRF_TOKEN_REQUIRED" ||
            errorCode === "PUBLIC_CSRF_TOKEN_REQUIRED")
        ) {
          const storageKey = responsePath.startsWith("/api/v1/admin/")
            ? "babyloop-swagger-backoffice-csrf"
            : "babyloop-swagger-public-csrf";

          Reflect.get(browserStorage, "removeItem").call(
            browserStorage,
            storageKey
          );
        }

        return response;
      },
      supportedSubmitMethods:
        options.accessMode === "interactive"
          ? ["get", "post", "put", "patch", "delete"]
          : []
    },
    theme: {
      title: "BabyLoop API",
      js: [
        {
          filename: "babyloop-swagger-tools.js",
          content: BABYLOOP_SWAGGER_UI_SCRIPT
        },
        {
          filename: "babyloop-swagger-auth.js",
          content: BABYLOOP_SWAGGER_AUTH_SCRIPT
        }
      ],
      css: [
        {
          filename: "babyloop-swagger-tools.css",
          content: BABYLOOP_SWAGGER_UI_CSS
        },
        {
          filename: "babyloop-swagger-auth.css",
          content: BABYLOOP_SWAGGER_AUTH_CSS
        }
      ]
    }
  });
}

function registerOpenApiUiAssetRoutes(
  app: FastifyInstance,
  routePrefix: OpenApiRuntimeConfig["routePrefix"]
): void {
  app.get(
    `${routePrefix}/babyloop-swagger-tools.js`,
    {
      schema: {
        hide: true
      }
    },
    async (_request, reply) => {
      return reply
        .header("Cache-Control", "no-store")
        .type("application/javascript; charset=utf-8")
        .send(BABYLOOP_SWAGGER_UI_SCRIPT);
    }
  );

  app.get(
    `${routePrefix}/babyloop-swagger-auth.js`,
    {
      schema: {
        hide: true
      }
    },
    async (_request, reply) => {
      return reply
        .header("Cache-Control", "no-store")
        .type("application/javascript; charset=utf-8")
        .send(BABYLOOP_SWAGGER_AUTH_SCRIPT);
    }
  );

  app.get(
    `${routePrefix}/babyloop-swagger-auth.css`,
    {
      schema: {
        hide: true
      }
    },
    async (_request, reply) => {
      return reply
        .header("Cache-Control", "no-store")
        .type("text/css; charset=utf-8")
        .send(BABYLOOP_SWAGGER_AUTH_CSS);
    }
  );

  app.get(
    `${routePrefix}/babyloop-swagger-tools.css`,
    {
      schema: {
        hide: true
      }
    },
    async (_request, reply) => {
      return reply
        .header("Cache-Control", "no-store")
        .type("text/css; charset=utf-8")
        .send(BABYLOOP_SWAGGER_UI_CSS);
    }
  );
}

function readBoolean(
  value: string | undefined,
  fallback: boolean
): boolean {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  throw new Error(
    "API_DOCS_ENABLED must be true/false, 1/0, yes/no, or on/off."
  );
}

function readAccessMode(
  value: string | undefined,
  fallback: OpenApiAccessMode
): OpenApiAccessMode {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return fallback;
  }

  if (normalized === "readonly" || normalized === "interactive") {
    return normalized;
  }

  throw new Error(
    "API_DOCS_ACCESS_MODE must be readonly or interactive."
  );
}
