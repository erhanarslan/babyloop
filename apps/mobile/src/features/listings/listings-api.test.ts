import { buildMobileListingsQuery } from "./listings-api";

jest.mock("../../api/client", () => ({
  apiGet: jest.fn(),
  isRecord: (value: unknown) => typeof value === "object" && value !== null,
  resolveApiAssetUrl: (value: string | null) => value,
  safeApiErrorMessage: (value: unknown) => (value instanceof Error ? value.message : "İşlem tamamlanamadı.")
}));

jest.mock("../auth/auth-api", () => ({
  mobileAuthFetch: jest.fn()
}));

describe("mobile listings API query builder", () => {
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
});
