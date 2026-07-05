import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationOpsPage } from "./notification-ops-page";

const apiBaseUrl = "http://api.test";

describe("NotificationOpsPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders draft-only ops preview, delivery log aggregates, and avoids secret leakage", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            summary: {
              status: "draft_only",
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
            nextSteps: ["Add sender transitions"],
            policyPreview: {
              sendEnabled: false,
              draftOnly: true,
              defaultFrequencyWindowHours: 24,
              childLifecycleFrequencyWindowHours: 720,
              savedSearchFrequencyWindowHours: 24,
              requiredBeforeSend: ["Dedup"]
            },
            transitionPreview: {
              draftOnly: true,
              deliveryAllowed: false,
              allowedDraftOnlyTransitions: [
                { from: "candidate", to: "skipped", reason: "draft_only_skip" }
              ],
              futureSenderTransitions: [
                { from: "candidate", to: "sent", blockedUntil: ["provider sandbox"] }
              ],
              terminalStatuses: ["sent", "failed", "skipped"],
              privacyNote:
                "Transition preview aggregate/policy bilgisidir; metadata, idempotency key, dedup key, e-mail, token, cookie, authorization veya raw body göstermez."
            },
            pushReadinessPreview: {
              status: "blocked",
              deliveryAllowed: false,
              draftOnly: true,
              pushSenderEnabled: false,
              providerConfigured: false,
              tokenRegistryEnabled: false,
              tokenCollectionAllowed: false,
              consentRequired: true,
              auditRequired: true,
              idempotencyRequired: true,
              rateLimitRequired: true,
              requirements: [
                { key: "native_device_token_registry", label: "Native device token registry", status: "missing", requiredBeforeSend: true }
              ],
              blockedReasons: ["push_sender_disabled"],
              rolloutStages: [
                { stage: "registry", status: "planned", note: "Token registry plan" }
              ],
              warning:
                "Native push readiness preview yalnızca planlama/ops görünürlüğüdür; Expo, Firebase, APNs, push provider, queue, n8n veya webhook çağrısı yapmaz."
            },
            deliveryLogPreview: {
              enabled: true,
              draftOnly: true,
              totals: {
                all: 2,
                candidate: 1,
                blocked: 1,
                sent: 0,
                failed: 0,
                skipped: 0
              },
              byKind: [{ kind: "saved_search", count: 1 }],
              byChannel: [{ channel: "in_app", count: 1 }],
              byStatus: [{ status: "candidate", count: 1 }],
              recent: [
                {
                  kind: "saved_search",
                  sourceType: "saved_search",
                  sourceRef: "saved…ing-1",
                  channel: "in_app",
                  status: "candidate",
                  deliveryAllowed: false,
                  draftOnly: true,
                  blockedReasons: ["delivery_disabled"],
                  frequencyWindowHours: 24,
                  createdAt: "2026-07-05T00:00:00.000Z"
                }
              ],
              privacyNote:
                "Preview yalnızca aggregate count ve redacted sourceRef döndürür; metadata, idempotency key, dedup key, e-mail, token, cookie, authorization veya raw body göstermez."
            },
            warning:
              "Bu endpoint operasyonel önizlemedir. Email, push, n8n, queue veya in-app notification gönderimi yapmaz."
          }
        }),
        { status: 200 }
      )
    );

    render(<NotificationOpsPage apiBaseUrl={apiBaseUrl} />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(`${apiBaseUrl}/api/v1/admin/notifications/ops-preview`, {
        credentials: "include"
      });
    });

    expect(await screen.findByText("Notification Ops Preview")).toBeInTheDocument();
    expect(screen.getAllByText("Draft-only").length).toBeGreaterThan(0);
    expect(screen.getByText("Delivery log preview")).toBeInTheDocument();
    expect(screen.getByText("Transition model")).toBeInTheDocument();
    expect(screen.getByText("Native push readiness")).toBeInTheDocument();
    expect(screen.getByText(/Push sender kapalı/iu)).toBeInTheDocument();
    expect(screen.getByText(/Expo\/Firebase\/APNs çağrısı yok/iu)).toBeInTheDocument();
    expect(document.body.textContent).toContain("Expo/Firebase/APNs çağrısı yok");
    expect(screen.getByText("candidate → skipped")).toBeInTheDocument();
    expect(screen.getByText(/sent\/failed future sender gerektirir/iu)).toBeInTheDocument();
    expect(document.body.textContent).toContain("sent/failed future sender gerektirir");
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getAllByText("saved_search").length).toBeGreaterThan(0);
    expect(screen.getByText("saved_search:saved…ing-1")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/api[_-]?key|password|secret|parent@example|accessToken|refreshToken|secret-idempotency|secret-dedup/iu);
  });

  it("renders controlled fetch failures", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network"));

    render(<NotificationOpsPage apiBaseUrl={apiBaseUrl} />);

    expect(await screen.findByText("Notification ops preview yüklenemedi.")).toBeInTheDocument();
  });
});
