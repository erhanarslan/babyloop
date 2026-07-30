import { isIP } from "node:net";
import type { FastifyRequest } from "fastify";

export function resolveTrustedClientIp(
  request: Pick<FastifyRequest, "headers" | "ip">,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const environment = env.DEPLOY_ENVIRONMENT?.trim().toLowerCase();
  if (environment !== "production" && environment !== "staging") {
    return request.ip;
  }

  const header = request.headers["x-forwarded-for"];
  const values = (Array.isArray(header) ? header.join(",") : header ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  // Cloud Run appends the real client and Google frontend addresses. Taking the
  // penultimate hop ignores any attacker-controlled values prepended to the chain.
  const cloudRunClient = values.length >= 2 ? values.at(-2) : null;
  return cloudRunClient && isIP(cloudRunClient) ? cloudRunClient : request.ip;
}
