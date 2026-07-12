import { createHmac, timingSafeEqual } from "node:crypto";

type AccessTokenPayload = {
  exp: number;
  iat: number;
  profileId: string;
  sessionId: string;
  userId: string;
};

export type VerifiedAccessToken = {
  profileId: string;
  sessionId: string;
  userId: string;
};

export function signAccessToken(
  input: VerifiedAccessToken,
  options: {
    secret: string;
    ttlSeconds: number;
  }
): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: AccessTokenPayload = {
    exp: issuedAt + options.ttlSeconds,
    iat: issuedAt,
    profileId: input.profileId,
    sessionId: input.sessionId,
    userId: input.userId
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload, options.secret);

  return `${encodedPayload}.${signature}`;
}

export function verifyAccessToken(
  token: string,
  options: {
    secret: string;
  }
): VerifiedAccessToken | null {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  if (!safeEqual(signature, sign(encodedPayload, options.secret))) {
    return null;
  }

  const payload = parsePayload(encodedPayload);

  if (!payload || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return {
    profileId: payload.profileId,
    sessionId: payload.sessionId,
    userId: payload.userId
  };
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function parsePayload(encodedPayload: string): AccessTokenPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as unknown;

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      hasPayloadShape(parsed)
    ) {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}

function hasPayloadShape(value: object): value is AccessTokenPayload {
  return (
    "exp" in value &&
    "iat" in value &&
    "profileId" in value &&
    "sessionId" in value &&
    "userId" in value &&
    typeof value.exp === "number" &&
    typeof value.iat === "number" &&
    typeof value.profileId === "string" &&
    typeof value.sessionId === "string" &&
    typeof value.userId === "string"
  );
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
