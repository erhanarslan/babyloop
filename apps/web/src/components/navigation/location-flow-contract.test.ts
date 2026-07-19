import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getLocationQueryValue } from "./public-navigation-model";

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("marketplace location flow", () => {
  it("allows same-origin geolocation while keeping unrelated browser capabilities closed", () => {
    const nextConfig = read("next.config.mjs");

    expect(nextConfig).toContain("geolocation=(self)");
    expect(nextConfig).toContain("camera=()");
    expect(nextConfig).toContain("microphone=()");
  });

  it("maps stored location slugs to API city filters", () => {
    expect(getLocationQueryValue("istanbul")).toBe("İstanbul");
    expect(getLocationQueryValue("turkiye")).toBe("");
  });

  it("propagates location changes to current results and the home feed", () => {
    const header = read("src/components/site-header.tsx");
    const homeFeed = read("src/features/home/home-latest-listings-section.tsx");

    expect(header).toContain("LOCATION_CHANGED_EVENT");
    expect(header).toContain('params.set("city", cityQueryValue)');
    expect(homeFeed).toContain("window.addEventListener(LOCATION_CHANGED_EVENT");
    expect(homeFeed).toContain('params.set("city", cityQueryValue)');
  });
});
