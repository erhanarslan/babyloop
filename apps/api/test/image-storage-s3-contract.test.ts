import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Readable } from "node:stream";

import {
  deleteStoredListingImage,
  resolveStoredListingImage,
  storeListingImage
} from "../src/services/image-storage.service.js";
import type { SafeImage } from "../src/services/image-safety.service.js";
import sharp from "sharp";

let validTestPngBuffer: Buffer;


const sentCommands: Array<{ name: string; input: Record<string, unknown> }> = [];

vi.mock("@aws-sdk/client-s3", () => {
  class MockS3Client {
    async send(command: { input: Record<string, unknown>; constructor: { name: string } }) {
      sentCommands.push({ name: command.constructor.name, input: command.input });

      if (command.constructor.name === "GetObjectCommand") {
        return {
          Body: Readable.from([Buffer.from([1, 2, 3])]),
          ContentLength: 3,
          ContentType: "image/png"
        };
      }

      return {};
    }
  }

  class MockPutObjectCommand {
    input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  Object.defineProperty(MockPutObjectCommand, "name", { value: "PutObjectCommand" });

  class MockGetObjectCommand {
    input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  Object.defineProperty(MockGetObjectCommand, "name", { value: "GetObjectCommand" });

  class MockDeleteObjectCommand {
    input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  Object.defineProperty(MockDeleteObjectCommand, "name", { value: "DeleteObjectCommand" });

  return {
    DeleteObjectCommand: MockDeleteObjectCommand,
    GetObjectCommand: MockGetObjectCommand,
    PutObjectCommand: MockPutObjectCommand,
    S3Client: MockS3Client
  };
});

const listingId = "11111111-1111-4111-8111-111111111111";
const safeFilename = "22222222-2222-4222-8222-222222222222.png";
const env = {
  IMAGE_STORAGE_DRIVER: "s3",
  IMAGE_STORAGE_PUBLIC_BASE_URL: "https://cdn.example.test/babyloop",
  S3_ACCESS_KEY_ID: "access-key-should-not-leak",
  S3_BUCKET: "babyloop-images",
  S3_ENDPOINT: "https://r2.example.test",
  S3_FORCE_PATH_STYLE: "true",
  S3_REGION: "auto",
  S3_SECRET_ACCESS_KEY: "secret-key-should-not-leak"
};

beforeEach(async () => {
    validTestPngBuffer = await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    }).png().toBuffer();

  sentCommands.length = 0;
});

describe("S3 image storage contract", () => {
  it("stores listing images in an S3/R2 bucket without exposing credentials in returned metadata", async () => {
    const image = buildSafeImage("png");

    const stored = await storeListingImage({
      env,
      image,
      listingId,
      uploadRoot: "unused-for-s3"
    });

    expect(stored.storageDriver).toBe("s3");
    expect(stored.objectKey).toMatch(/^listings\/11111111-1111-4111-8111-111111111111\/[a-f0-9-]+\.png$/u);
    expect(stored.url).toBe(`https://cdn.example.test/babyloop/${stored.objectKey}`);
    expect(JSON.stringify(stored)).not.toContain("secret-key-should-not-leak");
    expect(JSON.stringify(stored)).not.toContain("access-key-should-not-leak");

    expect(command("PutObjectCommand").input).toMatchObject({
      Bucket: "babyloop-images",
      CacheControl: "public, max-age=31536000, immutable",
      ContentType: "image/png",
      Key: stored.objectKey
    });
    expect(command("PutObjectCommand").input.Body).toBe(image.buffer);
  });

  it("deletes only object URLs that belong to the configured public base URL", async () => {
    await deleteStoredListingImage({
      env,
      uploadRoot: "unused-for-s3",
      url: `https://cdn.example.test/babyloop/listings/${listingId}/${safeFilename}`
    });

    expect(command("DeleteObjectCommand").input).toMatchObject({
      Bucket: "babyloop-images",
      Key: `listings/${listingId}/${safeFilename}`
    });

    sentCommands.length = 0;

    await deleteStoredListingImage({
      env,
      uploadRoot: "unused-for-s3",
      url: `https://evil.example.test/babyloop/listings/${listingId}/${safeFilename}`
    });

    expect(sentCommands).toHaveLength(0);
  });

  it("resolves S3/R2 listing images only from safe listing object keys", async () => {
    const resolved = await resolveStoredListingImage({
      env,
      filename: safeFilename,
      listingId,
      uploadRoot: "unused-for-s3"
    });

    expect(resolved).not.toBeNull();
    expect(resolved?.contentType).toBe("image/png");
    expect(resolved?.stream).toBeInstanceOf(Readable);
    expect(command("GetObjectCommand").input).toMatchObject({
      Bucket: "babyloop-images",
      Key: `listings/${listingId}/${safeFilename}`
    });

    sentCommands.length = 0;

    const unsafe = await resolveStoredListingImage({
      env,
      filename: "../evil.png",
      listingId,
      uploadRoot: "unused-for-s3"
    });

    expect(unsafe).toBeNull();
    expect(sentCommands).toHaveLength(0);
  });
});

function command(name: "DeleteObjectCommand" | "GetObjectCommand" | "PutObjectCommand") {
  const item = sentCommands.find((entry) => entry.name === name);

  if (!item) {
    throw new Error(`${name} was not sent. Sent commands: ${sentCommands.map((entry) => entry.name).join(", ")}`);
  }

  return item;
}

function buildSafeImage(extension: SafeImage["extension"]): SafeImage {
  return {
    buffer: validTestPngBuffer,
    contentType: extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/png",
    contentHash: "sha256:test-content-hash",
    extension
  };
}
