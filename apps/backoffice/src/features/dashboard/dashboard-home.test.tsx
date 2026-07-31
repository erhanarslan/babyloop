import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { BackofficeAccessProvider } from "../auth/backoffice-access";
import { DashboardHome } from "./dashboard-home";
import { getAdminDashboardSummary } from "./api";

vi.mock("next/link", () => ({
  default: ({
    children,
    href
  }: {
    children: ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>
}));

vi.mock("./api", () => ({
  getAdminDashboardSummary: vi.fn()
}));

describe("DashboardHome preview", () => {
  it("renders a non-sensitive landing without requesting operational statistics", () => {
    render(
      <BackofficeAccessProvider accessMode="preview" role="user">
        <DashboardHome />
      </BackofficeAccessProvider>
    );

    expect(screen.getByRole("heading", { name: "Ürün tanıtım görünümü" })).toBeVisible();
    expect(screen.getByRole("link", { name: /İlanları keşfet/ })).toHaveAttribute(
      "href",
      "/listings"
    );
    expect(screen.getByRole("link", { name: /Profil dizinini incele/ })).toHaveAttribute(
      "href",
      "/profiles"
    );
    expect(getAdminDashboardSummary).not.toHaveBeenCalled();
    expect(screen.queryByText("Open cases")).toBeNull();
  });
});
