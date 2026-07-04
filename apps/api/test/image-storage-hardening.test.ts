import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { optimizeListingImage } from "./src/services/image-optimization.service.js";
import {
  validateListingImage,
  type SafeImage
} from "./src/services/image-safety.service.js";

describe("listing image storage hardening", () => {
  it("rejects MIME, extension, and magic-byte mismatches before storage", async () => {
    const pngBuffer = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
      }
    }).png().toBuffer();

    expect(validateListingImage({
      buffer: pngBuffer,
      filename: "photo.png",
      mimetype: "image/png"
    })).toMatchObject({
      ok: true
    });

    expect(validateListingImage({
      buffer: pngBuffer,
      filename: "photo.jpg",
      mimetype: "image/jpeg"
    })).toMatchObject({
      ok: false,
      code: "INVALID_IMAGE"
    });

    expect(validateListingImage({
      buffer: pngBuffer,
      filename: "photo.png",
      mimetype: "image/jpeg"
    })).toMatchObject({
      ok: false,
      code: "INVALID_IMAGE"
    });

    expect(validateListingImage({
      buffer: pngBuffer,
      filename: "photo.svg",
      mimetype: "image/svg+xml"
    })).toMatchObject({
      ok: false,
      code: "INVALID_IMAGE"
    });
  });

  it("strips EXIF and original metadata through re-encoding normalization", async () => {
    const sourceBuffer = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: { r: 12, g: 34, b: 56 }
      }
    })
      .jpeg()
      .withMetadata()
      .toBuffer();

    const sourceMetadata = await sharp(sourceBuffer).metadata();

    const image: SafeImage = {
      buffer: sourceBuffer,
      contentType: "image/jpeg",
      extension: "jpg"
    };

    const optimized = await optimizeListingImage(image, {
      IMAGE_OPTIMIZATION_ENABLED: "true",
      LISTING_IMAGE_MIN_OPTIMIZE_BYTES: "1",
      LISTING_IMAGE_JPEG_QUALITY: "82",
      LISTING_IMAGE_MAX_DIMENSION: "1600"
    } as NodeJS.ProcessEnv);

    const optimizedMetadata = await sharp(optimized.buffer).metadata();

    expect(sourceMetadata).toMatchObject({
      format: "jpeg"
    });
    expect(optimized).toMatchObject({
      contentType: "image/jpeg",
      extension: "jpg"
    });
    expect(optimizedMetadata.format).toBe("jpeg");
    expect(optimizedMetadata.exif).toBeUndefined();
    expect(optimizedMetadata.icc).toBeUndefined();
    expect(JSON.stringify(optimizedMetadata)).not.toMatch(/BabyLoop|EXIF|GPS|copyright/iu);
  });
});
