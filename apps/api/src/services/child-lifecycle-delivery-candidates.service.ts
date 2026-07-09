import type { FastifyInstance } from "fastify";
import type {
  ChildProfileResponse,
  LifecycleRecommendationResponse
} from "./child-profiles.service.js";
import {
  createNotificationDeliveryCandidateLog
} from "./notification-delivery-log.service.js";
import {
  evaluateNotificationDeliveryPolicy,
  type NotificationDeliveryPolicyInput
} from "./notification-delivery-policy.service.js";

export type ChildLifecycleDeliveryChannel = Extract<
  NotificationDeliveryPolicyInput["channel"],
  "email" | "push" | "n8n"
>;

export type ChildLifecycleDeliveryCandidateResult = {
  channel: ChildLifecycleDeliveryChannel;
  status: "created" | "duplicate";
  idempotencyKey: string;
};

type LifecycleRecommendationItem = LifecycleRecommendationResponse["recommendations"][number];

export type CreateChildLifecycleDeliveryCandidateInput = {
  profileId: string;
  childProfile: ChildProfileResponse;
  recommendation: LifecycleRecommendationItem;
  channel: ChildLifecycleDeliveryChannel;
  dedupeKey: string;
  now?: Date;
};

export async function createChildLifecycleDeliveryCandidateLog(
  app: FastifyInstance,
  input: CreateChildLifecycleDeliveryCandidateInput
): Promise<ChildLifecycleDeliveryCandidateResult> {
  const actionHref = buildChildLifecycleActionHref(input.recommendation);
  const policyInput = buildChildLifecycleDeliveryPolicyInput(input, actionHref);
  const policy = evaluateNotificationDeliveryPolicy(policyInput);
  const createInput: Parameters<typeof createNotificationDeliveryCandidateLog>[1] = {
    profileId: input.profileId,
    policyInput,
    policy,
    metadata: {
      source: "child_lifecycle",
      kind: "child_lifecycle_recommendation",
      dedupeKey: input.dedupeKey,
      childProfileId: input.childProfile.id,
      childLabel: input.childProfile.label,
      ageBand: input.childProfile.ageBand,
      cadence: input.childProfile.notificationCadence,
      categoryId: input.recommendation.categoryId,
      categorySlug: input.recommendation.categorySlug,
      categoryName: input.recommendation.categoryName,
      reasonCode: input.recommendation.reasonCode,
      actionHref
    }
  };

  if (input.now !== undefined) {
    createInput.now = input.now;
  }

  const result = await createNotificationDeliveryCandidateLog(app, createInput);

  return {
    channel: input.channel,
    status: result.created ? "created" : "duplicate",
    idempotencyKey: result.idempotencyKey
  };
}

function buildChildLifecycleDeliveryPolicyInput(
  input: CreateChildLifecycleDeliveryCandidateInput,
  actionHref: string
): NotificationDeliveryPolicyInput {
  return {
    profileId: input.profileId,
    kind: "child_lifecycle",
    sourceType: "child_profile",
    sourceId: buildChildLifecycleSourceId(input),
    channel: input.channel,
    actionHref,
    cadence: input.childProfile.notificationCadence
  };
}

function buildChildLifecycleSourceId(input: CreateChildLifecycleDeliveryCandidateInput): string {
  return [
    input.childProfile.id,
    input.recommendation.categoryId,
    input.recommendation.reasonCode
  ].join(":");
}

function buildChildLifecycleActionHref(recommendation: LifecycleRecommendationItem): string {
  const params = new URLSearchParams({
    categoryId: recommendation.categoryId,
    sort: "newest"
  });

  return `/browse?${params.toString()}`;
}
