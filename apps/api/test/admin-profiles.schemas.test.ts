import { describe, expect, it } from "vitest";
import {
  adminProfileDetailResponseSchema,
  adminProfileParamsSchema,
  adminProfilesQuerySchema,
  adminProfilesResponseSchema
} from "../src/schemas/admin-profiles.schemas.js";

describe("admin profiles schemas", () => {
  it("accepts safe profile directory filters", () => {
    const parsed = adminProfilesQuerySchema.safeParse({
      safetyStatus: "restricted",
      riskLevel: "high",
      q: "Parent",
      sort: "risk_desc",
      limit: "25"
    });

    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.limit).toBe(25);
      expect(parsed.data.q).toBe("Parent");
    }
  });

  it("rejects unsafe profile directory filters", () => {
    expect(adminProfilesQuerySchema.safeParse({ safetyStatus: "banned" }).success).toBe(false);
    expect(adminProfilesQuerySchema.safeParse({ riskLevel: "severe" }).success).toBe(false);
    expect(adminProfilesQuerySchema.safeParse({ sort: "email" }).success).toBe(false);
    expect(adminProfilesQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(adminProfilesQuerySchema.safeParse({ q: "" }).success).toBe(false);
  });

  it("accepts safe profile directory response data", () => {
    const parsed = adminProfilesResponseSchema.safeParse({
      profiles: [
        {
          profileId: "00000000-0000-4000-8000-000000000001",
          displayName: "Safe Parent",
          locationCity: "Istanbul",
          safetyStatus: "restricted",
          createdAt: "2026-06-12T12:00:00.000Z",
          updatedAt: "2026-06-12T12:00:00.000Z",
          listingCount: 3,
          trustSnapshot: {
            profileId: "00000000-0000-4000-8000-000000000001",
            trustScore: 64,
            riskScore: 36,
            riskLevel: "medium",
            safetyStatus: "restricted",
            openCaseCount: 1,
            totalCaseCount: 2,
            recentReportCount: 1,
            recentEnforcementCount: 1,
            sensitiveAccessCount: 0,
            aiSummaryCount: 1,
            lastReportAt: "2026-06-12T12:00:00.000Z",
            lastEnforcementAt: null,
            computedAt: "2026-06-12T12:00:00.000Z"
          }
        }
      ]
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects identity-like fields in profile directory response data", () => {
    const parsed = adminProfilesResponseSchema.safeParse({
      profiles: [
        {
          profileId: "00000000-0000-4000-8000-000000000001",
          displayName: "Safe Parent",
          locationCity: "Istanbul",
          safetyStatus: "active",
          createdAt: "2026-06-12T12:00:00.000Z",
          updatedAt: "2026-06-12T12:00:00.000Z",
          listingCount: 0,
          userEmail: "parent@example.com",
          phone: "+905551112233",
          trustSnapshot: null
        }
      ]
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts safe profile detail params", () => {
    expect(
      adminProfileParamsSchema.safeParse({
        profileId: "00000000-0000-4000-8000-000000000001"
      }).success
    ).toBe(true);

    expect(adminProfileParamsSchema.safeParse({ profileId: "not-a-uuid" }).success).toBe(false);
  });

  it("accepts safe profile detail response data", () => {
    const parsed = adminProfileDetailResponseSchema.safeParse({
      profile: {
        profileId: "00000000-0000-4000-8000-000000000001",
        displayName: "Safe Parent",
        locationCity: "Istanbul",
        safetyStatus: "restricted",
        createdAt: "2026-06-12T12:00:00.000Z",
        updatedAt: "2026-06-12T12:00:00.000Z",
        listingCount: 2,
        trustSnapshot: {
          profileId: "00000000-0000-4000-8000-000000000001",
          trustScore: 64,
          riskScore: 36,
          riskLevel: "medium",
          safetyStatus: "restricted",
          openCaseCount: 1,
          totalCaseCount: 2,
          recentReportCount: 1,
          recentEnforcementCount: 1,
          sensitiveAccessCount: 0,
          aiSummaryCount: 1,
          lastReportAt: "2026-06-12T12:00:00.000Z",
          lastEnforcementAt: null,
          computedAt: "2026-06-12T12:00:00.000Z"
        },
        stats: {
          totalListings: 2,
          activeListings: 1,
          archivedListings: 0,
          soldListings: 1,
          reservedListings: 0,
          draftListings: 0,
          totalCases: 1,
          openCases: 1,
          enforcementActions: 1
        },
        listings: [
          {
            listingId: "00000000-0000-4000-8000-000000000011",
            title: "Safe stroller",
            status: "active",
            listingType: "sale",
            condition: "good",
            price: { amount: "1200.00", currency: "TRY" },
            category: {
              id: "00000000-0000-4000-8000-000000000012",
              name: "Strollers",
              slug: "strollers"
            },
            createdAt: "2026-06-12T12:00:00.000Z",
            updatedAt: "2026-06-12T12:00:00.000Z"
          }
        ],
        relatedModerationCases: [
          {
            caseId: "00000000-0000-4000-8000-000000000021",
            reportId: "00000000-0000-4000-8000-000000000022",
            targetType: "profile",
            targetId: "00000000-0000-4000-8000-000000000001",
            status: "pending",
            priority: "high",
            reason: "safety",
            createdAt: "2026-06-12T12:00:00.000Z",
            updatedAt: "2026-06-12T12:00:00.000Z"
          }
        ],
        enforcementHistory: [
          {
            actionId: "00000000-0000-4000-8000-000000000031",
            caseId: "00000000-0000-4000-8000-000000000021",
            actionType: "profile_restrict",
            createdAt: "2026-06-12T12:00:00.000Z"
          }
        ]
      }
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects unsafe identity fields in profile detail response data", () => {
    const parsed = adminProfileDetailResponseSchema.safeParse({
      profile: {
        profileId: "00000000-0000-4000-8000-000000000001",
        displayName: "Safe Parent",
        locationCity: null,
        safetyStatus: "active",
        createdAt: "2026-06-12T12:00:00.000Z",
        updatedAt: "2026-06-12T12:00:00.000Z",
        listingCount: 0,
        userEmail: "parent@example.com",
        phone: "+905551112233",
        trustSnapshot: null,
        stats: {
          totalListings: 0,
          activeListings: 0,
          archivedListings: 0,
          soldListings: 0,
          reservedListings: 0,
          draftListings: 0,
          totalCases: 0,
          openCases: 0,
          enforcementActions: 0
        },
        listings: [],
        relatedModerationCases: [],
        enforcementHistory: []
      }
    });

    expect(parsed.success).toBe(false);
  });

});
