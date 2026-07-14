import { shortLinks } from "@babyloop/database/schema";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { createUser } from "./helpers/auth.js";
import { resetTestDatabase } from "./helpers/db.js";
import { createListing } from "./helpers/fixtures.js";

describe("short link routes", () => {
  let app: TestApp | undefined;

  beforeEach(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("creates and reuses a persisted short link for a listing", async () => {
    const seller = await createUser(app!, {
      email: "listing-share-seller@babyloop.test"
    });
    const listing = await createListing(app!, seller.accessToken);

    const first = await app!.inject({
      method: "GET",
      url: `/api/v1/listings/${listing.id}/share-link`
    });
    const second = await app!.inject({
      method: "POST",
      url: `/api/v1/listings/${listing.id}/share-link`
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);

    const firstShareLink = first.json().data.shareLink;
    const secondShareLink = second.json().data.shareLink;

    expect(firstShareLink).toEqual(secondShareLink);
    expect(firstShareLink.code).toMatch(/^[0-9A-Za-z]{8}$/u);
    expect(firstShareLink.url).toBe(`http://localhost:3000/s/${firstShareLink.code}`);
    expect(firstShareLink.targetPath).toBe(`/listings/${listing.id}`);

    const rows = await app!.db
      .select()
      .from(shortLinks)
      .where(eq(shortLinks.code, firstShareLink.code));

    expect(rows).toHaveLength(1);
    expect(rows[0].targetType).toBe("listing");
    expect(rows[0].targetId).toBe(listing.id);
  });

  it("resolves a short link and increments click count", async () => {
    const seller = await createUser(app!, {
      email: "listing-share-resolve-seller@babyloop.test"
    });
    const listing = await createListing(app!, seller.accessToken);

    const created = await app!.inject({
      method: "GET",
      url: `/api/v1/listings/${listing.id}/share-link`
    });
    const code = created.json().data.shareLink.code;

    const resolved = await app!.inject({
      method: "GET",
      url: `/api/v1/share-links/${code}/resolve`
    });

    expect(resolved.statusCode).toBe(200);
    expect(resolved.json().data.targetPath).toBe(`/listings/${listing.id}`);

    const [row] = await app!.db
      .select()
      .from(shortLinks)
      .where(eq(shortLinks.code, code));

    expect(row.clickCount).toBe(1);
  });

  it("returns 404 for missing listings and invalid short codes", async () => {
    const missingListing = await app!.inject({
      method: "GET",
      url: "/api/v1/listings/30000000-0000-4000-8000-999999999999/share-link"
    });

    const invalidCode = await app!.inject({
      method: "GET",
      url: "/api/v1/share-links/not-valid-code!!!/resolve"
    });

    expect(missingListing.statusCode).toBe(404);
    expect(invalidCode.statusCode).toBe(404);
  });
});
