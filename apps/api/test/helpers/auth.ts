import type { FastifyInstance } from "fastify";

let sequence = 0;

export type AuthPayload = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
  profile: {
    id: string;
    displayName: string;
    locationCity: string | null;
  };
};

type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export function authHeader(token: string) {
  return {
    authorization: `Bearer ${token}`
  };
}

export async function createUser(
  app: FastifyInstance,
  overrides: Partial<{
    displayName: string;
    email: string;
    locationCity: string;
    password: string;
  }> = {}
): Promise<AuthPayload> {
  const email = overrides.email ?? `user-${nextId()}@babyloop.test`;
  const password = overrides.password ?? "Password123!";
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: {
      displayName: overrides.displayName ?? `User ${sequence}`,
      email,
      locationCity: overrides.locationCity ?? "Istanbul",
      password
    }
  });

  if (response.statusCode !== 201) {
    throw new Error(`User setup failed: ${response.statusCode} ${response.body}`);
  }

  return response.json<ApiSuccess<AuthPayload>>().data;
}

export async function loginUser(
  app: FastifyInstance,
  email: string,
  password = "Password123!"
): Promise<AuthPayload> {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: {
      email,
      password
    }
  });

  if (response.statusCode !== 200) {
    throw new Error(`Login setup failed: ${response.statusCode} ${response.body}`);
  }

  return response.json<ApiSuccess<AuthPayload>>().data;
}

function nextId(): number {
  sequence += 1;
  return sequence;
}
