import { describe, expect, it } from "vitest";
import {
  getImageStorageConfig,
  getImageStorageConfigPreview
} from "../src/services/image-storage.service.js";

describe("image storage service", () => {
  it("defaults to local storage when no driver is configured", () => {
    const config = getImageStorageConfig({});

    expect(config.driver).toBe("local");
  });

  it("returns safe local preview without secrets", () => {
    const preview = getImageStorageConfigPreview({});

    expect(preview.driver).toBe("local");
    expect(preview.localFallback).toBe(true);
    expect(preview.publicBaseUrl).toBeNull();
    expect(preview.s3Configured).toBe(false);
  });

  it("parses s3 compatible storage config", () => {
    const config = getImageStorageConfig({
      IMAGE_STORAGE_DRIVER: "s3",
      IMAGE_STORAGE_PUBLIC_BASE_URL: "https://cdn.example.test/babyloop",
      S3_ACCESS_KEY_ID: "access",
      S3_BUCKET: "babyloop-images",
      S3_ENDPOINT: "https://r2.example.test",
      S3_FORCE_PATH_STYLE: "true",
      S3_REGION: "auto",
      S3_SECRET_ACCESS_KEY: "secret"
    });

    expect(config.driver).toBe("s3");
    expect(config.bucket).toBe("babyloop-images");
    expect(config.publicBaseUrl).toBe("https://cdn.example.test/babyloop");
    expect(config.forcePathStyle).toBe(true);
  });

  it("rejects incomplete s3 configuration", () => {
    expect(() =>
      getImageStorageConfig({
        IMAGE_STORAGE_DRIVER: "s3",
        IMAGE_STORAGE_PUBLIC_BASE_URL: "https://cdn.example.test"
      })
    ).toThrow("S3_BUCKET is required");
  });

  it("rejects unknown drivers", () => {
    expect(() => getImageStorageConfig({ IMAGE_STORAGE_DRIVER: "memory" })).toThrow(
      "IMAGE_STORAGE_DRIVER must be local or s3."
    );
  });
});
