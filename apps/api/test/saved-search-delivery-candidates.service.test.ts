import { describe, expect, it } from "vitest";
import {
  buildSavedSearchDeliveryCandidate,
  buildSavedSearchDeliveryPolicyInput,
  buildSavedSearchDeliverySourceId
} from "../src/services/saved-search-delivery-candidates.service.js";

const savedSearch = {
  id: "saved-search-1",
  name: "Puset alarmı parent@example.com accessToken",
  queryText: "puset",
  categoryId: "category-1",
  listingType: "sale",
  condition: "good",
  priceMin: "1000",
  priceMax: "5000",
  hasImages: true
};

const listing = {
  id: "listing-1",
  categoryId: "category-1",
  categoryName: "Bebek Arabaları",
  title: "Temiz puset parent@example.com refreshToken",
  priceAmount: "2500",
  currency: "TRY",
  listingType: "sale",
  condition: "good"
};

describe("saved-search delivery candidates", () => {
  it("builds a draft-only saved-search candidate without enabling delivery", () => {
    const candidate = buildSavedSearchDeliveryCandidate({
      profileId: "profile-1",
      savedSearch,
      listing,
      now: new Date("2026-07-05T00:00:00.000Z")
    });

    expect(candidate).toMatchObject({
      kind: "saved_search",
      sourceType: "saved_search",
      sourceId: "saved-search-1:listing-1",
      profileId: "profile-1",
      savedSearchId: "saved-search-1",
      listingId: "listing-1",
      channel: "in_app",
      status: "candidate",
      deliveryAllowed: false,
      draftOnly: true,
      canWriteLog: true,
      blockedReason: null
    });
    expect(candidate.actionHref).toBe("/listings/listing-1?savedSearchId=saved-search-1");
    expect(candidate.log).toMatchObject({
      kind: "saved_search",
      sourceType: "saved_search",
      sourceId: "saved-search-1:listing-1",
      channel: "in_app",
      status: "candidate",
      deliveryAllowed: false,
      draftOnly: true,
      frequencyWindowHours: 24
    });
    expect(candidate.log.blockedReasons).toContain("delivery_disabled");
    expect(candidate.log.blockedReasons).toContain("delivery_log_required");
    expect(candidate.note).toContain("email, push veya n8n gönderimi yapmaz");
    expect(JSON.stringify(candidate)).not.toMatch(/parent@example.com|accessToken|refreshToken|passwordHash|otpCode|cookie|authorization|sendPush|sendEmail|n8n hook/iu);
  });

  it("uses stable policy input for saved-search/listing idempotency", () => {
    const policyInput = buildSavedSearchDeliveryPolicyInput({
      profileId: "profile-1",
      savedSearch,
      listing
    });

    expect(policyInput).toEqual({
      profileId: "profile-1",
      kind: "saved_search",
      sourceType: "saved_search",
      sourceId: "saved-search-1:listing-1",
      channel: "in_app",
      actionHref: "/listings/listing-1?savedSearchId=saved-search-1"
    });
  });

  it("blocks duplicate saved-search candidates inside the frequency window", () => {
    const candidate = buildSavedSearchDeliveryCandidate({
      profileId: "profile-1",
      savedSearch,
      listing,
      lastCandidateCreatedAt: "2026-07-05T00:00:00.000Z",
      now: new Date("2026-07-05T10:00:00.000Z")
    });

    expect(candidate).toMatchObject({
      status: "blocked",
      canWriteLog: false,
      blockedReason: "frequency_window_active"
    });
    expect(candidate.log.status).toBe("blocked");
  });

  it("supports email_draft candidates without sending email", () => {
    const candidate = buildSavedSearchDeliveryCandidate({
      profileId: "profile-1",
      savedSearch,
      listing,
      channel: "email_draft"
    });

    expect(candidate.channel).toBe("email_draft");
    expect(candidate.log.channel).toBe("email_draft");
    expect(candidate.deliveryAllowed).toBe(false);
    expect(candidate.draftOnly).toBe(true);
    expect(JSON.stringify(candidate)).not.toMatch(/sent|sendEmail|EMAIL_SEND_ENABLED=true|push gönderildi|n8n çalıştı/iu);
  });

  it("creates a stable source id from saved search and listing ids", () => {
    expect(buildSavedSearchDeliverySourceId("saved-1", "listing-2")).toBe("saved-1:listing-2");
  });
});
