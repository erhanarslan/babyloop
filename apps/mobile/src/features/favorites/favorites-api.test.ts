import {
  fetchMobileFavorites,
  removeMobileFavorite,
  saveMobileFavorite
} from "./favorites-api";

describe("favorites api", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.resetModules();
  });

  it("loads and removes favorites without exposing private seller data", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    globalThis.fetch = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });

      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: {
            listings: [
              {
                id: "listing-1",
                title: "Bebek arabası",
                seller: {
                  profileId: "profile-1",
                  displayName: "Ayşe"
                }
              }
            ]
          }
        })
      } as Response;
    });

    const favorites = await fetchMobileFavorites({
      apiBaseUrl: "http://localhost:4000",
      accessToken: "test-token"
    });

    expect(favorites).toEqual([
      {
        id: "listing-1",
        title: "Bebek arabası",
        imageUrl: null,
        conditionText: null,
        favoritedAt: null,
        locationText: "Konum belirtilmemiş",
        priceText: "Fiyat belirtilmemiş",
        seller: {
          profileId: "profile-1",
          displayName: "Ayşe"
        }
      }
    ]);
    expect(JSON.stringify(favorites)).not.toContain("email");
    expect(JSON.stringify(favorites)).not.toContain("phone");
    expect(JSON.stringify(favorites)).not.toContain("accessToken");

    await removeMobileFavorite(
      {
        apiBaseUrl: "http://localhost:4000",
        accessToken: "test-token"
      },
      "listing-1"
    );

    expect(calls[1]?.url).toBe("http://localhost:4000/api/v1/favorites");
    expect(calls[1]?.init?.method).toBe("DELETE");
    expect(calls[1]?.init?.body).toBe(JSON.stringify({ listingId: "listing-1" }));
  });

  it("saves favorites through the authenticated mobile favorites endpoint", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    globalThis.fetch = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });

      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: {
            favorited: true
          }
        })
      } as Response;
    });

    const result = await saveMobileFavorite(
      {
        apiBaseUrl: "http://localhost:4000",
        accessToken: "test-token"
      },
      "listing-1",
      true
    );

    expect(result).toBe(true);
    expect(calls[0]?.url).toBe("http://localhost:4000/api/v1/favorites");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ listingId: "listing-1" }));
    expect(JSON.stringify(calls[0]?.init?.headers)).not.toMatch(/refreshToken|passwordHash|phone|email/iu);
  });

  it("removes favorites through the same endpoint body contract", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    globalThis.fetch = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });

      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: {
            favorited: false
          }
        })
      } as Response;
    });

    const result = await saveMobileFavorite(
      {
        apiBaseUrl: "http://localhost:4000",
        accessToken: "test-token"
      },
      "listing-1",
      false
    );

    expect(result).toBe(false);
    expect(calls[0]?.url).toBe("http://localhost:4000/api/v1/favorites");
    expect(calls[0]?.init?.method).toBe("DELETE");
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ listingId: "listing-1" }));
  });

  it("falls back to the listing-scoped favorite endpoint when the body contract is unavailable", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    globalThis.fetch = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });

      if (calls.length === 1) {
        return {
          ok: false,
          status: 404,
          json: async () => ({
            ok: false,
            error: {
              message: "Not found"
            }
          })
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true
        })
      } as Response;
    });

    const result = await saveMobileFavorite(
      {
        apiBaseUrl: "http://localhost:4000",
        accessToken: "test-token"
      },
      "listing-1",
      true
    );

    expect(result).toBe(true);
    expect(calls[0]?.url).toBe("http://localhost:4000/api/v1/favorites");
    expect(calls[1]?.url).toBe("http://localhost:4000/api/v1/favorites/listing-1");
    expect(calls[1]?.init?.method).toBe("POST");
  });
});
