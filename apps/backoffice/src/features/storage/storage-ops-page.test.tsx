import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StorageOpsPage } from "./storage-ops-page";

const fetchMock = vi.fn();

global.fetch = fetchMock;

describe("StorageOpsPage", () => {
  afterEach(() => {
    fetchMock.mockReset();
  });

  it("renders secret-safe storage ops preview without enabling destructive operations", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          imageStorage: {
            driver: "local",
            localFallback: true,
            publicBaseUrl: null,
            s3Configured: false
          },
          uploadRoute: {
            localRouteEnabled: true,
            routePrefix: "/api/v1/uploads/listings",
            note: "Local driver için API dosya stream route'u aktif kalır."
          },
          warning:
            "Bu endpoint credential veya secret döndürmez. Sadece hangi storage driver'ın aktif olduğunu gösterir."
        }
      })
    });

    render(<StorageOpsPage apiBaseUrl="http://localhost:4000" />);

    expect(await screen.findByText("Güvenli dosya ve medya görünürlüğü")).toBeInTheDocument();
    expect(screen.getAllByText("Local").length).toBeGreaterThan(0);
    expect(screen.getByText("Dış bucket/provider alanları eksik veya kapalı.")).toBeInTheDocument();
    expect(screen.getByText("/api/v1/uploads/listings")).toBeInTheDocument();
    expect(screen.getAllByText("Bu endpoint’te gösterilmez")).toHaveLength(2);
    expect(screen.getByText(/Bucket delete, object copy, CDN purge/iu)).toBeInTheDocument();
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
      expect(screen.getByText(/Storage operasyon durumu yüklenemedi/iu)).toBeInTheDocument();
    });
  });
});
