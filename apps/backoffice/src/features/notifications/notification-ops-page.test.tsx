import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationOpsPage } from "./notification-ops-page";

describe("NotificationOpsPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders draft-only ops preview and avoids secret leakage", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            summary: {
              totalDraftCandidates: 3,
              childLifecycleCandidates: 1,
              savedSearchCandidates: 2,
              draftOnly: true
            },
            deliveryPolicy: {
              sendEnabled: false,
              queueEnabled: false,
              emailEnabled: false,
              pushEnabled: false,
              n8nEnabled: false,
              dedupRequired: true,
              frequencyLimitRequired: true
            },
            channels: [
              {
                key: "in_app",
                label: "In-app",
                status: "draft_only",
                note: "Preview only"
              }
            ],
            nextSteps: ["Add delivery log"],
            policyPreview: {
              sendEnabled: false,
              draftOnly: true,
              defaultFrequencyWindowHours: 24,
              childLifecycleFrequencyWindowHours: 72,
              savedSearchFrequencyWindowHours: 24,
              requiredBeforeSend: ["Dedup"]
            },
            warning: "Draft only mode."
          }
        }),
        { status: 200 }
      )
    );

    render(<NotificationOpsPage apiBaseUrl="http://api.test" />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "http://api.test/api/v1/admin/notifications/ops-preview",
        { credentials: "include" }
      );
    });
    expect(await screen.findByText("Notification Ops Preview")).toBeInTheDocument();
    expect(screen.getByText("Draft-only")).toBeInTheDocument();
    expect(screen.queryByText(/api[_-]?key/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/password/i)).not.toBeInTheDocument();
  });

  it("renders controlled fetch failures", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network"));

    render(<NotificationOpsPage apiBaseUrl="http://api.test" />);

    expect(await screen.findByText("Notification ops preview yüklenemedi.")).toBeInTheDocument();
  });
});
