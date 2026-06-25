import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StorageOpsPage } from "./storage-ops-page";

describe("StorageOpsPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders ops preview and uses credentialed requests without leaking secrets", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
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
              note: "Local route active"
            },
            warning: "Local storage is for development only."
          }
        }),
        { status: 200 }
      )
    );

    render(<StorageOpsPage apiBaseUrl="http://api.test" />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "http://api.test/api/v1/admin/storage/ops-preview",
        { credentials: "include" }
      );
    });
    expect(await screen.findByText("Storage Ops Preview")).toBeInTheDocument();
    expect(screen.getByText("LOCAL")).toBeInTheDocument();
    expect(screen.queryByText("AKIA_TEST_SECRET")).not.toBeInTheDocument();
    expect(screen.queryByText("admin-password")).not.toBeInTheDocument();
  });

  it("renders controlled fetch failures", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network"));

    render(<StorageOpsPage apiBaseUrl="http://api.test" />);

    expect(await screen.findByText("Storage ops preview yüklenemedi.")).toBeInTheDocument();
  });
});
