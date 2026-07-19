import { mobileAuthFetch } from "../auth/auth-api";
import { createMobileListing } from "./sell-api";

jest.mock("../../api/client", () => ({
  apiGet: jest.fn(),
  isRecord: (value: unknown) => typeof value === "object" && value !== null && !Array.isArray(value),
  safeApiErrorMessage: (_payload: unknown, fallback: string) => fallback
}));

jest.mock("../auth/auth-api", () => ({
  mobileAuthFetch: jest.fn()
}));

const mobileAuthFetchMock = mobileAuthFetch as jest.MockedFunction<typeof mobileAuthFetch>;

describe("mobile sell API", () => {
  beforeEach(() => {
    mobileAuthFetchMock.mockReset();
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
