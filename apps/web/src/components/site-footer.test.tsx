import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const componentSource = readFileSync(
  join(process.cwd(), "src/components/site-footer.tsx"),
  "utf8"
);
const layoutSource = readFileSync(
  join(process.cwd(), "src/styles/10-components-foundation.css"),
  "utf8"
);

describe("SiteFooter layout contract", () => {
  it("keeps the compact desktop group order and responsive grid", () => {
    const groupTitles = [
      '"Yasal ve güven"',
      "dictionary.footer.marketplace",
      "dictionary.footer.account",
      "dictionary.footer.support"
    ];
    const positions = groupTitles.map((title) => componentSource.indexOf(`title: ${title}`));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(layoutSource).toContain("sm:grid-cols-2 lg:grid-cols-4");
    expect(layoutSource).toContain("lg:grid-cols-[minmax(10rem,0.65fr)_minmax(0,2.35fr)]");
  });

  it("preserves every footer destination and one cookie preference action", () => {
    const expectedDestinations = [
      "/legal/kvkk",
      "/legal/privacy",
      "/legal/terms",
      "/legal/cookies",
      "/legal/ai-notice",
      "/legal/marketplace",
      "/browse",
      "/sell",
      "/favorites",
      "/conversations",
      "/login",
      "/register",
      "/auth/verify-email/request",
      "/forgot-password",
      "/guides",
      "/support/contact",
      "/legal/data-deletion"
    ];
    const destinations = [...componentSource.matchAll(/\{ href: "([^"]+)"/gu)]
      .map((match) => match[1]);

    expect(destinations).toEqual(expectedDestinations);
    expect(new Set(destinations).size).toBe(destinations.length);
    expect(componentSource.match(/Çerez tercihleri/gu)).toHaveLength(1);
    expect(componentSource).toContain("<ProtectedActionLink");
  });
});
