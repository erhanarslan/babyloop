import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./login/page";
import RegisterPage from "./register/page";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn()
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

describe("legacy auth routes", () => {
  beforeEach(() => {
    redirectMock.mockReset();
  });

  it("redirects /login to the home login modal", async () => {
    await LoginPage({ searchParams: Promise.resolve({}) });

    expect(redirectMock).toHaveBeenCalledExactlyOnceWith("/?auth=login");
  });

  it("redirects /register to the home register modal", async () => {
    await RegisterPage({ searchParams: Promise.resolve({}) });

    expect(redirectMock).toHaveBeenCalledExactlyOnceWith("/?auth=register");
  });
});
