import { createHash, randomBytes } from "node:crypto";
import { loginApprovalChallenges, sessions, users } from "@babyloop/database/schema";
import type { ApiFailure, ApiResponse } from "@babyloop/shared";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { LoginApprovalPreferenceBody } from "../schemas/auth.schemas.js";
import { hashRefreshToken } from "../utils/refresh-token.js";
import { verifyPassword } from "../utils/password.js";
import { safePlainTextFallback } from "./text-safety.service.js";

const LOGIN_APPROVAL_TTL_SECONDS = 10 * 60;

type LoginApprovalChallengeStatus = "pending" | "approved" | "denied" | "expired";

export type LoginApprovalStatusPayload = {
  delivery: "in_app";
  method: "mobile_approval";
  mobileLoginApprovalEnabled: boolean;
};

export type LoginApprovalStatusResponse = ApiResponse<LoginApprovalStatusPayload>;

export type LoginApprovalPreferenceResponse = ApiResponse<LoginApprovalStatusPayload & {
  updated: true;
}>;

export type SafeLoginApprovalChallenge = {
  id: string;
  status: LoginApprovalChallengeStatus;
  deviceLabel: string;
  requestUserAgent: string | null;
  requestIpAddress: string | null;
  createdAt: string;
  expiresAt: string;
  resolvedAt: string | null;
};

export type LoginApprovalsResponse = ApiResponse<{
  approvals: SafeLoginApprovalChallenge[];
}>;

export type LoginApprovalActionResponse = ApiResponse<{
  approvalId: string;
  resolved: true;
  status: "approved" | "denied";
}>;

export type LoginApprovalChallengeCreation = {
  approvalToken: string;
  approval: SafeLoginApprovalChallenge;
};

export async function getLoginApprovalStatus(
  app: FastifyInstance,
  userId: string
): Promise<LoginApprovalStatusResponse> {
  const [user] = await app.db
    .select({
      mobileLoginApprovalEnabled: users.mobileLoginApprovalEnabled
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return buildLoginApprovalStatusResponse(Boolean(user?.mobileLoginApprovalEnabled));
}

export async function updateLoginApprovalPreference(
  app: FastifyInstance,
  userId: string,
  body: LoginApprovalPreferenceBody,
  enabled: boolean
): Promise<
  | { status: "ok"; response: LoginApprovalPreferenceResponse }
  | { status: "invalid"; response: ApiFailure }
> {
  const [user] = await app.db
    .select({
      passwordHash: users.passwordHash
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || !(await verifyPassword(body.currentPassword, user.passwordHash))) {
    return {
      status: "invalid",
      response: invalidCredentials()
    };
  }

  const [updated] = await app.db
    .update(users)
    .set({
      mobileLoginApprovalEnabled: enabled,
      updatedAt: new Date()
    })
    .where(eq(users.id, userId))
    .returning({
      mobileLoginApprovalEnabled: users.mobileLoginApprovalEnabled
    });

  return {
    status: "ok",
    response: buildLoginApprovalPreferenceResponse(Boolean(updated?.mobileLoginApprovalEnabled ?? enabled))
  };
}

export async function createLoginApprovalChallenge(
  app: FastifyInstance,
  userId: string,
  requestMeta: {
    ipAddress: string | null;
    userAgent: string | null;
  },
  now = new Date()
): Promise<LoginApprovalChallengeCreation> {
  const approvalToken = createLoginApprovalToken();
  const expiresAt = new Date(now.getTime() + LOGIN_APPROVAL_TTL_SECONDS * 1000);

  const [challenge] = await app.db
    .insert(loginApprovalChallenges)
    .values({
      approvalTokenHash: hashLoginApprovalToken(approvalToken),
      expiresAt,
      requestIpAddress: requestMeta.ipAddress,
      requestUserAgent: requestMeta.userAgent,
      status: "pending",
      userId
    })
    .returning({
      id: loginApprovalChallenges.id,
      status: loginApprovalChallenges.status,
      requestUserAgent: loginApprovalChallenges.requestUserAgent,
      requestIpAddress: loginApprovalChallenges.requestIpAddress,
      createdAt: loginApprovalChallenges.createdAt,
      expiresAt: loginApprovalChallenges.expiresAt,
      resolvedAt: loginApprovalChallenges.resolvedAt
    });

  if (!challenge) {
    throw new Error("Login approval challenge insert failed.");
  }

  return {
    approvalToken,
    approval: serializeLoginApprovalChallenge(challenge)
  };
}

export async function listPendingLoginApprovals(
  app: FastifyInstance,
  userId: string
): Promise<LoginApprovalsResponse> {
  const now = new Date();
  const rows = await app.db
    .select({
      id: loginApprovalChallenges.id,
      status: loginApprovalChallenges.status,
      requestUserAgent: loginApprovalChallenges.requestUserAgent,
      requestIpAddress: loginApprovalChallenges.requestIpAddress,
      createdAt: loginApprovalChallenges.createdAt,
      expiresAt: loginApprovalChallenges.expiresAt,
      resolvedAt: loginApprovalChallenges.resolvedAt
    })
    .from(loginApprovalChallenges)
    .where(and(
      eq(loginApprovalChallenges.userId, userId),
      eq(loginApprovalChallenges.status, "pending"),
      gt(loginApprovalChallenges.expiresAt, now)
    ))
    .orderBy(desc(loginApprovalChallenges.createdAt))
    .limit(20);

  return {
    ok: true,
    data: {
      approvals: rows.map(serializeLoginApprovalChallenge)
    }
  };
}

export async function approveLoginApprovalChallenge(
  app: FastifyInstance,
  userId: string,
  approvalId: string,
  currentRefreshToken: string | null
): Promise<
  | { status: "ok"; response: LoginApprovalActionResponse }
  | { status: "not_found"; response: ApiFailure }
> {
  return resolveLoginApprovalChallenge(app, {
    approvalId,
    currentRefreshToken,
    nextStatus: "approved",
    userId
  });
}

export async function denyLoginApprovalChallenge(
  app: FastifyInstance,
  userId: string,
  approvalId: string,
  currentRefreshToken: string | null
): Promise<
  | { status: "ok"; response: LoginApprovalActionResponse }
  | { status: "not_found"; response: ApiFailure }
> {
  return resolveLoginApprovalChallenge(app, {
    approvalId,
    currentRefreshToken,
    nextStatus: "denied",
    userId
  });
}

async function resolveLoginApprovalChallenge(
  app: FastifyInstance,
  input: {
    approvalId: string;
    currentRefreshToken: string | null;
    nextStatus: "approved" | "denied";
    userId: string;
  }
): Promise<
  | { status: "ok"; response: LoginApprovalActionResponse }
  | { status: "not_found"; response: ApiFailure }
> {
  if (!isUuid(input.approvalId)) {
    return {
      status: "not_found",
      response: loginApprovalNotFound()
    };
  }

  const now = new Date();
  const currentSessionId = await findCurrentSessionId(app, input.userId, input.currentRefreshToken, now);

  const [updated] = await app.db
    .update(loginApprovalChallenges)
    .set({
      approvedBySessionId: input.nextStatus === "approved" ? currentSessionId : null,
      resolvedAt: now,
      status: input.nextStatus,
      updatedAt: now
    })
    .where(and(
      eq(loginApprovalChallenges.id, input.approvalId),
      eq(loginApprovalChallenges.userId, input.userId),
      eq(loginApprovalChallenges.status, "pending"),
      gt(loginApprovalChallenges.expiresAt, now)
    ))
    .returning({
      id: loginApprovalChallenges.id,
      status: loginApprovalChallenges.status
    });

  if (!updated || (updated.status !== "approved" && updated.status !== "denied")) {
    return {
      status: "not_found",
      response: loginApprovalNotFound()
    };
  }

  return {
    status: "ok",
    response: {
      ok: true,
      data: {
        approvalId: updated.id,
        resolved: true,
        status: updated.status
      }
    }
  };
}

async function findCurrentSessionId(
  app: FastifyInstance,
  userId: string,
  currentRefreshToken: string | null,
  now: Date
): Promise<string | null> {
  if (!currentRefreshToken) {
    return null;
  }

  const [session] = await app.db
    .select({
      id: sessions.id
    })
    .from(sessions)
    .where(and(
      eq(sessions.userId, userId),
      eq(sessions.refreshTokenHash, hashRefreshToken(currentRefreshToken)),
      isNull(sessions.revokedAt),
      gt(sessions.expiresAt, now)
    ))
    .limit(1);

  return session?.id ?? null;
}

function buildLoginApprovalStatusResponse(enabled: boolean): LoginApprovalStatusResponse {
  return {
    ok: true,
    data: {
      delivery: "in_app",
      method: "mobile_approval",
      mobileLoginApprovalEnabled: enabled
    }
  };
}

function buildLoginApprovalPreferenceResponse(enabled: boolean): LoginApprovalPreferenceResponse {
  return {
    ok: true,
    data: {
      delivery: "in_app",
      method: "mobile_approval",
      mobileLoginApprovalEnabled: enabled,
      updated: true
    }
  };
}

function serializeLoginApprovalChallenge(row: {
  id: string;
  status: LoginApprovalChallengeStatus;
  requestUserAgent: string | null;
  requestIpAddress: string | null;
  createdAt: Date;
  expiresAt: Date;
  resolvedAt: Date | null;
}): SafeLoginApprovalChallenge {
  const requestUserAgent = sanitizeApprovalText(row.requestUserAgent, 180);
  const requestIpAddress = sanitizeApprovalText(row.requestIpAddress, 80);

  return {
    id: row.id,
    status: row.status,
    deviceLabel: buildDeviceLabel(requestUserAgent),
    requestUserAgent,
    requestIpAddress,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null
  };
}

function sanitizeApprovalText(value: string | null, maxLength: number): string | null {
  if (!value) {
    return null;
  }

  const sanitized = safePlainTextFallback(value, "").trim().slice(0, maxLength);

  return sanitized.length > 0 ? sanitized : null;
}

function buildDeviceLabel(userAgent: string | null): string {
  if (!userAgent) {
    return "Bilinmeyen cihaz";
  }

  const value = userAgent.toLowerCase();

  if (value.includes("android")) {
    return "Android cihaz";
  }

  if (value.includes("iphone") || value.includes("ipad") || value.includes("ios")) {
    return "iOS cihaz";
  }

  if (value.includes("mac")) {
    return "Mac tarayıcı";
  }

  if (value.includes("windows")) {
    return "Windows tarayıcı";
  }

  return "Web oturumu";
}

function createLoginApprovalToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashLoginApprovalToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function invalidCredentials(): ApiFailure {
  return {
    ok: false,
    error: {
      code: "INVALID_CREDENTIALS",
      message: "Email or password is incorrect."
    }
  };
}

function loginApprovalNotFound(): ApiFailure {
  return {
    ok: false,
    error: {
      code: "LOGIN_APPROVAL_NOT_FOUND",
      message: "Login approval request was not found."
    }
  };
}
