import { afterEach, beforeEach, describe, expect, it } from "vitest";
import robots from "./robots";

const originalNextPublicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const originalBabyloopSiteUrl = process.env.BABYLOOP_SITE_URL;

describe("web robots route", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://babyloop.test/";
    delete process.env.BABYLOOP_SITE_URL;
  });

  afterEach(() => {
    if (originalNextPublicSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalNextPublicSiteUrl;
    }

    if (originalBabyloopSiteUrl === undefined) {
      delete process.env.BABYLOOP_SITE_URL;
    } else {
      process.env.BABYLOOP_SITE_URL = originalBabyloopSiteUrl;
    }
  });

  it("allows public discovery routes and blocks account/private flows", () => {
    const result = robots();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;

    if (!rule) {
      throw new Error("Expected robots route to return at least one rule.");
    }

    expect(result.sitemap).toBe("https://babyloop.test/sitemap.xml");
    expect(result.host).toBe("https://babyloop.test");
    expect(rule.allow).toEqual(expect.arrayContaining(["/", "/browse", "/categories", "/listings", "/guides"]));
    expect(rule.disallow).toEqual(
      expect.arrayContaining([
        "/admin",
        "/account",
        "/auth",
        "/conversations",
        "/favorites",
        "/login",
        "/my-listings",
        "/notifications",
        "/register",
        "/sell"
      ])
    );
  });
});
