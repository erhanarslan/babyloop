import { readFileSync } from "node:fs";

const routeContract = JSON.parse(readFileSync(
  new URL("../../deploy/gcp/deployment-smoke-routes.json", import.meta.url),
  "utf8"
));
if (
  routeContract.schemaVersion !== 1
  || !Array.isArray(routeContract.api)
  || !Array.isArray(routeContract.web)
  || !Array.isArray(routeContract.backoffice)
) {
  throw new Error("Deployment smoke route contract is invalid.");
}

export const API_DEPLOYMENT_SMOKE_ENDPOINTS = Object.freeze(routeContract.api);
export const WEB_DEPLOYMENT_SMOKE_ENDPOINTS = Object.freeze(routeContract.web);
export const BACKOFFICE_DEPLOYMENT_SMOKE_ENDPOINTS = Object.freeze(routeContract.backoffice);

export function readRuntimeCapabilities(body) {
  const docs = body?.data?.docs;
  const modules = body?.data?.modules;
  if (
    body?.ok !== true
    || typeof docs?.enabled !== "boolean"
    || !new Set(["readonly", "interactive"]).has(docs?.accessMode)
    || modules?.marketplace !== true
    || modules?.analytics !== true
  ) {
    throw new Error("Runtime capabilities response does not satisfy the deployment smoke contract.");
  }
  return {
    docs: {
      enabled: docs.enabled,
      accessMode: docs.accessMode
    },
    modules: {
      marketplace: true,
      analytics: true
    }
  };
}

export function planOpenApiProbe(capabilities) {
  if (capabilities?.docs?.enabled === false) {
    return {
      request: false,
      evidence: {
        status: "skipped",
        reason: "runtime_docs_disabled",
        required: false
      },
      outcome: {
        status: "skipped_runtime_disabled",
        enabled: false,
        accessMode: capabilities.docs.accessMode
      }
    };
  }
  if (capabilities?.docs?.enabled === true) {
    return {
      request: true,
      evidence: null,
      outcome: {
        status: "pending",
        enabled: true,
        accessMode: capabilities.docs.accessMode
      }
    };
  }
  throw new Error("Runtime capabilities docs.enabled must be boolean before planning the OpenAPI probe.");
}

export function validateOpenApiProbeResponse({ status, contentType, body }) {
  if (status !== 200) throw new Error(`OpenAPI endpoint returned HTTP ${status}.`);
  if (!String(contentType || "").toLowerCase().includes("application/json")) {
    throw new Error("OpenAPI endpoint did not return application/json.");
  }
  if (!body || typeof body !== "object" || !String(body.openapi || "").startsWith("3.")) {
    throw new Error("OpenAPI endpoint did not return a valid OpenAPI 3 document.");
  }
  return true;
}

export function passedOpenApiOutcome(capabilities) {
  if (capabilities?.docs?.enabled !== true) {
    throw new Error("OpenAPI cannot pass when runtime docs are disabled.");
  }
  return {
    status: "passed",
    enabled: true,
    accessMode: capabilities.docs.accessMode
  };
}

export function failedOpenApiOutcome(capabilities) {
  return {
    status: "failed",
    enabled: capabilities?.docs?.enabled === true,
    accessMode: capabilities?.docs?.accessMode || "unknown"
  };
}
