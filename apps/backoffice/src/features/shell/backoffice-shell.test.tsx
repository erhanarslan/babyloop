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
      <BackofficeShell role="admin">
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

  it("shows only read-only viewer navigation and no synthetic readiness status", () => {
    render(
      <BackofficeShell role="backoffice_viewer">
        <h2>Viewer</h2>
      </BackofficeShell>
    );

    const navigation = screen.getByRole("complementary", { name: "Backoffice navigation" });
    expect(within(navigation).getByRole("link", { name: "İlanlar" })).toBeVisible();
    expect(within(navigation).getByRole("link", { name: "Profiller" })).toBeVisible();
    expect(within(navigation).queryByRole("link", { name: "Audit Logları" })).toBeNull();
    expect(within(navigation).queryByRole("link", { name: "Storage" })).toBeNull();
    expect(screen.getByText("Salt okunur")).toBeVisible();
    expect(screen.queryByText("Hazır")).toBeNull();
  });

  it("shows a clearly bounded preview shell without staff navigation", () => {
    render(
      <BackofficeShell accessMode="preview" role="user">
        <h2>Preview</h2>
      </BackofficeShell>
    );

    const navigation = screen.getByRole("complementary", { name: "Backoffice navigation" });
    expect(within(navigation).getByRole("link", { name: "İlanlar" })).toBeVisible();
    expect(within(navigation).getByRole("link", { name: "Profiller" })).toBeVisible();
    expect(within(navigation).queryByRole("link", { name: "Audit Logları" })).toBeNull();
    expect(within(navigation).queryByRole("link", { name: "AI Operasyonları" })).toBeNull();
    expect(screen.getByText("Tanıtım modu · Salt okunur")).toBeVisible();
    expect(
      screen.getByText(
        "Bu görünüm ürün tanıtımı içindir. Hassas veriler ve yönetim işlemleri kapalıdır."
      )
    ).toBeVisible();
  });

  it("does not show the preview banner to staff admins", () => {
    render(
      <BackofficeShell accessMode="staff" role="admin">
        <h2>Admin</h2>
      </BackofficeShell>
    );

    expect(screen.queryByText("Tanıtım modu · Salt okunur")).toBeNull();
    expect(screen.getByRole("link", { name: "Audit Logları" })).toBeVisible();
  });
});
