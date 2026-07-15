import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import type { FastifyInstance } from "fastify";
import {
  getPaymentProviderReadiness,
  validatePaymentWebhookRequest,
  type PaymentProviderReadiness
} from "../services/payment-simulation.service.js";

type PaymentReadinessResponse = ApiResponse<{
  readiness: PaymentProviderReadiness;
}>;

type PaymentWebhookResponse = ApiResponse<{
  accepted: boolean;
  processed: false;
  reason: string;
}>;

export function registerPaymentRoutes(app: FastifyInstance): void {
  app.get<{ Reply: PaymentReadinessResponse }>("/payments/readiness", async () => ({
    ok: true,
    data: {
      readiness: getPaymentProviderReadiness(process.env)
    }
  }));

  app.post<{ Body: unknown; Reply: PaymentWebhookResponse | ApiFailure }>(
    "/payments/webhooks/iyzico",
    async (request, reply) => {
      const validation = validatePaymentWebhookRequest({
        env: process.env,
        receivedSecret: request.headers["x-babyloop-payment-webhook-secret"]
      });

      if (!validation.accepted) {
        return reply.status(validation.statusCode).send({
          ok: false,
          error: {
            code: "PAYMENT_WEBHOOK_DISABLED",
            message: `Payment webhook rejected: ${validation.reason}.`
          }
        });
      }

      return reply.status(202).send({
        ok: true,
        data: {
          accepted: true,
          processed: false,
          reason: validation.reason
        }
      });
    }
  );
}
