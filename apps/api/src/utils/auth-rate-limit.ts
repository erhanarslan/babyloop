import { createHmac } from "node:crypto";

type AuthRateLimitKeyInput = {
  authSecret: string;
  body: unknown;
  clientIp: string;
  endpoint: string;
};

export function buildAuthRateLimitKey(input: AuthRateLimitKeyInput): string {
  const identityHash = createHmac("sha256", input.authSecret)
    .update(readRateLimitIdentity(input.body))
    .digest("hex");

  return `${input.clientIp}:${input.endpoint}:${identityHash}`;
}

function readRateLimitIdentity(body: unknown): string {
  if (!body || typeof body !== "object" || !("email" in body)) {
    return "anonymous";
  }

  const email = Reflect.get(body, "email");
  return typeof email === "string" ? email.trim().toLowerCase() : "anonymous";
}
