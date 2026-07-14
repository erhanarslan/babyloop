import { describe, expect, it } from "vitest";
import {
  buildListingTargetPath,
  buildShortLinkUrl,
  generateShortCode,
  isShortCode,
  normalizeWebAppUrl
} from "../src/services/short-links.service.js";

describe("short links service helpers", () => {
  it("generates compact non-sequential base62 short codes", () => {
    const code = generateShortCode();

    expect(code).toMatch(/^[0-9A-Za-z]{8}$/u);
    expect(isShortCode(code)).toBe(true);
  });

  it("builds normalized public short link URLs", () => {
    expect(buildShortLinkUrl("https://babyloop.test/", "Ab3xY9kQ")).toBe(
      "https://babyloop.test/s/Ab3xY9kQ"
    );

    expect(buildShortLinkUrl("ftp://invalid.test", "Ab3xY9kQ")).toBe(
      "http://localhost:3000/s/Ab3xY9kQ"
    );
  });

  it("builds listing target path without leaking raw query data", () => {
    expect(buildListingTargetPath("listing id/with slash")).toBe(
      "/listings/listing%20id%2Fwith%20slash"
    );
  });

  it("normalizes public web app base URL safely", () => {
    expect(normalizeWebAppUrl(" http://192.168.1.204:3000/ ")).toBe(
      "http://192.168.1.204:3000"
    );
  });
});
