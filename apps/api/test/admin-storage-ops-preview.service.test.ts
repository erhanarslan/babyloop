import { describe, expect, it } from "vitest";
import {
  assertExternalStorageDisabled,
  getAdminStorageOpsPreview
} from "../src/services/admin-storage-ops-preview.service.js";

describe("admin storage ops preview", () => {
  it("keeps external storage providers disabled", () => {
    const preview = getAdminStorageOpsPreview();

    expect(preview).toMatchObject({
      status: "local_only",
      localStorageEnabled: true,
      externalStorageEnabled: false,
      storageProviderConfigured: false,
      s3Enabled: false,
      r2Enabled: false,
      signedUploadEnabled: false,
      publicBucketEnabled: false,
      cdnPurgeEnabled: false,
      queueEnabled: false,
      imageSafetyRequired: true,
      moderationQuarantineRequired: true,
      maxListingImages: 5
    });
    expect(preview.blockedOperations).toEqual(
      expect.arrayContaining([
        "s3_upload",
        "r2_upload",
        "signed_upload",
        "bucket_delete",
        "object_copy",
        "cdn_purge",
        "queue_worker"
      ])
    );
    expect(preview.warning).toContain("no S3/R2 provider call");
    expect(JSON.stringify(preview)).not.toMatch(/AWS_SECRET_ACCESS_KEY_VALUE|S3_BUCKET_NAME_SECRET|R2_ACCESS_KEY_SECRET|signed-url-secret-value|presigned-post-secret-value|delete-object-secret-value|copy-object-secret-value|cdn-purge-secret-value|queue-add-secret-value|fetch-called-secret-value|raw-upload-body-secret-value|gps-location-secret-value/iu);
  });

  it("lists requirements before external object storage", () => {
    const preview = getAdminStorageOpsPreview();
    const requirementKeys = preview.requirements.map((requirement) => requirement.key);

    expect(requirementKeys).toEqual(
      expect.arrayContaining([
        "provider_selection",
        "private_bucket_policy",
        "signed_upload_contract",
        "image_safety_pipeline",
        "exif_strip",
        "moderation_quarantine",
        "object_lifecycle_cleanup",
        "admin_audit",
        "cdn_cache_policy",
        "migration_replay_plan"
      ])
    );
    expect(preview.requirements.every((requirement) => requirement.requiredBeforeExternalStorage)).toBe(true);
    expect(preview.requirements.find((requirement) => requirement.key === "image_safety_pipeline")?.status).toBe("complete");
    expect(preview.requirements.find((requirement) => requirement.key === "signed_upload_contract")?.status).toBe("missing");
  });

  it("exposes a compact external-storage-disabled assertion for release gates", () => {
    expect(assertExternalStorageDisabled()).toEqual({
      localStorageEnabled: true,
      externalStorageEnabled: false,
      storageProviderConfigured: false,
      signedUploadEnabled: false,
      queueEnabled: false
    });
  });
});
