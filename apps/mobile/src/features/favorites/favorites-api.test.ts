import { fetchMobileFavorites, removeMobileFavorite } from "./favorites-api";

describe("favorites api", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("loads and removes favorites without exposing private seller data", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    globalThis.fetch = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });

      return {
        ok: true,
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

    expect(calls[1]?.url).toBe("http://localhost:4000/api/v1/favorites/listing-1");
    expect(calls[1]?.init?.method).toBe("DELETE");
  });
});
