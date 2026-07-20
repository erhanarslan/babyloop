import { apiGet } from "../../api/client";
import { mobileAuthFetch } from "../auth/auth-api";
import {
  createMobileListing,
  fetchMobileCategories,
  resetMobileCategoryCacheForTests
} from "./sell-api";

jest.mock("../../api/client", () => ({
  apiGet: jest.fn(),
  isRecord: (value: unknown) => typeof value === "object" && value !== null && !Array.isArray(value),
  safeApiErrorMessage: (_payload: unknown, fallback: string) => fallback
}));

jest.mock("../auth/auth-api", () => ({
  mobileAuthFetch: jest.fn()
}));

const mobileAuthFetchMock = mobileAuthFetch as jest.MockedFunction<typeof mobileAuthFetch>;
const apiGetMock = apiGet as jest.MockedFunction<typeof apiGet>;

describe("mobile sell API", () => {
  beforeEach(() => {
    mobileAuthFetchMock.mockReset();
    apiGetMock.mockReset();
    resetMobileCategoryCacheForTests();
  });


  it("coalesces category requests and reuses the short-lived category cache", async () => {
    apiGetMock.mockResolvedValueOnce({
      ok: true,
      data: {
        categories: [
          { id: "category-1", name: "Bebek Arabaları", parentId: null, slug: "bebek-arabalari" }
        ]
      }
    });

    const [first, second] = await Promise.all([
      fetchMobileCategories(),
      fetchMobileCategories()
    ]);
    const cached = await fetchMobileCategories();

    expect(first).toEqual(second);
    expect(cached).toEqual(first);
    expect(apiGetMock).toHaveBeenCalledTimes(1);
    expect(apiGetMock).toHaveBeenCalledWith("/api/v1/categories");
  });

  it("sends and preserves a paired recommended age range", async () => {
    const payload = {
      categoryId: "category-1",
      condition: "good" as const,
      currency: "TRY" as const,
      listingType: "sale" as const,
      recommendedAgeMinMonths: 6,
      recommendedAgeMaxMonths: 12,
      title: "Temiz bebek arabası"
    };
    mobileAuthFetchMock.mockResolvedValueOnce(apiResponse({
      ok: true,
      data: {
        listing: {
          id: "listing-1",
          title: payload.title,
          status: "active",
          publicationState: "awaiting_images"
        }
      }
    }));

    await expect(createMobileListing(payload)).resolves.toEqual(
      expect.objectContaining({
        id: "listing-1",
        recommendedAgeMinMonths: 6,
        recommendedAgeMaxMonths: 12
      })
    );
    expect(mobileAuthFetchMock).toHaveBeenCalledWith(
      "/api/v1/listings",
      expect.objectContaining({
        body: JSON.stringify(payload),
        method: "POST"
      })
    );
  });
});

function apiResponse(body: unknown): Response {
  return {
    ok: true,
    status: 201,
    json: async () => body
  } as Response;
}
