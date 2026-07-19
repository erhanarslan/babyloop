import {
  fetchMobileMyListings,
  updateMobileListingStatus
} from "./listings-api";
import { mobileAuthFetch } from "../auth/auth-api";

jest.mock("../../api/client", () => ({
  apiGet: jest.fn(),
  isRecord: (value: unknown) => typeof value === "object" && value !== null,
  resolveApiAssetUrl: (url: string | null | undefined) => url ?? null,
  safeApiErrorMessage: (payload: unknown, fallback: string) => {
    if (
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof (payload as { error?: unknown }).error === "object" &&
      (payload as { error?: unknown }).error !== null &&
      "message" in ((payload as { error: { message?: unknown } }).error) &&
      typeof (payload as { error: { message?: unknown } }).error.message === "string"
    ) {
      return (payload as { error: { message: string } }).error.message;
    }

    return fallback;
  }
}));

jest.mock("../auth/auth-api", () => ({
  mobileAuthFetch: jest.fn()
}));

const mobileAuthFetchMock = mobileAuthFetch as jest.MockedFunction<typeof mobileAuthFetch>;

describe("mobile listings API seller lifecycle", () => {
  beforeEach(() => {
    mobileAuthFetchMock.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("loads current user's listings through authenticated mobile fetch", async () => {
    mobileAuthFetchMock.mockResolvedValueOnce(apiResponse({
      ok: true,
      data: {
        listings: [
          {
            id: "listing-1",
            title: "Temiz bebek arabası",
            status: "reserved",
            publicationState: "published",
            publishAfter: null,
            publishedAt: "2026-07-14T10:00:30.000Z",
            publicationReviewReason: null,
            recommendedAgeMinMonths: 6,
            recommendedAgeMaxMonths: 12,
            listingType: "sale",
            condition: "good",
            priceAmount: "1250.00",
            currency: "TRY",
            createdAt: "2026-07-14T10:00:00.000Z",
            favoriteCount: 2,
            firstImage: {
              url: "/api/v1/uploads/listings/one.png"
            },
            category: {
              name: "Bebek Arabaları"
            }
          }
        ]
      }
    }));

    await expect(fetchMobileMyListings()).resolves.toEqual([
      expect.objectContaining({
        id: "listing-1",
        title: "Temiz bebek arabası",
        status: "reserved",
        statusText: "Rezerve",
        publicationState: "published",
        publishedAt: "2026-07-14T10:00:30.000Z",
        listingTypeText: "Satılık",
        conditionText: "İyi",
        priceText: "1.250 TL",
        createdAt: "2026-07-14T10:00:00.000Z",
        favoriteCount: 2,
        imageUrl: "/api/v1/uploads/listings/one.png",
        recommendedAgeMinMonths: 6,
        recommendedAgeMaxMonths: 12
      })
    ]);

    expect(mobileAuthFetchMock).toHaveBeenCalledWith("/api/v1/me/listings");
  });

  it("updates listing lifecycle status and normalizes the response", async () => {
    mobileAuthFetchMock.mockResolvedValueOnce(apiResponse({
      ok: true,
      data: {
        listing: {
          id: "listing-1",
          title: "Temiz bebek arabası",
          status: "sold",
          publicationState: "published",
          publishAfter: null,
          publishedAt: "2026-07-14T10:00:30.000Z",
          publicationReviewReason: null,
          recommendedAgeMinMonths: null,
          recommendedAgeMaxMonths: null,
          listingType: "sale",
          condition: "good",
          priceAmount: "1250.00",
          currency: "TRY"
        }
      }
    }));

    await expect(updateMobileListingStatus("listing-1", "sold")).resolves.toEqual(
      expect.objectContaining({
        id: "listing-1",
        status: "sold",
        statusText: "Satıldı",
        publicationState: "published"
      })
    );

    expect(mobileAuthFetchMock).toHaveBeenCalledWith(
      "/api/v1/listings/listing-1/status",
      expect.objectContaining({
        body: JSON.stringify({ status: "sold" }),
        headers: {
          "content-type": "application/json"
        },
        method: "PATCH"
      })
    );
  });

  it("throws a controlled error when listing status update fails", async () => {
    mobileAuthFetchMock.mockResolvedValueOnce(apiResponse({
      ok: false,
      error: {
        message: "Invalid status transition."
      }
    }, 400));

    await expect(updateMobileListingStatus("listing-1", "active")).rejects.toThrow(
      "Invalid status transition."
    );
  });
});

function apiResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as Response;
}
