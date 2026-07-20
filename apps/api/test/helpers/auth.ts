import { CURRENT_TERMS_VERSION } from "@babyloop/shared";
import { users } from "@babyloop/database/schema";
import { eq } from "drizzle-orm";
import type { TestApp } from "./app.js";

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
  app: TestApp,
  overrides: Partial<{
    displayName: string;
    email: string;
    locationCity: string;
    password: string;
    role: string;
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
      password,
      termsAccepted: true,
      termsVersion: CURRENT_TERMS_VERSION
    }
  });

  if (response.statusCode !== 201) {
    throw new Error(`User setup failed: ${response.statusCode} ${response.body}`);
  }

  const body = response.json<ApiSuccess<AuthPayload>>().data;

  if (overrides.role) {
    await app.db
      .update(users)
      .set({ role: overrides.role })
      .where(eq(users.id, body.user.id));

    body.user.role = overrides.role;
  }

  return body;
}

export async function loginUser(
  app: TestApp,
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