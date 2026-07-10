import type { FastifyInstance } from "fastify";
import {
  createNotificationDeliveryCandidateLog
} from "./notification-delivery-log.service.js";
import {
  evaluateNotificationDeliveryPolicy,
  type NotificationDeliveryPolicyInput
} from "./notification-delivery-policy.service.js";
import {
  executeNotificationProviderDelivery,
  type NotificationProviderExecutionResult
} from "./notification-provider-execution.service.js";
import type { SafeLoginApprovalChallenge } from "./login-approval.service.js";

export type LoginApprovalPushCandidateResult = {
  channel: "push";
  status: "created" | "duplicate";
  idempotencyKey: string;
  deliveryLogId: string | null;
  dispatch: NotificationProviderExecutionResult | null;
};

export function isLoginApprovalPushProviderConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const pushEnabled = readBoolean(env.NOTIFICATION_PUSH_ENABLED);
  const provider = (env.PUSH_PROVIDER ?? "expo").trim().toLowerCase();
  const accessToken = env.EXPO_ACCESS_TOKEN?.trim();

  return pushEnabled && provider === "expo" && Boolean(accessToken);
}

export async function createLoginApprovalPushCandidateLog(
  app: FastifyInstance,
  input: {
    profileId: string;
    approval: SafeLoginApprovalChallenge;
    now?: Date;
  }
): Promise<LoginApprovalPushCandidateResult> {
  const actionHref = "/account/security?section=login-approvals";
  const policyInput: NotificationDeliveryPolicyInput = {
    profileId: input.profileId,
    kind: "security",
    sourceType: "login_approval",
    sourceId: input.approval.id,
    channel: "push",
    actionHref
  };
  const policy = evaluateNotificationDeliveryPolicy(policyInput);
  const createInput: Parameters<typeof createNotificationDeliveryCandidateLog>[1] = {
    profileId: input.profileId,
    policyInput,
    policy,
    metadata: {
      source: "security",
      kind: "web_login_mobile_approval",
      approvalId: input.approval.id,
      deviceLabel: input.approval.deviceLabel,
      actionHref
    }
  };

  if (input.now !== undefined) {
    createInput.now = input.now;
  }

  const result = await createNotificationDeliveryCandidateLog(app, createInput);
  const shouldDispatch = result.created && result.deliveryLogId && isLoginApprovalPushProviderConfigured();
  const dispatch = shouldDispatch
    ? await executeNotificationProviderDelivery(app, result.deliveryLogId!, {
        now: input.now
      })
    : null;

  return {
    channel: "push",
    status: result.created ? "created" : "duplicate",
    idempotencyKey: result.idempotencyKey,
    deliveryLogId: result.deliveryLogId,
    dispatch
  };
}

function readBoolean(value: string | undefined): boolean {
  return value === "1" || value?.trim().toLowerCase() === "true";
}
