import {
  deleteMobileListingImage,
  fetchMobileEditableListingDetail,
  reorderMobileListingImages,
  updateMobileListing
} from "./listings-api";
import { mobileAuthFetch } from "../auth/auth-api";

jest.mock("../../api/client", () => ({
  apiGet: jest.fn(),
  isRecord: (value: unknown) => typeof value === "object" && value !== null && !Array.isArray(value),
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

describe("mobile listing edit API", () => {
  beforeEach(() => {
    mobileAuthFetchMock.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("loads editable owner listing detail with review status images", async () => {
    mobileAuthFetchMock.mockResolvedValueOnce(apiResponse({
      ok: true,
      data: {
        listing: {
          id: "listing-1",
          title: "Temiz bebek arabası",
          description: "Temiz kullanıldı.",
          status: "archived",
          listingType: "sale",
          condition: "good",
          price: {
            amount: "1250.00",
            currency: "TRY"
          },
          category: {
            id: "category-1",
            name: "Bebek arabaları",
            slug: "strollers"
          },
          favoriteCount: 0,
          createdAt: "2026-07-14T10:00:00.000Z",
          updatedAt: "2026-07-14T10:00:00.000Z",
          images: [
            {
              id: "image-1",
              reviewStatus: "needs_review",
              sortOrder: 0,
              url: "/api/v1/uploads/listings/one.png"
            }
          ],
          seller: {
            id: "profile-1",
            displayName: "Ayşe",
            avatarUrl: null,
            locationCity: "İstanbul"
          }
        }
      }
    }));

    await expect(fetchMobileEditableListingDetail("listing-1")).resolves.toEqual(
      expect.objectContaining({
        categoryId: "category-1",
        description: "Temiz kullanıldı.",
        editableImages: [
          {
            id: "image-1",
            reviewStatus: "needs_review",
            reviewStatusText: "İncelemede",
            sortOrder: 0,
            url: "/api/v1/uploads/listings/one.png"
          }
        ],
        id: "listing-1",
        priceAmount: "1250.00",
        status: "archived"
      })
    );

    expect(mobileAuthFetchMock).toHaveBeenCalledWith("/api/v1/me/listings/listing-1");
  });

  it("updates listing fields", async () => {
    mobileAuthFetchMock.mockResolvedValueOnce(apiResponse({
      ok: true,
      data: {
        listing: {
          id: "listing-1",
          title: "Yeni başlık",
          status: "active",
          listingType: "sale",
          condition: "good",
          price: {
            amount: "1500.00",
            currency: "TRY"
          },
          category: {
            id: "category-1",
            name: "Bebek arabaları",
            slug: "strollers"
          },
          favoriteCount: 0,
          createdAt: "2026-07-14T10:00:00.000Z",
          images: []
        }
      }
    }));

    await expect(updateMobileListing("listing-1", {
      priceAmount: "1500.00",
      title: "Yeni başlık"
    })).resolves.toEqual(expect.objectContaining({
      id: "listing-1",
      title: "Yeni başlık"
    }));

    expect(mobileAuthFetchMock).toHaveBeenCalledWith(
      "/api/v1/listings/listing-1",
      expect.objectContaining({
        body: JSON.stringify({
          priceAmount: "1500.00",
          title: "Yeni başlık"
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "PATCH"
      })
    );
  });

  it("deletes and reorders listing images through owner endpoints", async () => {
    mobileAuthFetchMock
      .mockResolvedValueOnce(apiResponse({
        ok: true,
        data: {
          deleted: true
        }
      }))
      .mockResolvedValueOnce(apiResponse({
        ok: true,
        data: {
          images: [
            {
              id: "image-2",
              reviewStatus: "approved",
              sortOrder: 0,
              url: "/uploads/two.png"
            },
            {
              id: "image-1",
              reviewStatus: "approved",
              sortOrder: 1,
              url: "/uploads/one.png"
            }
          ]
        }
      }));

    await expect(deleteMobileListingImage("listing-1", "image-1")).resolves.toBeUndefined();
    await expect(reorderMobileListingImages("listing-1", ["image-2", "image-1"])).resolves.toEqual([
      expect.objectContaining({
        id: "image-2",
        sortOrder: 0
      }),
      expect.objectContaining({
        id: "image-1",
        sortOrder: 1
      })
    ]);
  });
});

function apiResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as Response;
}
