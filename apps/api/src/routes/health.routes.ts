import type { FastifyInstance } from "fastify";

type HealthResponse = {
  ok: true;
  service: "babyloop-api";
};

export function registerHealthRoutes(app: FastifyInstance): void {
  app.get<{ Reply: HealthResponse }>("/health", async () => ({
    ok: true,
    service: "babyloop-api"
  }));
}
