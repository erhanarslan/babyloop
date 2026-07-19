import type { FastifyInstance } from "fastify";
import { createNotificationDeliveryCandidateLog } from "./notification-delivery-log.service.js";
import {
  evaluateNotificationDeliveryPolicy,
  type NotificationDeliveryCandidateKind,
  type NotificationDeliveryPolicyInput
} from "./notification-delivery-policy.service.js";
import { isNotificationPreferenceEnabledForDelivery } from "./notification-preferences.service.js";
import { isNotificationEmailProviderConfigured } from "./notification-email-config.service.js";

export type MarketplaceEmailNotificationKind = Extract<
  NotificationDeliveryCandidateKind,
  "message_received" | "listing_favorited"
>;

export type MarketplaceEmailCandidateResult = {
  status: "created" | "duplicate" | "provider_disabled" | "preference_disabled";
  deliveryLogId: string | null;
};

export function isMarketplaceEmailProviderConfigured(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return isNotificationEmailProviderConfigured(env);
}

export async function createMarketplaceEmailNotificationCandidate(
  app: FastifyInstance,
  input: {
    actionHref: string;
    kind: MarketplaceEmailNotificationKind;
    metadata: Record<string, string | number | boolean | null>;
    profileId: string;
    sourceId: string;
  },
  env: NodeJS.ProcessEnv = process.env
): Promise<MarketplaceEmailCandidateResult> {
  if (!isMarketplaceEmailProviderConfigured(env)) {
    return {
      status: "provider_disabled",
      deliveryLogId: null
    };
  }

  const preferenceSource = input.kind === "message_received" ? "messages" : "listing";
  const preferenceEnabled = await isNotificationPreferenceEnabledForDelivery(
    app,
    input.profileId,
    preferenceSource,
    "email"
  );

  if (!preferenceEnabled) {
    return {
      status: "preference_disabled",
      deliveryLogId: null
    };
  }

  const policyInput: NotificationDeliveryPolicyInput = {
    profileId: input.profileId,
    kind: input.kind,
    sourceType: input.kind === "message_received" ? "conversation" : "listing",
    sourceId: input.sourceId,
    channel: "email",
    actionHref: input.actionHref
  };
  const created = await createNotificationDeliveryCandidateLog(app, {
    profileId: input.profileId,
    policyInput,
    policy: evaluateNotificationDeliveryPolicy(policyInput, { deliveryEnabled: true }),
    metadata: {
      ...input.metadata,
      actionHref: input.actionHref
    }
  });

  return {
    status: created.created ? "created" : "duplicate",
    deliveryLogId: created.deliveryLogId
  };
}
