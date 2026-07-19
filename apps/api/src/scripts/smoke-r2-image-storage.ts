import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getImageStorageConfig } from "../services/image-storage.service.js";

async function main(): Promise<void> {
  if (!readBoolean(process.env.IMAGE_STORAGE_R2_SMOKE_ALLOW_WRITE)) {
    throw new Error(
      "Set IMAGE_STORAGE_R2_SMOKE_ALLOW_WRITE=true to permit the temporary R2 smoke object."
    );
  }

  const config = getImageStorageConfig();

  if (config.driver !== "s3") {
    throw new Error("IMAGE_STORAGE_DRIVER=s3 is required for the R2 storage smoke.");
  }

  if (!config.endpoint) {
    throw new Error("S3_ENDPOINT is required for the Cloudflare R2 storage smoke.");
  }

  const client = new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    },
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    region: config.region
  });
  const objectKey = `smoke/r2-connectivity/${randomUUID()}.txt`;
  const expectedBody = `babyloop-r2-smoke:${randomUUID()}`;
  let objectCreated = false;

  try {
    await client.send(new PutObjectCommand({
      Body: expectedBody,
      Bucket: config.bucket,
      CacheControl: "no-store",
      ContentType: "text/plain; charset=utf-8",
      Key: objectKey
    }));
    objectCreated = true;

    const response = await client.send(new GetObjectCommand({
      Bucket: config.bucket,
      Key: objectKey
    }));
    const receivedBody = await response.Body?.transformToString();

    if (receivedBody !== expectedBody) {
      throw new Error("R2 smoke object content did not round-trip correctly.");
    }

    console.log(JSON.stringify({
      ok: true,
      driver: "s3",
      endpointHost: new URL(config.endpoint).hostname,
      publicHost: new URL(config.publicBaseUrl).hostname,
      bucketConfigured: true,
      writeReadDelete: true
    }, null, 2));
  } finally {
    if (objectCreated) {
      await client.send(new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: objectKey
      }));
    }
  }
}

function readBoolean(value: string | undefined): boolean {
  return value === "1" || value?.trim().toLowerCase() === "true";
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "R2 storage smoke failed.";
  console.error(message.replace(/[A-Z0-9]{20,}/giu, "[redacted]"));
  process.exitCode = 1;
});
