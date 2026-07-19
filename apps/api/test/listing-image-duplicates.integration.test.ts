import { listingImages } from "@babyloop/database/schema";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTestApp, type TestApp } from "./helpers/app.js";
import { authHeader, createUser } from "./helpers/auth.js";
import { resetTestDatabase } from "./helpers/db.js";
import { createListing } from "./helpers/fixtures.js";

let app!: TestApp;

const originalImageStorageDriver = process.env.IMAGE_STORAGE_DRIVER;
const originalImageOptimizationEnabled = process.env.IMAGE_OPTIMIZATION_ENABLED;

beforeEach(async () => {
  process.env.IMAGE_STORAGE_DRIVER = "local";
  process.env.IMAGE_OPTIMIZATION_ENABLED = "false";
  await resetTestDatabase();
  app = await createTestApp();
});

afterEach(async () => {
  if (originalImageStorageDriver === undefined) {
    delete process.env.IMAGE_STORAGE_DRIVER;
  } else {
    process.env.IMAGE_STORAGE_DRIVER = originalImageStorageDriver;
  }

  if (originalImageOptimizationEnabled === undefined) {
    delete process.env.IMAGE_OPTIMIZATION_ENABLED;
  } else {
    process.env.IMAGE_OPTIMIZATION_ENABLED = originalImageOptimizationEnabled;
  }

  await app.close();
});

describe("listing image duplicate content hash", () => {
  it("rejects uploading the same image content twice for the same listing without exposing hashes", async () => {
    const seller = await createUser(app);
    const listing = await createListing(app, seller.accessToken, {
      withApprovedImage: false
    });

    const firstRequest = multipartRequest({
      buffer: tinyPng(),
      filename: "duplicate-a.png",
      mimetype: "image/png"
    });
    const first = await app.inject({
      ...firstRequest,
      headers: {
        ...authHeader(seller.accessToken),
        ...firstRequest.headers
      },
      method: "POST",
      url: `/api/v1/listings/${listing.id}/images`
    });

    const secondRequest = multipartRequest({
      buffer: tinyPng(),
      filename: "duplicate-b.png",
      mimetype: "image/png"
    });
    const second = await app.inject({
      ...secondRequest,
      headers: {
        ...authHeader(seller.accessToken),
        ...secondRequest.headers
      },
      method: "POST",
      url: `/api/v1/listings/${listing.id}/images`
    });

    const imageRows = await app.db
      .select({
        contentHash: listingImages.contentHash,
        id: listingImages.id
      })
      .from(listingImages)
      .where(eq(listingImages.listingId, listing.id));

    expect(first.statusCode).toBe(201);
    expect(first.body).not.toMatch(/contentHash|content_hash|sha256/iu);

    expect(second.statusCode).toBe(409);
    expect(second.json()).toMatchObject({
      ok: false,
      error: {
        code: "DUPLICATE_LISTING_IMAGE"
      }
    });
    expect(second.body).not.toMatch(/contentHash|content_hash|sha256/iu);

    expect(imageRows).toHaveLength(1);
    expect(imageRows[0]?.contentHash).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/u));
  });

  it("allows the same image content on different listings for now", async () => {
    const firstSeller = await createUser(app, { email: "first-image-seller@example.test" });
    const secondSeller = await createUser(app, { email: "second-image-seller@example.test" });
    const firstListing = await createListing(app, firstSeller.accessToken, {
      withApprovedImage: false
    });
    const secondListing = await createListing(app, secondSeller.accessToken, {
      withApprovedImage: false
    });

    const firstRequest = multipartRequest({
      buffer: tinyPng(),
      filename: "shared-a.png",
      mimetype: "image/png"
    });
    const first = await app.inject({
      ...firstRequest,
      headers: {
        ...authHeader(firstSeller.accessToken),
        ...firstRequest.headers
      },
      method: "POST",
      url: `/api/v1/listings/${firstListing.id}/images`
    });

    const secondRequest = multipartRequest({
      buffer: tinyPng(),
      filename: "shared-b.png",
      mimetype: "image/png"
    });
    const second = await app.inject({
      ...secondRequest,
      headers: {
        ...authHeader(secondSeller.accessToken),
        ...secondRequest.headers
      },
      method: "POST",
      url: `/api/v1/listings/${secondListing.id}/images`
    });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
  });
});

function multipartRequest(input: {
  buffer: Buffer;
  fieldName?: string;
  filename: string;
  mimetype: string;
}): { headers: Record<string, string>; payload: Buffer } {
  const boundary = `----babyloop-test-${Math.random().toString(16).slice(2)}`;
  const fieldName = input.fieldName ?? "image";
  const head = Buffer.from(
    [
      `--${boundary}`,
      `Content-Disposition: form-data; name="${fieldName}"; filename="${input.filename}"`,
      `Content-Type: ${input.mimetype}`,
      "",
      ""
    ].join("\r\n")
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const payload = Buffer.concat([head, input.buffer, tail]);

  return {
    headers: {
      "content-length": String(payload.length),
      "content-type": `multipart/form-data; boundary=${boundary}`
    },
    payload
  };
}

function tinyPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lwSx2wAAAABJRU5ErkJggg==",
    "base64"
  );
}
