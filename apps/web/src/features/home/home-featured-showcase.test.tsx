import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ImgHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeFeaturedShowcase } from "./home-featured-showcase";

vi.mock("next/image", () => ({
  default: ({ alt, priority: _priority, ...props }: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  )
}));

function mockMotionPreference(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  });
}

describe("HomeFeaturedShowcase", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps the selected hero still when reduced motion is preferred", async () => {
    vi.useFakeTimers();
    mockMotionPreference(true);

    render(<HomeFeaturedShowcase />);

    const firstImage = screen.getByRole("img");

    await act(async () => undefined);
    act(() => vi.advanceTimersByTime(7500));

    expect(screen.getByRole("img")).toHaveAttribute("src", firstImage.getAttribute("src"));
  });

  it("lets the user choose a slide without relying on automatic motion", () => {
    mockMotionPreference(true);
    render(<HomeFeaturedShowcase />);

    fireEvent.click(screen.getByRole("button", { name: "3. görseli göster" }));

    expect(screen.getByRole("img")).toHaveAttribute("src", "/brand/home/home-hero-feeding.png");
  });
});
