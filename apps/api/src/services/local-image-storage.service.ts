import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SafeImage } from "./image-safety.service.js";

const LISTING_UPLOAD_ROUTE_PREFIX = "/api/v1/uploads/listings";

export type StoredListingImage = {
  filePath: string;
  url: string;
};

export async function storeListingImage(input: {
  image: SafeImage;
  listingId: string;
  uploadRoot: string;
}): Promise<StoredListingImage> {
  const filename = `${randomUUID()}.${input.image.extension}`;
  const directory = path.join(input.uploadRoot, "listings", input.listingId);
  const filePath = path.join(directory, filename);

  assertInsideUploadRoot(input.uploadRoot, filePath);
  await mkdir(directory, { recursive: true });
  await writeFile(filePath, input.image.buffer, { flag: "wx" });

  return {
    filePath,
    url: `${LISTING_UPLOAD_ROUTE_PREFIX}/${input.listingId}/${filename}`
  };
}

export async function deleteStoredListingImage(input: {
  uploadRoot: string;
  url: string;
}): Promise<void> {
  const resolved = resolveStoredListingImagePathFromUrl(input.uploadRoot, input.url);

  if (!resolved) {
    return;
  }

  await rm(resolved.filePath, { force: true });
}

export async function resolveStoredListingImage(input: {
  filename: string;
  listingId: string;
  uploadRoot: string;
}): Promise<
  | {
      contentType: SafeImage["contentType"];
      stream: ReturnType<typeof createReadStream>;
    }
  | null
> {
  const extension = path.extname(input.filename).replace(".", "").toLowerCase();
  const contentType = getContentType(extension);

  if (!contentType || !isSafeFilename(input.filename)) {
    return null;
  }

  const filePath = path.join(input.uploadRoot, "listings", input.listingId, input.filename);

  assertInsideUploadRoot(input.uploadRoot, filePath);

  try {
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      return null;
    }
  } catch {
    return null;
  }

  return {
    contentType,
    stream: createReadStream(filePath)
  };
}

function resolveStoredListingImagePathFromUrl(
  uploadRoot: string,
  url: string
): { filePath: string } | null {
  if (!url.startsWith(`${LISTING_UPLOAD_ROUTE_PREFIX}/`)) {
    return null;
  }

  const [, listingId, filename] = url.slice(LISTING_UPLOAD_ROUTE_PREFIX.length).split("/");

  if (!listingId || !filename || !isUuidLike(listingId) || !isSafeFilename(filename)) {
    return null;
  }

  const filePath = path.join(uploadRoot, "listings", listingId, filename);
  assertInsideUploadRoot(uploadRoot, filePath);

  return { filePath };
}

function getContentType(extension: string): SafeImage["contentType"] | null {
  if (extension === "jpg" || extension === "jpeg") {
    return "image/jpeg";
  }

  if (extension === "png") {
    return "image/png";
  }

  if (extension === "webp") {
    return "image/webp";
  }

  return null;
}

function assertInsideUploadRoot(uploadRoot: string, filePath: string): void {
  const normalizedRoot = path.resolve(uploadRoot);
  const normalizedFile = path.resolve(filePath);

  if (!normalizedFile.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw new Error("Upload path escaped the upload root.");
  }
}

function isSafeFilename(filename: string): boolean {
  return /^[a-f0-9-]+\.(jpg|png|webp)$/i.test(filename);
}

function isUuidLike(value: string): boolean {
  return /^[a-f0-9-]{36}$/i.test(value);
}
