import { describe, expect, it } from "vitest";

import {
  BABYLOOP_SWAGGER_UI_CSS,
  BABYLOOP_SWAGGER_UI_SCRIPT
} from "../src/openapi/openapi-ui-assets.js";

describe("BabyLoop Swagger UI assets", () => {
  it("provides deep endpoint search instead of tag-only filtering", () => {
    expect(BABYLOOP_SWAGGER_UI_SCRIPT).toContain(
      "babyloop-swagger-search"
    );
    expect(BABYLOOP_SWAGGER_UI_SCRIPT).toContain(
      ".opblock-summary-method"
    );
    expect(BABYLOOP_SWAGGER_UI_SCRIPT).toContain(
      ".opblock-summary-path"
    );
    expect(BABYLOOP_SWAGGER_UI_SCRIPT).toContain(
      ".opblock-summary-description"
    );
    expect(BABYLOOP_SWAGGER_UI_SCRIPT).toContain(
      "eşleşen endpoint bulundu"
    );
  });

  it("documents the automatic cookie and CSRF Swagger workflow", () => {
    expect(BABYLOOP_SWAGGER_UI_SCRIPT).toContain(
      "Cookie + CSRF otomasyonu aktif"
    );
    expect(BABYLOOP_SWAGGER_UI_SCRIPT).toContain(
      "POST /api/v1/auth/login"
    );
    expect(BABYLOOP_SWAGGER_UI_SCRIPT).toContain(
      "POST /api/v1/auth/backoffice/login"
    );
  });

  it("ships responsive styling for the search and auth helper", () => {
    expect(BABYLOOP_SWAGGER_UI_CSS).toContain(
      ".babyloop-swagger-tools"
    );
    expect(BABYLOOP_SWAGGER_UI_CSS).toContain(
      ".opblock-tag-section[hidden]"
    );
    expect(BABYLOOP_SWAGGER_UI_CSS).toContain(
      "@media (max-width: 760px)"
    );
  });
});

describe("BabyLoop Swagger authentication UI", () => {
  it("provides cookie-backed public and backoffice login controls", async () => {
    const assets = await import(
      "../src/openapi/openapi-auth-ui-assets.js"
    );

    expect(assets.BABYLOOP_SWAGGER_AUTH_SCRIPT).toContain(
      "babyloop-swagger-session-panel"
    );
    expect(assets.BABYLOOP_SWAGGER_AUTH_SCRIPT).toContain(
      "/api/v1/auth/login"
    );
    expect(assets.BABYLOOP_SWAGGER_AUTH_SCRIPT).toContain(
      "/api/v1/auth/backoffice/login"
    );
    expect(assets.BABYLOOP_SWAGGER_AUTH_SCRIPT).toContain(
      "/api/v1/auth/csrf"
    );
    expect(assets.BABYLOOP_SWAGGER_AUTH_SCRIPT).toContain(
      "/api/v1/auth/backoffice/csrf"
    );
    expect(assets.BABYLOOP_SWAGGER_AUTH_SCRIPT).toContain(
      'credentials: "include"'
    );
  });

  it("hides manually unusable cookie and CSRF authorize fields", async () => {
    const assets = await import(
      "../src/openapi/openapi-auth-ui-assets.js"
    );

    expect(assets.BABYLOOP_SWAGGER_AUTH_SCRIPT).toContain(
      "publiccookieauth"
    );
    expect(assets.BABYLOOP_SWAGGER_AUTH_SCRIPT).toContain(
      "backofficecookieauth"
    );
    expect(assets.BABYLOOP_SWAGGER_AUTH_SCRIPT).toContain(
      "refreshcookieauth"
    );
    expect(assets.BABYLOOP_SWAGGER_AUTH_SCRIPT).toContain(
      "csrfheader"
    );
  });

  it("styles lock icons, auth dialog and expanded operations", async () => {
    const assets = await import(
      "../src/openapi/openapi-auth-ui-assets.js"
    );

    expect(assets.BABYLOOP_SWAGGER_AUTH_CSS).toContain(
      ".authorization__btn svg"
    );
    expect(assets.BABYLOOP_SWAGGER_AUTH_CSS).toContain(
      ".babyloop-auth-modal-note"
    );
    expect(assets.BABYLOOP_SWAGGER_AUTH_CSS).toContain(
      ".opblock-section-header"
    );
    expect(assets.BABYLOOP_SWAGGER_AUTH_CSS).toContain(
      ".babyloop-swagger-session__form"
    );
  });
});
