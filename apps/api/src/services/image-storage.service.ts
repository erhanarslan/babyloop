import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";
import { access, mkdir } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { optimizeListingImage } from "./image-optimization.service.js";
import type { SafeImage } from "./image-safety.service.js";
import {
  deleteStoredListingImage as deleteLocalStoredListingImage,
  resolveStoredListingImage as resolveLocalStoredListingImage,
  storeListingImage as storeLocalListingImage,
  type StoredListingImage as LocalStoredListingImage
} from "./local-image-storage.service.js";

export type ImageStorageDriver = "local" | "s3";

export type StoredListingImage = {
  contentHash: string;
  filePath?: string;
  objectKey?: string;
  storageDriver: ImageStorageDriver;
  url: string;
};

export function createListingImageContentHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export type LocalImageStorageConfig = {
  driver: "local";
};

export type S3ImageStorageConfig = {
  accessKeyId: string;
  bucket: string;
  driver: "s3";
  endpoint?: string;
  forcePathStyle: boolean;
  publicBaseUrl: string;
  region: string;
  secretAccessKey: string;
};

export type ImageStorageConfig = LocalImageStorageConfig | S3ImageStorageConfig;

export type ImageStorageConfigPreview = {
  driver: ImageStorageDriver;
  localFallback: boolean;
  publicBaseUrl: string | null;
  s3Configured: boolean;
};

export function getImageStorageConfig(env: NodeJS.ProcessEnv = process.env): ImageStorageConfig {
  const driver = normalizeDriver(env.IMAGE_STORAGE_DRIVER);

  if (driver === "local") {
    return { driver: "local" };
  }

  const publicBaseUrl = requireEnv(env, "IMAGE_STORAGE_PUBLIC_BASE_URL");
  const bucket = requireEnv(env, "S3_BUCKET");
  const region = requireEnv(env, "S3_REGION");
  const accessKeyId = requireEnv(env, "S3_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv(env, "S3_SECRET_ACCESS_KEY");
  const endpoint = optionalEnv(env, "S3_ENDPOINT");

  assertPublicBaseUrl(publicBaseUrl, "IMAGE_STORAGE_PUBLIC_BASE_URL");

  return {
    accessKeyId,
    bucket,
    driver: "s3",
    ...(endpoint ? { endpoint } : {}),
    forcePathStyle: parseBoolean(env.S3_FORCE_PATH_STYLE, true),
    publicBaseUrl: publicBaseUrl.replace(/\/+$/u, ""),
    region,
    secretAccessKey
  };
}

export function getImageStorageConfigPreview(env: NodeJS.ProcessEnv = process.env): ImageStorageConfigPreview {
  const driver = normalizeDriver(env.IMAGE_STORAGE_DRIVER);

  if (driver === "local") {
    return {
      driver: "local",
      localFallback: true,
      publicBaseUrl: null,
      s3Configured: false
    };
  }

  return {
    driver: "s3",
    localFallback: false,
    publicBaseUrl: optionalEnv(env, "IMAGE_STORAGE_PUBLIC_BASE_URL") ?? null,
    s3Configured: Boolean(
      optionalEnv(env, "IMAGE_STORAGE_PUBLIC_BASE_URL") &&
      optionalEnv(env, "S3_BUCKET") &&
      optionalEnv(env, "S3_REGION") &&
      optionalEnv(env, "S3_ACCESS_KEY_ID") &&
      optionalEnv(env, "S3_SECRET_ACCESS_KEY")
    )
  };
}

export async function probeImageStorageReadiness(input: {
  env?: NodeJS.ProcessEnv;
  uploadRoot: string;
}): Promise<{ driver: ImageStorageDriver }> {
  const config = getImageStorageConfig(input.env);

  if (config.driver === "local") {
    await mkdir(input.uploadRoot, { recursive: true });
    await access(input.uploadRoot, fsConstants.R_OK | fsConstants.W_OK);
    return { driver: "local" };
  }

  await createS3Client(config).send(new HeadBucketCommand({
    Bucket: config.bucket
  }));

  return { driver: "s3" };
}

export async function storeListingImage(input: {
  env?: NodeJS.ProcessEnv;
  image: SafeImage;
  listingId: string;
  uploadRoot: string;
}): Promise<StoredListingImage> {
  const config = getImageStorageConfig(input.env);
  const image = await optimizeListingImage(input.image, input.env);
  const contentHash = createListingImageContentHash(image.buffer);

  if (config.driver === "local") {
    const stored = await storeLocalListingImage({
      image,
      listingId: input.listingId,
      uploadRoot: input.uploadRoot
    });

    return { ...fromLocalStoredImage(stored), contentHash };
  }

  return storeS3ListingImage({
    config,
    contentHash,
    image,
    listingId: input.listingId
  });
}

export async function deleteStoredListingImage(input: {
  env?: NodeJS.ProcessEnv;
  uploadRoot: string;
  url: string;
}): Promise<void> {
  const config = getImageStorageConfig(input.env);

  if (config.driver === "local") {
    await deleteLocalStoredListingImage({
      uploadRoot: input.uploadRoot,
      url: input.url
    });
    return;
  }

  const objectKey = resolveS3ObjectKeyFromPublicUrl(config.publicBaseUrl, input.url);

  if (!objectKey) {
    return;
  }

  await createS3Client(config).send(new DeleteObjectCommand({
    Bucket: config.bucket,
    Key: objectKey
  }));

  deleteImageProxyCacheEntry(buildImageProxyCacheKey(config.bucket, objectKey));
}

export async function resolveStoredListingImage(input: {
  env?: NodeJS.ProcessEnv;
  filename: string;
  listingId: string;
  uploadRoot: string;
}): Promise<{ contentType: SafeImage["contentType"]; stream: Readable } | null> {
  const config = getImageStorageConfig(input.env);

  if (config.driver === "local") {
    const localImage = await resolveLocalStoredListingImage({
      filename: input.filename,
      listingId: input.listingId,
      uploadRoot: input.uploadRoot
    });

    if (!localImage) {
      return null;
    }

    return {
      contentType: localImage.contentType,
      stream: localImage.stream
    };
  }

  const objectKey = buildListingObjectKeyFromFilename(input.listingId, input.filename);
  const contentType = getContentTypeFromFilename(input.filename);

  if (!objectKey || !contentType) {
    return null;
  }

  const cacheKey = buildImageProxyCacheKey(config.bucket, objectKey);
  const cached = getImageProxyCacheEntry(cacheKey, input.env);

  if (cached) {
    return {
      contentType: cached.contentType,
      stream: Readable.from(cached.buffer)
    };
  }

  try {
    const response = await createS3Client(config).send(new GetObjectCommand({
      Bucket: config.bucket,
      Key: objectKey
    }));

    if (!response.Body || !(response.Body instanceof Readable)) {
      return null;
    }

    const buffer = await streamToBuffer(response.Body);

    setImageProxyCacheEntry(cacheKey, {
      buffer,
      contentType
    }, input.env);

    return {
      contentType,
      stream: Readable.from(buffer)
    };
  } catch (error) {
    if (isS3NotFoundError(error)) {
      return null;
    }

    throw error;
  }
}


async function storeS3ListingImage(input: {
  config: S3ImageStorageConfig;
  contentHash: string;
  image: SafeImage;
  listingId: string;
}): Promise<StoredListingImage> {
  const objectKey = buildListingObjectKey(input.listingId, input.image.extension);

  await createS3Client(input.config).send(new PutObjectCommand({
    Body: input.image.buffer,
    Bucket: input.config.bucket,
    CacheControl: "public, max-age=31536000, immutable",
    ContentType: input.image.contentType,
    Key: objectKey
  }));

  return {
    contentHash: input.contentHash,
    objectKey,
    storageDriver: "s3",
    url: `${input.config.publicBaseUrl}/${objectKey}`
  };
}

function createS3Client(config: S3ImageStorageConfig): S3Client {
  return new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    },
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    forcePathStyle: config.forcePathStyle,
    region: config.region
  });
}

function buildListingObjectKey(listingId: string, extension: SafeImage["extension"]): string {
  return `listings/${listingId}/${randomUUID()}.${extension}`;
}

function buildListingObjectKeyFromFilename(listingId: string, filename: string): string | null {
  if (!isUuidLike(listingId) || !isSafeListingImageFilename(filename)) {
    return null;
  }

  return `listings/${listingId}/${filename}`;
}

function getContentTypeFromFilename(filename: string): SafeImage["contentType"] | null {
  const extension = filename.split(".").pop()?.toLowerCase();

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

function isSafeListingImageFilename(filename: string): boolean {
  return /^[a-f0-9-]+\.(jpg|png|webp)$/iu.test(filename);
}

function isUuidLike(value: string): boolean {
  return /^[a-f0-9-]{36}$/iu.test(value);
}


type ImageProxyCacheEntry = {
  buffer: Buffer;
  contentType: SafeImage["contentType"];
  lastAccessedAt: number;
  sizeBytes: number;
};

const DEFAULT_IMAGE_PROXY_MEMORY_CACHE_MAX_BYTES = 64 * 1024 * 1024;
const DEFAULT_IMAGE_PROXY_MEMORY_CACHE_MAX_ITEM_BYTES = 2 * 1024 * 1024;

const imageProxyMemoryCache = new Map<string, ImageProxyCacheEntry>();
let imageProxyMemoryCacheBytes = 0;

function buildImageProxyCacheKey(bucket: string, objectKey: string): string {
  return `${bucket}:${objectKey}`;
}

function getImageProxyCacheEntry(
  cacheKey: string,
  env: NodeJS.ProcessEnv | undefined
): ImageProxyCacheEntry | null {
  if (!isImageProxyMemoryCacheEnabled(env)) {
    return null;
  }

  const entry = imageProxyMemoryCache.get(cacheKey);

  if (!entry) {
    return null;
  }

  entry.lastAccessedAt = Date.now();
  return entry;
}

function setImageProxyCacheEntry(
  cacheKey: string,
  input: {
    buffer: Buffer;
    contentType: SafeImage["contentType"];
  },
  env: NodeJS.ProcessEnv | undefined
): void {
  if (!isImageProxyMemoryCacheEnabled(env)) {
    return;
  }

  const maxItemBytes = readPositiveEnvInteger(
    env?.IMAGE_PROXY_MEMORY_CACHE_MAX_ITEM_BYTES,
    DEFAULT_IMAGE_PROXY_MEMORY_CACHE_MAX_ITEM_BYTES
  );

  if (input.buffer.length > maxItemBytes) {
    return;
  }

  deleteImageProxyCacheEntry(cacheKey);

  const entry: ImageProxyCacheEntry = {
    buffer: input.buffer,
    contentType: input.contentType,
    lastAccessedAt: Date.now(),
    sizeBytes: input.buffer.length
  };

  imageProxyMemoryCache.set(cacheKey, entry);
  imageProxyMemoryCacheBytes += entry.sizeBytes;

  pruneImageProxyMemoryCache(env);
}

function deleteImageProxyCacheEntry(cacheKey: string): void {
  const existing = imageProxyMemoryCache.get(cacheKey);

  if (!existing) {
    return;
  }

  imageProxyMemoryCache.delete(cacheKey);
  imageProxyMemoryCacheBytes = Math.max(0, imageProxyMemoryCacheBytes - existing.sizeBytes);
}

function pruneImageProxyMemoryCache(env: NodeJS.ProcessEnv | undefined): void {
  const maxBytes = readPositiveEnvInteger(
    env?.IMAGE_PROXY_MEMORY_CACHE_MAX_BYTES,
    DEFAULT_IMAGE_PROXY_MEMORY_CACHE_MAX_BYTES
  );

  if (imageProxyMemoryCacheBytes <= maxBytes) {
    return;
  }

  const entries = [...imageProxyMemoryCache.entries()].sort(
    (left, right) => left[1].lastAccessedAt - right[1].lastAccessedAt
  );

  for (const [cacheKey] of entries) {
    deleteImageProxyCacheEntry(cacheKey);

    if (imageProxyMemoryCacheBytes <= maxBytes) {
      return;
    }
  }
}

function isImageProxyMemoryCacheEnabled(env: NodeJS.ProcessEnv | undefined): boolean {
  return env?.IMAGE_PROXY_MEMORY_CACHE_ENABLED !== "false";
}

function readPositiveEnvInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function isS3NotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const maybeError = error as {
    $metadata?: { httpStatusCode?: number };
    name?: string;
  };

  return (
    maybeError.$metadata?.httpStatusCode === 404 ||
    maybeError.name === "NoSuchKey" ||
    maybeError.name === "NotFound"
  );
}


function fromLocalStoredImage(stored: LocalStoredListingImage): Omit<StoredListingImage, "contentHash"> {
  return {
    filePath: stored.filePath,
    storageDriver: "local",
    url: stored.url
  };
}

function resolveS3ObjectKeyFromPublicUrl(publicBaseUrl: string, url: string): string | null {
  const normalizedBaseUrl = publicBaseUrl.replace(/\/$/, "");
  const normalizedUrl = url.trim();

  if (!normalizedBaseUrl || !normalizedUrl) {
    return null;
  }

  if (normalizedBaseUrl.startsWith("/")) {
    const prefix = `${normalizedBaseUrl}/`;

    if (!normalizedUrl.startsWith(prefix)) {
      return null;
    }

    return normalizedUrl.slice(prefix.length);
  }

  try {
    const parsedPublicBaseUrl = new URL(normalizedBaseUrl);
    const parsedUrl = new URL(normalizedUrl);

    if (parsedPublicBaseUrl.origin !== parsedUrl.origin) {
      return null;
    }

    const basePath = parsedPublicBaseUrl.pathname.replace(/\/$/, "");
    const imagePath = parsedUrl.pathname;

    if (!imagePath.startsWith(`${basePath}/`)) {
      return null;
    }

    return imagePath.slice(basePath.length + 1);
  } catch {
    return null;
  }
}

function normalizeDriver(value: string | undefined): ImageStorageDriver {
  const normalized = value?.trim().toLowerCase();

  if (!normalized || normalized === "local") {
    return "local";
  }

  if (normalized === "s3") {
    return "s3";
  }

  throw new Error("IMAGE_STORAGE_DRIVER must be local or s3.");
}

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = optionalEnv(env, key);

  if (!value) {
    throw new Error(`${key} is required when IMAGE_STORAGE_DRIVER=s3.`);
  }

  return value;
}

function optionalEnv(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key]?.trim();

  return value && value.length > 0 ? value : undefined;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function assertPublicBaseUrl(value: string, envKey: string): void {
  if (value.startsWith("/api/v1/uploads")) {
    return;
  }

  try {
    const parsed = new URL(value);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("invalid protocol");
    }
  } catch {
    throw new Error(`${envKey} must be a valid http(s) URL or /api/v1/uploads path.`);
  }
}
