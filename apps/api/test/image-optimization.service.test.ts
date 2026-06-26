
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { optimizeListingImage } from "../src/services/image-optimization.service.js";
import type { SafeImage } from "../src/services/image-safety.service.js";

describe("optimizeListingImage", () => {
  it("resizes and compresses large listing images before storage", async () => {
    const width = 1700;
    const height = 1200;
    const sourceBuffer = await sharp(randomBytes(width * height * 3), {
      raw: {
        width,
        height,
        channels: 3
      }
    })
      .png()
      .toBuffer();

    const image: SafeImage = {
      buffer: sourceBuffer,
      contentType: "image/png",
      extension: "png"
    };

    const optimized = await optimizeListingImage(image, {
      LISTING_IMAGE_MAX_DIMENSION: "1200",
      LISTING_IMAGE_JPEG_QUALITY: "82"
    } as NodeJS.ProcessEnv);

    const metadata = await sharp(optimized.buffer).metadata();

    expect(optimized.contentType).toBe("image/jpeg");
    expect(optimized.extension).toBe("jpg");
    expect(Math.max(metadata.width ?? 0, metadata.height ?? 0)).toBeLessThanOrEqual(1200);
    expect(optimized.buffer.length).toBeLessThan(sourceBuffer.length);
  });

  it("can be disabled by env for local debugging", async () => {
    const sourceBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: "#ffffff"
      }
    })
      .png()
      .toBuffer();

    const image: SafeImage = {
      buffer: sourceBuffer,
      contentType: "image/png",
      extension: "png"
    };

    const optimized = await optimizeListingImage(image, {
      IMAGE_OPTIMIZATION_ENABLED: "false"
    } as NodeJS.ProcessEnv);

    expect(optimized).toBe(image);
  });
});
