import { apiGet } from "../../api/client";
import {
  buildMobileListingsQuery,
  fetchMobileListingDetail
} from "./listings-api";

jest.mock("../../api/client", () => ({
  apiGet: jest.fn(),
  isRecord: (value: unknown) => typeof value === "object" && value !== null,
  resolveApiAssetUrl: (value: string | null) => value,
  safeApiErrorMessage: (value: unknown) => (value instanceof Error ? value.message : "İşlem tamamlanamadı.")
}));

jest.mock("../auth/auth-api", () => ({
  mobileAuthFetch: jest.fn()
}));

const apiGetMock = apiGet as jest.MockedFunction<typeof apiGet>;

describe("mobile listings API query builder", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  it("serializes search and marketplace filters for the public listings endpoint", () => {
    const query = buildMobileListingsQuery({
      categoryId: "00000000-0000-4000-8000-000000000001",
      city: "  İstanbul  ",
      condition: "good",
      createdSince: "last_7_days",
      listingType: "sale",
      priceMax: "4500",
      priceMin: "100",
      q: "  bebek arabası  "
    });

    expect(query.get("q")).toBe("bebek arabası");
    expect(query.get("categoryId")).toBe("00000000-0000-4000-8000-000000000001");
    expect(query.get("city")).toBe("İstanbul");
    expect(query.get("condition")).toBe("good");
    expect(query.get("createdSince")).toBe("last_7_days");
    expect(query.get("listingType")).toBe("sale");
    expect(query.get("priceMax")).toBe("4500");
    expect(query.get("priceMin")).toBe("100");
    expect(query.get("sort")).toBe("newest");
  });

  it("omits empty optional filters while keeping pagination defaults", () => {
    const query = buildMobileListingsQuery({
      categoryId: "",
      city: " ",
      priceMax: "",
      q: ""
    });

    expect(query.get("categoryId")).toBeNull();
    expect(query.get("city")).toBeNull();
    expect(query.get("priceMax")).toBeNull();
    expect(query.get("q")).toBeNull();
    expect(query.get("limit")).toBe("20");
    expect(query.get("offset")).toBe("0");
  });

  it("normalizes listing detail gallery and safe seller summary without private fields", async () => {
    apiGetMock.mockResolvedValueOnce({
      ok: true,
      data: {
        ok: true,
        data: {
          listing: {
            id: "listing-1",
            title: "Bebek arabası",
            priceAmount: 2500,
            currency: "TRY",
            status: "reserved",
            listingType: "sale",
            condition: "good",
            locationCity: "İstanbul",
            description: "Temiz kullanıldı.",
            favoriteCount: 3,
            seller: {
              id: "seller-profile-1",
              displayName: "Ayşe",
              email: "private@example.test",
              phone: "555"
            },
            images: [
              { url: "/uploads/listing-1-a.jpg" },
              { publicUrl: "/uploads/listing-1-b.jpg" },
              { url: "/uploads/listing-1-a.jpg" }
            ]
          }
        }
      }
    });

    const detail = await fetchMobileListingDetail("listing-1");

    expect(detail).toMatchObject({
      id: "listing-1",
      title: "Bebek arabası",
      priceText: "2.500 TL",
      status: "reserved",
      statusText: "Rezerve",
      listingTypeText: "Satılık",
      conditionText: "İyi",
      locationText: "İstanbul",
      description: "Temiz kullanıldı.",
      sellerProfileId: "seller-profile-1",
      sellerDisplayName: "Ayşe",
      favoriteCount: 3,
      imageUrl: "/uploads/listing-1-a.jpg",
      imageUrls: [
        "/uploads/listing-1-a.jpg",
        "/uploads/listing-1-b.jpg"
      ]
    });
    expect(JSON.stringify(detail)).not.toMatch(/private@example|555|accessToken|refreshToken|passwordHash/iu);
  });
});
