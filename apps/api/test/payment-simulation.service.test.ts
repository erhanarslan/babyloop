import { describe, expect, it } from "vitest";
import {
  buildMockIyzicoPaymentSimulation,
  calculateBabyLoopCommission,
  getPaymentProviderReadiness,
  validatePaymentWebhookRequest
} from "../src/services/payment-simulation.service.js";

describe("payment simulation service", () => {
  it("calculates BabyLoop commission and seller payout in minor-unit safe money", () => {
    expect(calculateBabyLoopCommission({ totalAmount: "1250.00" })).toEqual({
      commission: {
        amount: "25.00",
        currency: "TRY",
        rateBps: 200,
        fixedAmount: "0.00"
      },
      sellerPayout: {
        amount: "1225.00",
        currency: "TRY"
      }
    });

    expect(calculateBabyLoopCommission({ totalAmount: "100.00", rateBps: 250, fixedAmount: "1.50" })).toEqual({
      commission: {
        amount: "4.00",
        currency: "TRY",
        rateBps: 250,
        fixedAmount: "1.50"
      },
      sellerPayout: {
        amount: "96.00",
        currency: "TRY"
      }
    });
  });

  it("builds a mock iyzico attempt without real money movement or secret exposure", () => {
    const simulation = buildMockIyzicoPaymentSimulation({
      amount: "1250.00",
      providerAttemptId: "mock-iyzico-test",
      now: new Date("2030-01-02T10:00:00.000Z")
    });

    expect(simulation).toMatchObject({
      provider: {
        name: "mock_iyzico",
        mode: "simulation",
        livePayment: false,
        realMoneyMovement: false
      },
      paymentAttempt: {
        id: "mock-iyzico-test",
        provider: "mock_iyzico",
        providerMode: "simulation",
        status: "succeeded",
        livePayment: false,
        realMoneyMovement: false,
        capturedAmount: "1250.00",
        currency: "TRY",
        createdAt: "2030-01-02T10:00:00.000Z"
      },
      boundary: {
        realPaymentEnabled: false,
        realMoneyMovement: false,
        reason: "company_legal_and_iyzico_live_not_ready"
      }
    });

    expect(JSON.stringify(simulation)).not.toMatch(/apiKey|secret|cardNumber|cvv|authorization|cookie/iu);
  });

  it("keeps Iyzico live provider blocked even when live env is requested", () => {
    const readiness = getPaymentProviderReadiness({
      PAYMENT_PROVIDER: "iyzico",
      PAYMENT_LIVE_ENABLED: "true",
      PAYMENT_LEGAL_ENTITY_READY: "true",
      IYZICO_API_KEY: "secret-api-key",
      IYZICO_SECRET_KEY: "secret-key",
      IYZICO_WEBHOOK_SECRET: "webhook-secret"
    } as NodeJS.ProcessEnv);

    expect(readiness).toMatchObject({
      provider: "iyzico",
      providerMode: "blocked_live",
      liveRequested: true,
      livePaymentEnabled: false,
      realMoneyMovement: false,
      readyForLive: false
    });
    expect(readiness.blockedReasons).toContain("live_payment_requested_but_guarded");
    expect(JSON.stringify(readiness)).not.toMatch(/secret-api-key|secret-key|webhook-secret/iu);
  });

  it("fails closed for payment webhooks unless the future live gate is explicitly implemented", () => {
    expect(validatePaymentWebhookRequest({ receivedSecret: undefined, env: {} as NodeJS.ProcessEnv })).toEqual({
      accepted: false,
      statusCode: 401,
      reason: "missing_webhook_secret"
    });

    expect(
      validatePaymentWebhookRequest({
        receivedSecret: "bad",
        env: { IYZICO_WEBHOOK_SECRET: "good" } as NodeJS.ProcessEnv
      })
    ).toEqual({
      accepted: false,
      statusCode: 401,
      reason: "invalid_webhook_secret"
    });

    expect(
      validatePaymentWebhookRequest({
        receivedSecret: "good",
        env: {
          PAYMENT_PROVIDER: "iyzico",
          PAYMENT_LIVE_ENABLED: "true",
          PAYMENT_LEGAL_ENTITY_READY: "true",
          IYZICO_API_KEY: "api",
          IYZICO_SECRET_KEY: "secret",
          IYZICO_WEBHOOK_SECRET: "good"
        } as NodeJS.ProcessEnv
      })
    ).toEqual({
      accepted: false,
      statusCode: 403,
      reason: "payment_live_disabled"
    });
  });
});
