import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StorageOpsPage } from "./storage-ops-page";

const fetchMock = vi.fn();

global.fetch = fetchMock;

describe("StorageOpsPage", () => {
  afterEach(() => {
    fetchMock.mockReset();
  });

  it("renders local-only storage ops preview without enabling external storage", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
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
              key: "signed_upload_contract",
              label: "Signed upload/download URL contract",
              status: "missing",
              requiredBeforeExternalStorage: true
            }
          ],
          migrationStages: [
            {
              stage: "sandbox",
              status: "blocked",
              note: "Sandbox bucket/provider tests required."
            }
          ],
          privacyNote:
            "Storage ops preview never exposes object keys, bucket credentials, signed URLs, access tokens, cookies, raw upload body, EXIF metadata or user contact data.",
          warning:
            "Storage ops preview is local-only readiness metadata; no S3/R2 provider call, signed upload, bucket delete, object copy, CDN purge, queue worker or external storage mutation is enabled."
        }
      })
    });

    render(<StorageOpsPage apiBaseUrl="http://localhost:4000" />);

    expect(await screen.findByText("Required before external storage")).toBeInTheDocument();
    expect(screen.getAllByText("Storage Ops Preview").length).toBeGreaterThan(0);
    expect(screen.getByText(/External storage provider disabled/iu)).toBeInTheDocument();
    expect(screen.getByText(/S3\/R2, signed upload, bucket delete/iu)).toBeInTheDocument();
    expect(document.body.textContent).toContain("S3/R2, signed upload, bucket delete");
    expect(screen.getByText("Required before external storage")).toBeInTheDocument();
    expect(screen.getByText("Signed upload/download URL contract")).toBeInTheDocument();
    expect(screen.getByText("queue_worker")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/AWS_SECRET_ACCESS_KEY_VALUE|S3_BUCKET_NAME_SECRET|R2_ACCESS_KEY_SECRET|signed-url-secret-value|presigned-post-secret-value|raw-upload-body-secret-value|gps-location-secret-value/iu);

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/v1/admin/storage/ops-preview", {
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });
  });

  it("renders controlled fetch failures", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({})
    });

    render(<StorageOpsPage apiBaseUrl="http://localhost:4000" />);

    await waitFor(() => {
      expect(screen.getByText(/Storage ops preview failed: 403/iu)).toBeInTheDocument();
    });
  });
});
