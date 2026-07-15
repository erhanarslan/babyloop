import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { resetTestDatabase } from "./helpers/db.js";

describe("payment readiness routes", () => {
  const originalEnv = {
    IYZICO_API_KEY: process.env.IYZICO_API_KEY,
    IYZICO_SECRET_KEY: process.env.IYZICO_SECRET_KEY,
    IYZICO_WEBHOOK_SECRET: process.env.IYZICO_WEBHOOK_SECRET,
    PAYMENT_LEGAL_ENTITY_READY: process.env.PAYMENT_LEGAL_ENTITY_READY,
    PAYMENT_LIVE_ENABLED: process.env.PAYMENT_LIVE_ENABLED,
    PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER
  };

  let app: TestApp;

  beforeEach(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterEach(async () => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    await app.close();
  });

  it("returns redacted payment readiness while keeping live payment disabled", async () => {
    process.env.PAYMENT_PROVIDER = "iyzico";
    process.env.PAYMENT_LIVE_ENABLED = "true";
    process.env.IYZICO_API_KEY = "secret-api-key";
    process.env.IYZICO_SECRET_KEY = "secret-key";
    process.env.IYZICO_WEBHOOK_SECRET = "secret-webhook";

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/payments/readiness"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.readiness).toMatchObject({
      provider: "iyzico",
      providerMode: "blocked_live",
      liveRequested: true,
      livePaymentEnabled: false,
      realMoneyMovement: false,
      readyForLive: false
    });
    expect(JSON.stringify(response.json())).not.toMatch(/secret-api-key|secret-key|secret-webhook|cardNumber|cvv/iu);
  });

  it("fails closed for Iyzico webhook skeleton", async () => {
    process.env.PAYMENT_PROVIDER = "iyzico";
    process.env.PAYMENT_LIVE_ENABLED = "true";
    process.env.PAYMENT_LEGAL_ENTITY_READY = "true";
    process.env.IYZICO_API_KEY = "secret-api-key";
    process.env.IYZICO_SECRET_KEY = "secret-key";
    process.env.IYZICO_WEBHOOK_SECRET = "secret-webhook";

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/payments/webhooks/iyzico",
      headers: {
        "x-babyloop-payment-webhook-secret": "secret-webhook"
      },
      payload: {
        paymentId: "provider-payment-id"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "PAYMENT_WEBHOOK_DISABLED"
      }
    });
    expect(JSON.stringify(response.json())).not.toMatch(/secret-webhook|secret-key|secret-api-key|provider-payment-id/iu);
  });
});
