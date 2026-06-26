
import sharp from "sharp";
import type { SafeImage } from "./image-safety.service.js";

const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_JPEG_QUALITY = 82;
const DEFAULT_MIN_OPTIMIZE_BYTES = 120 * 1024;
const MAX_INPUT_PIXELS = 32_000_000;

export async function optimizeListingImage(
  image: SafeImage,
  env: NodeJS.ProcessEnv = process.env
): Promise<SafeImage> {
  if (env.IMAGE_OPTIMIZATION_ENABLED === "false") {
    return image;
  }

  const maxDimension = readPositiveInteger(
    env.LISTING_IMAGE_MAX_DIMENSION,
    DEFAULT_MAX_DIMENSION
  );
  const quality = clamp(
    readPositiveInteger(env.LISTING_IMAGE_JPEG_QUALITY, DEFAULT_JPEG_QUALITY),
    60,
    92
  );
  const minOptimizeBytes = readPositiveInteger(
    env.LISTING_IMAGE_MIN_OPTIMIZE_BYTES,
    DEFAULT_MIN_OPTIMIZE_BYTES
  );

  const pipeline = sharp(image.buffer, {
    failOn: "error",
    limitInputPixels: MAX_INPUT_PIXELS
  }).rotate();

  const metadata = await pipeline.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const shouldResize = width > maxDimension || height > maxDimension;
  const shouldOptimize =
    shouldResize ||
    image.buffer.length >= minOptimizeBytes ||
    image.contentType === "image/png";

  if (!shouldOptimize) {
    return image;
  }

  const optimizedBuffer = await pipeline
    .resize({
      width: maxDimension,
      height: maxDimension,
      fit: "inside",
      withoutEnlargement: true
    })
    .flatten({ background: "#ffffff" })
    .jpeg({
      quality,
      mozjpeg: true,
      progressive: true
    })
    .toBuffer();

  if (!shouldResize && optimizedBuffer.length >= image.buffer.length) {
    return image;
  }

  return {
    ...image,
    buffer: optimizedBuffer,
    contentType: "image/jpeg",
    extension: "jpg"
  };
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
