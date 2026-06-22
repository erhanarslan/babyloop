import type { FastifyInstance } from "fastify";
import {
  listChildProfiles,
  listLifecycleRecommendations
} from "./child-profiles.service.js";
import { listSavedSearches } from "./saved-searches.service.js";

export type NotificationDeliveryDraftKind = "child_lifecycle" | "saved_search";

export type NotificationDeliveryDraft = {
  id: string;
  kind: NotificationDeliveryDraftKind;
  title: string;
  body: string;
  channel: "in_app" | "email_draft";
  status: "draft_only";
  source: {
    type: "child_profile" | "saved_search";
    id: string;
    label: string;
  };
  action: {
    label: string;
    href: string;
  };
  reason: string;
};

export type NotificationDeliveryDraftsResponse = {
  drafts: NotificationDeliveryDraft[];
  summary: {
    total: number;
    childLifecycle: number;
    savedSearch: number;
    draftOnly: true;
  };
  note: string;
};

export async function listNotificationDeliveryDrafts(
  app: FastifyInstance,
  profileId: string
): Promise<NotificationDeliveryDraftsResponse> {
  const [childProfiles, lifecycleGroups, savedSearches] = await Promise.all([
    listChildProfiles(app, profileId),
    listLifecycleRecommendations(app, profileId),
    listSavedSearches(app, profileId)
  ]);

  const childDrafts = lifecycleGroups.flatMap((group) => {
    const childProfile = childProfiles.find((item) => item.id === group.childProfileId);

    if (!childProfile || !childProfile.isActive || childProfile.notificationCadence === "off") {
      return [];
    }

    return group.recommendations.slice(0, 2).map((recommendation): NotificationDeliveryDraft => ({
      id: `child-${childProfile.id}-${recommendation.categoryId}-${recommendation.reasonCode}`,
      kind: "child_lifecycle",
      title: `${safeLabel(childProfile.label)} için ${recommendation.categoryName}`,
      body: `${formatAgeBand(group.ageBand)} döneminde ${recommendation.categoryName} aramalarını takip etmek pratik olabilir.`,
      channel: "email_draft",
      status: "draft_only",
      source: {
        type: "child_profile",
        id: childProfile.id,
        label: safeLabel(childProfile.label)
      },
      action: {
        label: "İlanlara bak",
        href: `/browse?${new URLSearchParams({
          categoryId: recommendation.categoryId,
          sort: "newest"
        }).toString()}`
      },
      reason: recommendation.whyNow
    }));
  });

  const savedSearchDrafts = savedSearches
    .filter((savedSearch) => savedSearch.notificationsEnabled)
    .slice(0, 10)
    .map((savedSearch): NotificationDeliveryDraft => ({
      id: `saved-search-${savedSearch.id}`,
      kind: "saved_search",
      title: `${savedSearch.name} için yeni eşleşme kontrolü`,
      body: `"${savedSearch.q || savedSearch.name}" aramana uygun yeni ilanlar bulunduğunda bildirim taslağı üretilebilir.`,
      channel: "in_app",
      status: "draft_only",
      source: {
        type: "saved_search",
        id: savedSearch.id,
        label: savedSearch.name
      },
      action: {
        label: "Aramayı aç",
        href: buildSavedSearchHref(savedSearch)
      },
      reason: "Kayıtlı arama bildirim tercihi açık olduğu için eşleşme kontrolüne adaydır."
    }));

  const drafts = [...childDrafts, ...savedSearchDrafts];

  return {
    drafts,
    summary: {
      total: drafts.length,
      childLifecycle: childDrafts.length,
      savedSearch: savedSearchDrafts.length,
      draftOnly: true
    },
    note: "Bu liste sadece bildirim taslağıdır. BabyLoop bu endpoint ile email, push, n8n veya in-app bildirim göndermez."
  };
}

function buildSavedSearchHref(savedSearch: Awaited<ReturnType<typeof listSavedSearches>>[number]): string {
  const params = new URLSearchParams();

  appendParam(params, "q", savedSearch.q);
  appendParam(params, "categoryId", savedSearch.categoryId ?? "");
  appendParam(params, "listingType", savedSearch.listingType ?? "");
  appendParam(params, "condition", savedSearch.condition ?? "");
  appendParam(params, "priceMin", savedSearch.priceMin ?? "");
  appendParam(params, "priceMax", savedSearch.priceMax ?? "");
  appendParam(params, "hasImages", savedSearch.hasImages ? "true" : "");
  appendParam(params, "sort", savedSearch.sort);

  const query = params.toString();

  return query ? `/browse?${query}` : "/browse";
}

function appendParam(params: URLSearchParams, key: string, value: string): void {
  if (value.trim().length > 0) {
    params.set(key, value);
  }
}

function formatAgeBand(ageBand: string): string {
  const labels: Record<string, string> = {
    expecting: "Doğum öncesi",
    newborn_0_3: "0-3 ay",
    infant_3_6: "3-6 ay",
    infant_6_12: "6-12 ay",
    toddler_12_24: "12-24 ay",
    preschool_24_36: "24-36 ay",
    child_3_plus: "3 yaş ve üzeri"
  };

  return labels[ageBand] ?? "Yaş dönemi";
}

function safeLabel(label: string): string {
  const normalized = label.replace(/\s+/gu, " ").trim();

  return normalized.length > 0 ? normalized.slice(0, 40) : "Çocuğum";
}
