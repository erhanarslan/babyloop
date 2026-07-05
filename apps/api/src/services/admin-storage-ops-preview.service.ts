export type AdminStorageOpsPreviewRequirement = {
  key: string;
  label: string;
  status: "missing" | "planned" | "complete";
  requiredBeforeExternalStorage: true;
};

export type AdminStorageOpsPreview = {
  status: "local_only" | "blocked" | "ready_for_sandbox" | "ready_for_external_storage";
  localStorageEnabled: true;
  externalStorageEnabled: false;
  storageProviderConfigured: false;
  s3Enabled: false;
  r2Enabled: false;
  signedUploadEnabled: false;
  publicBucketEnabled: false;
  cdnPurgeEnabled: false;
  queueEnabled: false;
  imageSafetyRequired: true;
  moderationQuarantineRequired: true;
  maxListingImages: 5;
  allowedMimeTypes: string[];
  blockedOperations: Array<
    | "s3_upload"
    | "r2_upload"
    | "signed_upload"
    | "bucket_delete"
    | "object_copy"
    | "cdn_purge"
    | "queue_worker"
  >;
  requirements: AdminStorageOpsPreviewRequirement[];
  migrationStages: Array<{
    stage: "contract" | "sandbox" | "migration" | "production";
    status: "planned" | "blocked";
    note: string;
  }>;
  privacyNote: string;
  warning: string;
};

export function getAdminStorageOpsPreview(): AdminStorageOpsPreview {
  return {
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
    maxListingImages: 5,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    blockedOperations: [
      "s3_upload",
      "r2_upload",
      "signed_upload",
      "bucket_delete",
      "object_copy",
      "cdn_purge",
      "queue_worker"
    ],
    requirements: [
      {
        key: "provider_selection",
        label: "S3/R2 provider decision",
        status: "missing",
        requiredBeforeExternalStorage: true
      },
      {
        key: "private_bucket_policy",
        label: "Private bucket and least-privilege IAM policy",
        status: "missing",
        requiredBeforeExternalStorage: true
      },
      {
        key: "signed_upload_contract",
        label: "Signed upload/download URL contract",
        status: "missing",
        requiredBeforeExternalStorage: true
      },
      {
        key: "image_safety_pipeline",
        label: "Image safety pipeline",
        status: "complete",
        requiredBeforeExternalStorage: true
      },
      {
        key: "exif_strip",
        label: "EXIF/location metadata stripping",
        status: "planned",
        requiredBeforeExternalStorage: true
      },
      {
        key: "moderation_quarantine",
        label: "Moderation quarantine and review state",
        status: "complete",
        requiredBeforeExternalStorage: true
      },
      {
        key: "object_lifecycle_cleanup",
        label: "Object lifecycle cleanup and orphan detection",
        status: "missing",
        requiredBeforeExternalStorage: true
      },
      {
        key: "admin_audit",
        label: "Admin audit for restore/delete/migration actions",
        status: "planned",
        requiredBeforeExternalStorage: true
      },
      {
        key: "cdn_cache_policy",
        label: "CDN cache and purge policy",
        status: "missing",
        requiredBeforeExternalStorage: true
      },
      {
        key: "migration_replay_plan",
        label: "Local-to-object-storage migration replay plan",
        status: "missing",
        requiredBeforeExternalStorage: true
      }
    ],
    migrationStages: [
      {
        stage: "contract",
        status: "planned",
        note:
          "Storage contract, object key format, signed URL TTL, image safety handoff and privacy rules must be specified first."
      },
      {
        stage: "sandbox",
        status: "blocked",
        note:
          "Sandbox bucket/provider tests, fake object keys and delete/restore dry-run checks are required before external storage."
      },
      {
        stage: "migration",
        status: "blocked",
        note:
          "Local file inventory, orphan detection, replay scripts and rollback plan are required before migration."
      },
      {
        stage: "production",
        status: "blocked",
        note:
          "Production external storage requires private bucket policy, audit, observability, lifecycle cleanup and CDN policy."
      }
    ],
    privacyNote:
      "Storage ops preview never exposes object keys, bucket credentials, signed URLs, access tokens, cookies, raw upload body, EXIF metadata or user contact data.",
    warning:
      "Storage ops preview is local-only readiness metadata; no S3/R2 provider call, signed upload, bucket delete, object copy, CDN purge, queue worker or external storage mutation is enabled."
  };
}

export function assertExternalStorageDisabled(): {
  localStorageEnabled: true;
  externalStorageEnabled: false;
  storageProviderConfigured: false;
  signedUploadEnabled: false;
  queueEnabled: false;
} {
  const preview = getAdminStorageOpsPreview();

  return {
    localStorageEnabled: preview.localStorageEnabled,
    externalStorageEnabled: preview.externalStorageEnabled,
    storageProviderConfigured: preview.storageProviderConfigured,
    signedUploadEnabled: preview.signedUploadEnabled,
    queueEnabled: preview.queueEnabled
  };
}
