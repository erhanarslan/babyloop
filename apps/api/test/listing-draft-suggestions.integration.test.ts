import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { authHeader, createUser } from "./helpers/auth.js";
import { createTestApp, type TestApp } from "./helpers/app.js";
import { createCategory } from "./helpers/fixtures.js";
import { resetTestDatabase } from "./helpers/db.js";

let app!: TestApp;

beforeEach(async () => {
  await resetTestDatabase();
  app = await createTestApp();
});

afterEach(async () => {
  await app.close();
});

describe("listing AI draft suggestion endpoint", () => {
  it("requires auth before reading listing draft inputs", async () => {
    const request = multipartRequest({
      fields: {
        locale: "tr",
        title: "Bebek arabası"
      }
    });
    const response = await app.inject({
      headers: request.headers,
      method: "POST",
      payload: request.payload,
      url: "/api/v1/listings/ai-draft-suggestions"
    });

    expect(response.statusCode).toBe(401);
  });

  it("accepts text-only and image-only draft requests without leaking provider metadata", async () => {
    const user = await createUser(app);
    const category = await createCategory(app.db, {
      name: "Stroller",
      slug: "stroller"
    });
    const textRequest = multipartRequest({
      fields: {
        categoryId: category.id,
        condition: "good",
        currency: "TRY",
        listingType: "sale",
        locale: "tr",
        title: "Temiz bebek arabası test@example.test"
      }
    });
    const textResponse = await app.inject({
      headers: {
        ...authHeader(user.accessToken),
        ...textRequest.headers
      },
      method: "POST",
      payload: textRequest.payload,
      url: "/api/v1/listings/ai-draft-suggestions"
    });

    expect(textResponse.statusCode).toBe(200);
    expect(textResponse.json()).toMatchObject({
      ok: true,
      data: {
        suggestion: {
          categoryId: category.id,
          confidence: expect.any(String)
        }
      }
    });
    expect(textResponse.body).not.toMatch(/test@example\.test|data:image|base64|raw provider|accessToken|refreshToken/iu);

    const imageRequest = multipartRequest({
      files: [
        {
          buffer: tinyPng(),
          fieldName: "images",
          filename: "stroller.png",
          mimetype: "image/png"
        }
      ]
    });
    const imageResponse = await app.inject({
      headers: {
        ...authHeader(user.accessToken),
        ...imageRequest.headers
      },
      method: "POST",
      payload: imageRequest.payload,
      url: "/api/v1/listings/ai-draft-suggestions"
    });

    expect(imageResponse.statusCode).toBe(200);
    expect(imageResponse.json()).toMatchObject({
      ok: true,
      data: {
        suggestion: {
          imageFeedback: [
            expect.objectContaining({
              imageIdOrUrl: "image-1"
            })
          ]
        }
      }
    });
    expect(imageResponse.body).not.toMatch(/data:image|base64|provider output|accessToken|refreshToken/iu);
  });

  it("accepts text plus five images and rejects a sixth image", async () => {
    const user = await createUser(app);
    const fiveImages = multipartRequest({
      fields: {
        currency: "TRY",
        listingType: "sale",
        locale: "tr",
        title: "Çok fotoğraflı ilan"
      },
      files: Array.from({ length: 5 }, (_, index) => ({
        buffer: tinyPng(),
        fieldName: "images",
        filename: `image-${index}.png`,
        mimetype: "image/png"
      }))
    });
    const success = await app.inject({
      headers: {
        ...authHeader(user.accessToken),
        ...fiveImages.headers
      },
      method: "POST",
      payload: fiveImages.payload,
      url: "/api/v1/listings/ai-draft-suggestions"
    });

    expect(success.statusCode).toBe(200);
    expect(success.json().data.suggestion.imageFeedback).toHaveLength(5);

    const sixImages = multipartRequest({
      fields: {
        title: "Altı görsel"
      },
      files: Array.from({ length: 6 }, (_, index) => ({
        buffer: tinyPng(),
        fieldName: "images",
        filename: `too-many-${index}.png`,
        mimetype: "image/png"
      }))
    });
    const rejected = await app.inject({
      headers: {
        ...authHeader(user.accessToken),
        ...sixImages.headers
      },
      method: "POST",
      payload: sixImages.payload,
      url: "/api/v1/listings/ai-draft-suggestions"
    });

    expect(rejected.statusCode).toBe(400);
    expect(rejected.json()).toMatchObject({
      ok: false,
      error: {
        code: "TOO_MANY_IMAGES"
      }
    });
  });

  it("rejects invalid mime, empty input, and unavailable provider safely", async () => {
    const user = await createUser(app);
    const invalidImage = multipartRequest({
      files: [
        {
          buffer: Buffer.from("not an image"),
          fieldName: "images",
          filename: "bad.gif",
          mimetype: "image/gif"
        }
      ]
    });
    const invalidImageResponse = await app.inject({
      headers: {
        ...authHeader(user.accessToken),
        ...invalidImage.headers
      },
      method: "POST",
      payload: invalidImage.payload,
      url: "/api/v1/listings/ai-draft-suggestions"
    });

    expect(invalidImageResponse.statusCode).toBe(400);
    expect(invalidImageResponse.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_IMAGE"
      }
    });

    const emptyRequest = multipartRequest({});
    const emptyResponse = await app.inject({
      headers: {
        ...authHeader(user.accessToken),
        ...emptyRequest.headers
      },
      method: "POST",
      payload: emptyRequest.payload,
      url: "/api/v1/listings/ai-draft-suggestions"
    });

    expect(emptyResponse.statusCode).toBe(400);
    expect(emptyResponse.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_REQUEST"
      }
    });

    await app.close();
    app = await createTestApp({ aiListingDraftProvider: "unavailable" });

    const unavailableRequest = multipartRequest({
      fields: {
        title: "Manuel devam edilebilir"
      }
    });
    const unavailableResponse = await app.inject({
      headers: {
        ...authHeader(user.accessToken),
        ...unavailableRequest.headers
      },
      method: "POST",
      payload: unavailableRequest.payload,
      url: "/api/v1/listings/ai-draft-suggestions"
    });

    expect(unavailableResponse.statusCode).toBe(503);
    expect(unavailableResponse.json()).toMatchObject({
      ok: false,
      error: {
        code: "AI_LISTING_DRAFT_UNAVAILABLE"
      }
    });
  });
});

function multipartRequest(input: {
  fields?: Record<string, string>;
  files?: Array<{
    buffer: Buffer;
    fieldName: string;
    filename: string;
    mimetype: string;
  }>;
}): { headers: Record<string, string>; payload: Buffer } {
  const boundary = `----babyloop-ai-draft-${Math.random().toString(16).slice(2)}`;
  const chunks: Buffer[] = [];

  for (const [name, value] of Object.entries(input.fields ?? {})) {
    chunks.push(Buffer.from([
      `--${boundary}`,
      `Content-Disposition: form-data; name="${name}"`,
      "",
      value
    ].join("\r\n")));
    chunks.push(Buffer.from("\r\n"));
  }

  for (const file of input.files ?? []) {
    chunks.push(Buffer.from([
      `--${boundary}`,
      `Content-Disposition: form-data; name="${file.fieldName}"; filename="${file.filename}"`,
      `Content-Type: ${file.mimetype}`,
      "",
      ""
    ].join("\r\n")));
    chunks.push(file.buffer);
    chunks.push(Buffer.from("\r\n"));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  const payload = Buffer.concat(chunks);

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
