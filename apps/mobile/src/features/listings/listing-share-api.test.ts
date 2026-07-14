import {
  buildMobileListingFallbackShareLink,
  deriveWebBaseUrlFromApiBaseUrl,
  fetchMobileListingShareLink
} from "./listing-share-api";

jest.mock("../../config/api", () => ({
  getApiBaseUrl: () => "http://api.test:4000"
}));

describe("listing share api", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("fetches persisted listing share link from the API", async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          shareLink: {
            code: "Ab3xY9kQ",
            url: "https://babyloop.test/s/Ab3xY9kQ",
            targetPath: "/listings/listing-1"
          }
        }
      })
    })) as unknown as typeof fetch;

    await expect(fetchMobileListingShareLink("listing-1")).resolves.toEqual({
      code: "Ab3xY9kQ",
      url: "https://babyloop.test/s/Ab3xY9kQ",
      targetPath: "/listings/listing-1"
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://api.test:4000/api/v1/listings/listing-1/share-link",
      expect.objectContaining({
        method: "GET"
      })
    );
  });

  it("falls back to direct web listing URL when the short-link API fails", async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({
        ok: false,
        error: {
          message: "Short link failed."
        }
      })
    })) as unknown as typeof fetch;

    await expect(fetchMobileListingShareLink("missing-listing")).resolves.toEqual({
      code: "",
      targetPath: "/listings/missing-listing",
      url: "http://api.test:3000/listings/missing-listing"
    });
  });

  it("derives web base URL from mobile API base URL", () => {
    expect(deriveWebBaseUrlFromApiBaseUrl("http://192.168.1.204:4000")).toBe(
      "http://192.168.1.204:3000"
    );

    expect(buildMobileListingFallbackShareLink("listing 1", "http://192.168.1.204:4000")).toEqual({
      code: "",
      targetPath: "/listings/listing%201",
      url: "http://192.168.1.204:3000/listings/listing%201"
    });
  });
});
