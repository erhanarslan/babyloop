import { resolveMobileApiBaseUrl } from "./api-base-url";

describe("mobile API base URL resolver", () => {
  it("uses EXPO_PUBLIC_API_BASE_URL when provided", () => {
    expect(
      resolveMobileApiBaseUrl({
        configuredBaseUrl: "http://localhost:4000",
        envBaseUrl: "http://192.168.1.20:4000/",
        platformOS: "android"
      })
    ).toBe("http://192.168.1.20:4000");
  });

  it("maps localhost to Android emulator host when env is absent", () => {
    expect(
      resolveMobileApiBaseUrl({
        configuredBaseUrl: "http://localhost:4000",
        envBaseUrl: null,
        platformOS: "android"
      })
    ).toBe("http://10.0.2.2:4000");
  });

  it("keeps localhost on iOS simulator", () => {
    expect(
      resolveMobileApiBaseUrl({
        configuredBaseUrl: "http://localhost:4000/",
        envBaseUrl: null,
        platformOS: "ios"
      })
    ).toBe("http://localhost:4000");
  });
});
