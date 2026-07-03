import { notifications } from "@babyloop/database/schema";
import { and, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import {
  listChildProfiles,
  listLifecycleRecommendations,
  type ChildProfileResponse,
  type LifecycleRecommendationResponse
} from "./child-profiles.service.js";
import {
  createNotification,
  type NotificationResponse
} from "./notifications.service.js";
import { safePlainTextFallback } from "./text-safety.service.js";

export type ChildLifecycleNotificationGenerationResponse = {
  createdCount: number;
  skippedCount: number;
  notifications: NotificationResponse[];
  deliveryChannel: "in_app";
  draftOnly: false;
  note: string;
};

type LifecycleRecommendationItem = LifecycleRecommendationResponse["recommendations"][number];

const CHILD_LIFECYCLE_NOTIFICATION_SOURCE = "child_lifecycle";
const CHILD_LIFECYCLE_NOTIFICATION_KIND = "child_lifecycle_recommendation";

export async function generateChildLifecycleNotifications(
  app: FastifyInstance,
  profileId: string
): Promise<ChildLifecycleNotificationGenerationResponse> {
  const [childProfiles, lifecycleGroups] = await Promise.all([
    listChildProfiles(app, profileId),
    listLifecycleRecommendations(app, profileId)
  ]);

  const childProfilesById = new Map(childProfiles.map((childProfile) => [childProfile.id, childProfile]));
  const createdNotifications: NotificationResponse[] = [];
  let skippedCount = 0;

  for (const group of lifecycleGroups) {
    const childProfile = childProfilesById.get(group.childProfileId);

    if (!childProfile || !shouldGenerateForChildProfile(childProfile)) {
      skippedCount += group.recommendations.length;
      continue;
    }

    for (const recommendation of group.recommendations.slice(0, 2)) {
      const dedupeKey = buildChildLifecycleDedupeKey(childProfile, recommendation);
      const alreadyCreated = await hasExistingChildLifecycleNotification(
        app,
        profileId,
        childProfile.id,
        dedupeKey
      );

      if (alreadyCreated) {
        skippedCount += 1;
        continue;
      }

      const notification = await createNotification(app, {
        recipientProfileId: profileId,
        actorProfileId: null,
        type: "system",
        title: buildNotificationTitle(childProfile, recommendation),
        body: buildNotificationBody(group.ageBand, recommendation),
        entityType: "child_profile",
        entityId: childProfile.id,
        metadata: {
          source: CHILD_LIFECYCLE_NOTIFICATION_SOURCE,
          kind: CHILD_LIFECYCLE_NOTIFICATION_KIND,
          dedupeKey,
          childProfileId: childProfile.id,
          ageBand: group.ageBand,
          cadence: childProfile.notificationCadence,
          categoryId: recommendation.categoryId,
          categorySlug: recommendation.categorySlug,
          reasonCode: recommendation.reasonCode,
          actionHref: `/browse?${new URLSearchParams({
            categoryId: recommendation.categoryId,
            sort: "newest"
          }).toString()}`
        }
      });

      if (notification) {
        createdNotifications.push(notification);
      } else {
        skippedCount += 1;
      }
    }
  }

  return {
    createdCount: createdNotifications.length,
    skippedCount,
    notifications: createdNotifications,
    deliveryChannel: "in_app",
    draftOnly: false,
    note: "Bu endpoint yalnızca uygulama içi BabyLoop bildirimleri üretir. Email, push veya n8n gönderimi yapmaz."
  };
}

function shouldGenerateForChildProfile(childProfile: ChildProfileResponse): boolean {
  return childProfile.isActive && childProfile.notificationCadence !== "off";
}

async function hasExistingChildLifecycleNotification(
  app: FastifyInstance,
  profileId: string,
  childProfileId: string,
  dedupeKey: string
): Promise<boolean> {
  const [existing] = await app.db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(
      eq(notifications.recipientProfileId, profileId),
      eq(notifications.type, "system"),
      eq(notifications.entityType, "child_profile"),
      eq(notifications.entityId, childProfileId),
      sql`${notifications.metadata} @> ${JSON.stringify({
        source: CHILD_LIFECYCLE_NOTIFICATION_SOURCE,
        dedupeKey
      })}::jsonb`
    ))
    .limit(1);

  return Boolean(existing);
}

function buildChildLifecycleDedupeKey(
  childProfile: ChildProfileResponse,
  recommendation: LifecycleRecommendationItem
): string {
  return [
    CHILD_LIFECYCLE_NOTIFICATION_SOURCE,
    childProfile.id,
    childProfile.ageBand,
    childProfile.notificationCadence,
    recommendation.categoryId,
    recommendation.reasonCode
  ].join(":");
}

function buildNotificationTitle(
  childProfile: ChildProfileResponse,
  recommendation: LifecycleRecommendationItem
): string {
  const childLabel = safePlainTextFallback(childProfile.label, "Çocuğun", {
    maxLength: 80,
    minLength: 1
  });
  const categoryName = safePlainTextFallback(recommendation.categoryName, "ilgili ürünler", {
    maxLength: 120,
    minLength: 1
  });

  return `${childLabel} için ${categoryName} önerileri`;
}

function buildNotificationBody(
  ageBand: string,
  recommendation: LifecycleRecommendationItem
): string {
  const categoryName = safePlainTextFallback(recommendation.categoryName, "ilgili ürünler", {
    maxLength: 120,
    minLength: 1
  });

  return `${formatAgeBand(ageBand)} döneminde ${categoryName} aramalarını takip etmek pratik olabilir. Bu bir sağlık, tedavi, diyet veya tanı önerisi değildir.`;
}

function formatAgeBand(ageBand: string): string {
  const labels: Record<string, string> = {
    expecting: "Hazırlık",
    newborn_0_3: "0-3 ay",
    infant_3_6: "3-6 ay",
    infant_6_12: "6-12 ay",
    toddler_12_24: "12-24 ay",
    preschool_24_36: "24-36 ay",
    child_3_plus: "3 yaş ve üzeri"
  };

  return labels[ageBand] ?? "Yaş dönemi";
}
