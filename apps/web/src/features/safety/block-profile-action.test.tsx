import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../lib/i18n/i18n-provider";
import { blockProfile, unblockProfile } from "./api";
import { BlockProfileAction } from "./block-profile-action";

vi.mock("./api", () => ({
  blockProfile: vi.fn(),
  unblockProfile: vi.fn()
}));

function renderAction(initialBlocked = false) {
  const onBlockedChange = vi.fn();
  render(
    <I18nProvider>
      <BlockProfileAction
        apiBaseUrl="http://api.test"
        initialBlocked={initialBlocked}
        profileId="profile-private-id"
        onBlockedChange={onBlockedChange}
      />
    </I18nProvider>
  );

  return { onBlockedChange };
}

describe("BlockProfileAction", () => {
  beforeEach(() => {
    vi.mocked(blockProfile).mockReset();
    vi.mocked(unblockProfile).mockReset();
  });

  it("blocks and unblocks a profile without rendering private ids", async () => {
    vi.mocked(blockProfile).mockResolvedValueOnce({
      ok: true,
      data: {
        blockedProfile: {
          id: "blocked-row-id",
          displayName: "Ayşe Demir",
          blockedAt: "2026-06-20T10:00:00.000Z"
        },
        created: true
      }
    });
    const { onBlockedChange } = renderAction(false);

    fireEvent.click(screen.getByRole("button", { name: "Kullanıcıyı engelle" }));

    expect(await screen.findByText("Kullanıcı engellendi.")).toBeInTheDocument();
    expect(blockProfile).toHaveBeenCalledWith("http://api.test", "profile-private-id");
    expect(onBlockedChange).toHaveBeenCalledWith(true);
    expect(screen.queryByText("profile-private-id")).not.toBeInTheDocument();

    vi.mocked(unblockProfile).mockResolvedValueOnce({
      ok: true,
      data: {
        removed: true
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Engeli kaldır" }));

    expect(await screen.findByText("Kullanıcı engeli kaldırıldı.")).toBeInTheDocument();
    expect(unblockProfile).toHaveBeenCalledWith("http://api.test", "profile-private-id");
  });

  it("disables the button while pending and renders controlled failures", async () => {
    vi.mocked(blockProfile).mockResolvedValueOnce({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "<script>alert('x')</script>"
      }
    });
    renderAction(false);

    fireEvent.click(screen.getByRole("button", { name: "Kullanıcıyı engelle" }));

    await waitFor(() => {
      expect(screen.getByText("Bu işlem için erişimin yok.")).toBeInTheDocument();
    });
    expect(screen.queryByText("<script>alert('x')</script>")).not.toBeInTheDocument();
    expect(document.querySelector("script")).not.toBeInTheDocument();
  });
});
