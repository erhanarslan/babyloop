import type { FastifyInstance } from "fastify";
import type { ApiRuntimeConfig } from "../config/env.js";
import type { OpenApiRuntimeConfig } from "../plugins/openapi.plugin.js";

type RegisterMetaRoutesOptions = {
  config: ApiRuntimeConfig;
  openApi: OpenApiRuntimeConfig;
};

type CapabilitiesResponse = {
  ok: true;
  data: {
    apiVersion: string;
    docs: {
      accessMode: OpenApiRuntimeConfig["accessMode"];
      enabled: boolean;
    };
    modules: {
      analytics: boolean;
      assistant: boolean;
      backoffice: boolean;
      childProfiles: boolean;
      marketplace: boolean;
      messaging: boolean;
      mockCheckout: boolean;
      notifications: boolean;
      rag: boolean;
      realtime: boolean;
      reminders: boolean;
    };
  };
};

const CAPABILITIES_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ok", "data"],
  properties: {
    ok: {
      type: "boolean",
      enum: [true]
    },
    data: {
      type: "object",
      additionalProperties: false,
      required: ["apiVersion", "docs", "modules"],
      properties: {
        apiVersion: {
          type: "string"
        },
        docs: {
          type: "object",
          additionalProperties: false,
          required: ["enabled", "accessMode"],
          properties: {
            enabled: {
              type: "boolean"
            },
            accessMode: {
              type: "string",
              enum: ["readonly", "interactive"]
            }
          }
        },
        modules: {
          type: "object",
          additionalProperties: false,
          required: [
            "marketplace",
            "messaging",
            "notifications",
            "childProfiles",
            "reminders",
            "mockCheckout",
            "assistant",
            "rag",
            "analytics",
            "realtime",
            "backoffice"
          ],
          properties: {
            marketplace: { type: "boolean" },
            messaging: { type: "boolean" },
            notifications: { type: "boolean" },
            childProfiles: { type: "boolean" },
            reminders: { type: "boolean" },
            mockCheckout: { type: "boolean" },
            assistant: { type: "boolean" },
            rag: { type: "boolean" },
            analytics: { type: "boolean" },
            realtime: { type: "boolean" },
            backoffice: { type: "boolean" }
          }
        }
      }
    }
  }
} as const;

export function registerMetaRoutes(
  app: FastifyInstance,
  options: RegisterMetaRoutesOptions
): void {
  app.get<{ Reply: CapabilitiesResponse }>(
    "/meta/capabilities",
    {
      schema: {
        tags: ["Sistem"],
        operationId: "getMetaCapabilities",
        summary: "BabyLoop ürün yeteneklerini getir",
        description:
          "Secret veya private altyapı adresi döndürmeden API'nin aktif ürün modüllerini ve dokümantasyon durumunu gösterir.",
        response: {
          200: CAPABILITIES_RESPONSE_SCHEMA
        }
      }
    },
    async () => {
      const databaseEnabled = Boolean(options.config.databaseUrl);
      const authenticatedModulesEnabled = Boolean(
        options.config.databaseUrl && options.config.authSecret
      );
      const assistantEnabled =
        options.config.rag.enabled ||
        options.config.assistant.provider !== "unavailable";

      return {
        ok: true,
        data: {
          apiVersion:
            process.env.npm_package_version?.trim() || "0.1.0",
          docs: {
            enabled: options.openApi.enabled,
            accessMode: options.openApi.accessMode
          },
          modules: {
            marketplace: databaseEnabled,
            messaging: authenticatedModulesEnabled,
            notifications: authenticatedModulesEnabled,
            childProfiles: authenticatedModulesEnabled,
            reminders: authenticatedModulesEnabled,
            mockCheckout: authenticatedModulesEnabled,
            assistant: assistantEnabled,
            rag: options.config.rag.enabled,
            analytics: databaseEnabled,
            realtime: authenticatedModulesEnabled,
            backoffice: authenticatedModulesEnabled
          }
        }
      };
    }
  );
}
