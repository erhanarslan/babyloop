import {
  createMobileChildNote,
  createMobileChildReminder,
  fetchMobileChildLifecycleRecommendations,
  fetchMobileChildProfiles,
  updateMobileChildNote,
  updateMobileChildReminder,
  updateMobileChildProfile
} from "./child-reminders-api";
import { mobileAuthFetch } from "../auth/auth-api";

jest.mock("../listings/listings-api", () => ({
  normalizeMobileListingSummary: (value: unknown) => {
    const listing = value as Record<string, unknown>;

    return {
      conditionText: "İyi",
      id: listing.id,
      imageUrl: null,
      imageUrls: [],
      listingType: "sale",
      listingTypeText: "Satılık",
      locationText: "Konum belirtilmedi",
      priceText: "450 TL",
      publicationReviewReason: null,
      publicationState: "published",
      publishAfter: null,
      publishedAt: null,
      recommendedAgeMinMonths: listing.recommendedAgeMinMonths,
      recommendedAgeMaxMonths: listing.recommendedAgeMaxMonths,
      status: "active",
      statusText: "Aktif",
      title: listing.title
    };
  }
}));

jest.mock("../auth/auth-api", () => ({
  mobileAuthFetch: jest.fn()
}));

const mobileAuthFetchMock = mobileAuthFetch as jest.MockedFunction<typeof mobileAuthFetch>;

describe("mobile child reminders API", () => {
  beforeEach(() => {
    mobileAuthFetchMock.mockReset();
  });

  it("fetches child profiles through authenticated mobile fetch", async () => {
    mobileAuthFetchMock.mockResolvedValueOnce(apiResponse({
      ok: true,
      data: {
        childProfiles: []
      }
    }));

    const result = await fetchMobileChildProfiles();

    expect(result).toEqual({
      ok: true,
      data: {
        childProfiles: []
      }
    });
    expect(mobileAuthFetchMock).toHaveBeenCalledWith("/api/v1/child-profiles", expect.any(Object));
  });

  it("normalizes age-matched listing recommendations for mobile cards", async () => {
    mobileAuthFetchMock.mockResolvedValueOnce(apiResponse({
      ok: true,
      data: {
        groups: [
          {
            childProfileId: "child-1",
            childProfileLabel: "Ada",
            ageBand: "preschool_24_36",
            matchedListings: [
              {
                id: "listing-1",
                title: "Yaşa uygun oyuncak",
                listingType: "sale",
                condition: "good",
                status: "active",
                publicationState: "published",
                recommendedAgeMinMonths: 24,
                recommendedAgeMaxMonths: 36,
                price: { amount: "450.00", currency: "TRY" }
              }
            ],
            recommendations: []
          }
        ]
      }
    }));

    const result = await fetchMobileChildLifecycleRecommendations();

    expect(result).toEqual({
      ok: true,
      data: {
        groups: [
          expect.objectContaining({
            childProfileId: "child-1",
            matchedListings: [
              expect.objectContaining({
                id: "listing-1",
                priceText: "450 TL",
                recommendedAgeMinMonths: 24,
                recommendedAgeMaxMonths: 36
              })
            ]
          })
        ]
      }
    });
    expect(mobileAuthFetchMock).toHaveBeenCalledWith(
      "/api/v1/child-profiles/lifecycle-recommendations",
      expect.any(Object)
    );
  });

  it("falls back to an empty recommendation list for malformed listing payloads", async () => {
    mobileAuthFetchMock.mockResolvedValueOnce(apiResponse({
      ok: true,
      data: {
        groups: [
          {
            childProfileId: "child-1",
            childProfileLabel: "Ada",
            ageBand: "preschool_24_36",
            matchedListings: { unexpected: true },
            recommendations: []
          }
        ]
      }
    }));

    await expect(fetchMobileChildLifecycleRecommendations()).resolves.toEqual({
      ok: true,
      data: {
        groups: [
          expect.objectContaining({
            childProfileId: "child-1",
            matchedListings: []
          })
        ]
      }
    });
  });

  it("creates child notes with JSON payload and no token leakage", async () => {
    mobileAuthFetchMock.mockResolvedValueOnce(apiResponse({
      ok: true,
      data: {
        note: {
          id: "note-1",
          childProfileId: "child-1",
          noteType: "general",
          title: "Bez notu",
          body: null,
          isPinned: false,
          isArchived: false,
          createdAt: "2030-01-01T00:00:00.000Z",
          updatedAt: "2030-01-01T00:00:00.000Z"
        }
      }
    }));

    const result = await createMobileChildNote("child-1", {
      title: "Bez notu",
      body: null
    });

    const [, init] = mobileAuthFetchMock.mock.calls[0]!;

    expect(result.ok).toBe(true);
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({
      title: "Bez notu",
      body: null
    }));
    expect(JSON.stringify({ result, init })).not.toMatch(/accessToken|refreshToken|passwordHash/iu);
  });

  it("creates scheduled child reminders with safe one-time payloads", async () => {
    mobileAuthFetchMock.mockResolvedValueOnce(apiResponse({
      ok: true,
      data: {
        reminder: {
          id: "reminder-1",
          childProfileId: "child-1",
          title: "Bez al",
          description: null,
          reminderType: "shopping",
          scheduleKind: "one_time",
          intervalMinutes: null,
          dueAt: "2030-01-01T10:00:00.000Z",
          eventAt: null,
          notifyBeforeMinutes: null,
          localTime: null,
          timezone: "Europe/Istanbul",
          remindAt: "2030-01-01T10:00:00.000Z",
          nextRunAt: "2030-01-01T10:00:00.000Z",
          channel: "in_app",
          status: "scheduled",
          lastTriggeredAt: null,
          completedAt: null,
          cancelledAt: null,
          createdAt: "2030-01-01T00:00:00.000Z",
          updatedAt: "2030-01-01T00:00:00.000Z"
        }
      }
    }));

    const result = await createMobileChildReminder("child-1", {
      title: "Bez al",
      scheduleKind: "one_time",
      dueAt: "2030-01-01T10:00:00.000Z",
      timezone: "Europe/Istanbul"
    });

    const [, init] = mobileAuthFetchMock.mock.calls[0]!;

    expect(result.ok).toBe(true);
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({
      title: "Bez al",
      scheduleKind: "one_time",
      dueAt: "2030-01-01T10:00:00.000Z",
      timezone: "Europe/Istanbul"
    }));
    expect(JSON.stringify({ result, init })).not.toMatch(/sendPush|sendEmail|n8n|accessToken|refreshToken|passwordHash/iu);
  });

  it("updates child notes and reminders through real PATCH endpoints", async () => {
    mobileAuthFetchMock
      .mockResolvedValueOnce(apiResponse({
        ok: true,
        data: {
          note: {
            id: "note-1",
            childProfileId: "child-1",
            noteType: "general",
            title: "Bez stoğu",
            body: "2 paket kaldı",
            isPinned: false,
            isArchived: false,
            createdAt: "2030-01-01T00:00:00.000Z",
            updatedAt: "2030-01-01T00:00:00.000Z"
          }
        }
      }))
      .mockResolvedValueOnce(apiResponse({
        ok: true,
        data: {
          reminder: {
            id: "reminder-1",
            childProfileId: "child-1",
            title: "Bez al",
            description: "Pazar günü",
            reminderType: "shopping",
            scheduleKind: "one_time",
            intervalMinutes: null,
            dueAt: "2030-01-02T10:00:00.000Z",
            eventAt: null,
            notifyBeforeMinutes: null,
            localTime: null,
            timezone: "Europe/Istanbul",
            remindAt: "2030-01-02T10:00:00.000Z",
            nextRunAt: "2030-01-02T10:00:00.000Z",
            channel: "in_app",
            status: "scheduled",
            lastTriggeredAt: null,
            completedAt: null,
            cancelledAt: null,
            createdAt: "2030-01-01T00:00:00.000Z",
            updatedAt: "2030-01-01T00:00:00.000Z"
          }
        }
      }));

    const noteResult = await updateMobileChildNote("child-1", "note-1", {
      body: "2 paket kaldı",
      title: "Bez stoğu"
    });
    const reminderResult = await updateMobileChildReminder("child-1", "reminder-1", {
      description: "Pazar günü",
      dueAt: "2030-01-02T10:00:00.000Z",
      remindAt: "2030-01-02T10:00:00.000Z",
      title: "Bez al"
    });

    expect(noteResult.ok).toBe(true);
    expect(reminderResult.ok).toBe(true);
    expect(mobileAuthFetchMock.mock.calls[0]?.[0]).toBe("/api/v1/child-profiles/child-1/notes/note-1");
    expect(mobileAuthFetchMock.mock.calls[1]?.[0]).toBe("/api/v1/child-profiles/child-1/reminders/reminder-1");
    expect(JSON.stringify({ noteResult, reminderResult })).not.toMatch(/accessToken|refreshToken|passwordHash/iu);
  });

  it("updates notification cadence on the child profile", async () => {
    mobileAuthFetchMock.mockResolvedValueOnce(apiResponse({
      ok: true,
      data: {
        childProfile: {
          id: "child-1",
          label: "Çocuğum",
          ageBand: "toddler_12_24",
          ageMonths: null,
          birthMonth: null,
          birthYear: null,
          gender: null,
          notificationCadence: "off",
          isActive: true,
          createdAt: "2030-01-01T00:00:00.000Z",
          updatedAt: "2030-01-01T00:00:00.000Z"
        }
      }
    }));

    const result = await updateMobileChildProfile("child-1", {
      notificationCadence: "off"
    });

    const [, init] = mobileAuthFetchMock.mock.calls[0]!;

    expect(result.ok).toBe(true);
    expect(init?.method).toBe("PATCH");
    expect(init?.body).toBe(JSON.stringify({
      notificationCadence: "off"
    }));
  });

  it("returns a safe unavailable response when mobile fetch fails", async () => {
    mobileAuthFetchMock.mockRejectedValueOnce(new Error("network down"));

    const result = await fetchMobileChildProfiles();

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "API_UNAVAILABLE"
      }
    });
  });
});

function apiResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body)
  } as unknown as Response;
}
