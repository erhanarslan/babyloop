import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CART_CHANGED_EVENT, fetchCartSummary } from "./api";
import { useHeaderCartSummary } from "./use-header-cart-summary";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();

  return {
    ...actual,
    fetchCartSummary: vi.fn()
  };
});

describe("useHeaderCartSummary", () => {
  beforeEach(() => {
    vi.mocked(fetchCartSummary).mockReset();
    vi.mocked(fetchCartSummary).mockResolvedValue({
      ok: true,
      data: {
        summary: {
          itemCount: 2,
          unavailableItemCount: 0
        }
      }
    });
  });

  it("does not request cart or CSRF state for a settled guest", async () => {
    const { rerender } = renderHook(
      ({ userId }) => useHeaderCartSummary("http://api.test", userId),
      { initialProps: { userId: null as string | null } }
    );

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 20));
    });
    rerender({ userId: null });

    expect(fetchCartSummary).not.toHaveBeenCalled();
  });

  it("loads once for login, stays settled for the same identity, and reloads on cart change", async () => {
    const { rerender, result } = renderHook(
      ({ userId }) => useHeaderCartSummary("http://api.test", userId),
      { initialProps: { userId: null as string | null } }
    );

    rerender({ userId: "user-1" });

    await waitFor(() => {
      expect(fetchCartSummary).toHaveBeenCalledTimes(1);
      expect(result.current).toBe(2);
    });

    rerender({ userId: "user-1" });
    expect(fetchCartSummary).toHaveBeenCalledTimes(1);

    act(() => window.dispatchEvent(new Event(CART_CHANGED_EVENT)));

    await waitFor(() => {
      expect(fetchCartSummary).toHaveBeenCalledTimes(2);
    });
  });

  it("settles a 401-style API result without looping until auth identity changes", async () => {
    vi.mocked(fetchCartSummary).mockResolvedValue({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication is required."
      }
    });
    const { rerender, result } = renderHook(
      ({ userId }) => useHeaderCartSummary("http://api.test", userId),
      { initialProps: { userId: "user-1" as string | null } }
    );

    await waitFor(() => expect(fetchCartSummary).toHaveBeenCalledTimes(1));
    rerender({ userId: "user-1" });

    expect(fetchCartSummary).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(0);
  });
});
