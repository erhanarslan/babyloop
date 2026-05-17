import type { FastifyInstance, RouteShorthandOptions } from "fastify";
import { loginBodySchema, registerBodySchema } from "../schemas/auth.schemas.js";
import { requireCurrentUser } from "../services/auth-context.service.js";
import {
  attachAccessToken,
  buildAuthMeResponse,
  invalidAuthRequest,
  loginUser,
  registerUser,
  type AuthMeResponse,
  type AuthResponse,
  type AuthTokenOptions
} from "../services/auth.service.js";

export function registerAuthRoutes(app: FastifyInstance, options: AuthTokenOptions): void {
  app.post<{ Body: unknown; Reply: AuthResponse }>(
    "/auth/register",
    authRateLimitOptions(options),
    async (request, reply) => {
      const parsedBody = registerBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send(invalidAuthRequest());
      }

      const result = await registerUser(app, parsedBody.data);

      if (result.status === "duplicate") {
        return reply.status(409).send(result.response);
      }

      return reply.status(201).send(attachAccessToken(result.response, options));
    }
  );

  app.post<{ Body: unknown; Reply: AuthResponse }>(
    "/auth/login",
    authRateLimitOptions(options),
    async (request, reply) => {
      const parsedBody = loginBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send(invalidAuthRequest());
      }

      const result = await loginUser(app, parsedBody.data);

      if (result.status === "invalid") {
        return reply.status(401).send(result.response);
      }

      return attachAccessToken(result.response, options);
    }
  );

  app.get<{ Reply: AuthMeResponse }>("/auth/me", async (request, reply) => {
    const currentUser = await requireCurrentUser(app, request, reply);

    if (!currentUser) {
      return reply;
    }

    return buildAuthMeResponse(currentUser);
  });
}

function authRateLimitOptions(options: AuthTokenOptions): RouteShorthandOptions {
  return {
    config: {
      rateLimit: {
        max: options.authRateLimitMax,
        timeWindow: options.authRateLimitWindowSeconds * 1000
      }
    }
  };
}
