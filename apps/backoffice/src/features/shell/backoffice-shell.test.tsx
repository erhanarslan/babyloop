import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { BackofficeShell } from "./backoffice-shell";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/rag"
}));

describe("BackofficeShell", () => {
  it("renders grouped active navigation without exposing secrets", () => {
    render(
      <BackofficeShell>
        <h2>Email Ops</h2>
      </BackofficeShell>
    );

    const navigation = screen.getByRole("complementary", { name: "Backoffice navigation" });

    expect(within(navigation).getByRole("link", { name: "Email Operasyonları" })).toHaveAttribute(
      "href",
      "/email"
    );
    expect(
      within(navigation).getByRole("link", { name: "RAG Yönetimi" })
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(navigation).getByRole("link", { name: "Storage" })
    ).toHaveAttribute("href", "/storage");
    expect(within(navigation).getByRole("link", { name: "Veri Kalitesi" })).toHaveAttribute(
      "href",
      "/analytics/data-quality"
    );
    expect(screen.queryByText("Reports")).not.toBeInTheDocument();
    expect(screen.queryByText("Safety Events")).not.toBeInTheDocument();
    expect(screen.queryByText(/RESEND_API_KEY/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/SMTP_PASS/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/password/i)).not.toBeInTheDocument();
  });
});
