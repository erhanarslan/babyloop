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
            note: "Yerel sürücü için API dosya akışı rotası etkin kalır."
          },
          warning:
            "Bu uç nokta kimlik bilgisi veya gizli değer döndürmez. Yalnız etkin depolama sürücüsünü gösterir."
        }
      })
    });

    render(<StorageOpsPage apiBaseUrl="http://localhost:4000" />);

    expect(await screen.findByText("Depolama durum görünümü")).toBeInTheDocument();
    expect(document.body.textContent).toContain("Yerel yedek sürücü aktif");
    expect(screen.getAllByText("Yerel").length).toBeGreaterThan(0);
    expect(screen.getByText("Dış kova veya sağlayıcı alanları eksik ya da kapalı.")).toBeInTheDocument();
    expect(screen.getByText("/api/v1/uploads/listings")).toBeInTheDocument();
    expect(screen.getAllByText("Bu uç noktada gösterilmez")).toHaveLength(2);
    expect(screen.getByText(/Kova silme, nesne kopyalama, CDN/iu)).toBeInTheDocument();
    expect(document.body.textContent).toContain("queue_worker");
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
      expect(screen.getByText("Depolama operasyon durumu yüklenemedi. Yetkiyi ve API erişimini kontrol et.")).toBeInTheDocument();
    });
  });
});
