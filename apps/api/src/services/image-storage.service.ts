import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { SafeImage } from "./image-safety.service.js";
import {
  deleteStoredListingImage as deleteLocalStoredListingImage,
  storeListingImage as storeLocalListingImage,
  type StoredListingImage as LocalStoredListingImage
} from "./local-image-storage.service.js";

export type ImageStorageDriver = "local" | "s3";

export type StoredListingImage = {
  filePath?: string;
  objectKey?: string;
  storageDriver: ImageStorageDriver;
  url: string;
};

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

  assertHttpUrl(publicBaseUrl, "IMAGE_STORAGE_PUBLIC_BASE_URL");

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

export async function storeListingImage(input: {
  env?: NodeJS.ProcessEnv;
  image: SafeImage;
  listingId: string;
  uploadRoot: string;
}): Promise<StoredListingImage> {
  const config = getImageStorageConfig(input.env);

  if (config.driver === "local") {
    const stored = await storeLocalListingImage({
      image: input.image,
      listingId: input.listingId,
      uploadRoot: input.uploadRoot
    });

    return fromLocalStoredImage(stored);
  }

  return storeS3ListingImage({
    config,
    image: input.image,
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
}

async function storeS3ListingImage(input: {
  config: S3ImageStorageConfig;
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

function fromLocalStoredImage(stored: LocalStoredListingImage): StoredListingImage {
  return {
    filePath: stored.filePath,
    storageDriver: "local",
    url: stored.url
  };
}

function resolveS3ObjectKeyFromPublicUrl(publicBaseUrl: string, url: string): string | null {
  if (!url.startsWith(`${publicBaseUrl}/`)) {
    return null;
  }

  const key = url.slice(publicBaseUrl.length + 1);

  return key.length > 0 && !key.includes("..") ? key : null;
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

function assertHttpUrl(value: string, envKey: string): void {
  try {
    const parsed = new URL(value);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("invalid protocol");
    }
  } catch {
    throw new Error(`${envKey} must be a valid http(s) URL.`);
  }
}
