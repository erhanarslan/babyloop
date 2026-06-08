import path from "node:path";

export const MAX_LISTING_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_LISTING_IMAGES = 5;

export type SafeImage = {
  buffer: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
};

export type ImageSafetyResult =
  | { ok: true; image: SafeImage }
  | { ok: false; code: "INVALID_IMAGE" | "IMAGE_TOO_LARGE"; message: string };

const MIME_TO_EXTENSION: Record<string, SafeImage["extension"]> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

const EXTENSION_TO_MIME: Record<string, SafeImage["contentType"]> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
};

export function validateListingImage(input: {
  buffer: Buffer;
  filename: string;
  mimetype: string;
}): ImageSafetyResult {
  if (input.buffer.length === 0) {
    return invalidImage();
  }

  if (input.buffer.length > MAX_LISTING_IMAGE_BYTES) {
    return {
      ok: false,
      code: "IMAGE_TOO_LARGE",
      message: "Image is too large."
    };
  }

  const declaredExtension = normalizeExtension(input.filename);
  const declaredMime = input.mimetype.trim().toLowerCase();
  const extensionMime = declaredExtension ? EXTENSION_TO_MIME[declaredExtension] : undefined;
  const mimeExtension = MIME_TO_EXTENSION[declaredMime];
  const magicMime = detectImageMime(input.buffer);

  if (!declaredExtension || !extensionMime || !mimeExtension || !magicMime) {
    return invalidImage();
  }

  if (extensionMime !== declaredMime || magicMime !== declaredMime) {
    return invalidImage();
  }

  return {
    ok: true,
    image: {
      buffer: input.buffer,
      contentType: magicMime,
      extension: mimeExtension
    }
  };
}

function normalizeExtension(filename: string): string | null {
  const extension = path.extname(filename).replace(".", "").toLowerCase();

  if (!extension) {
    return null;
  }

  return extension;
}

function detectImageMime(buffer: Buffer): SafeImage["contentType"] | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

function invalidImage(): ImageSafetyResult {
  return {
    ok: false,
    code: "INVALID_IMAGE",
    message: "Image file is invalid or unsupported."
  };
}
