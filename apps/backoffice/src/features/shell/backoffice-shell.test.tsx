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

describe("BackofficeShell", () => {
  it("renders active and planned navigation without exposing secrets", () => {
    render(
      <BackofficeShell>
        <h2>Email Ops</h2>
      </BackofficeShell>
    );

    const navigation = screen.getByRole("complementary", { name: "Backoffice navigation" });

    expect(within(navigation).getByRole("link", { name: /Email Ops/i })).toHaveAttribute(
      "href",
      "/email"
    );
    expect(within(navigation).getByRole("link", { name: /RAG/i })).toHaveAttribute("href", "/rag");
    expect(screen.getByText("Reports").closest("[aria-disabled='true']")).toBeInTheDocument();
    expect(screen.getByText("Safety Events").closest("[aria-disabled='true']")).toBeInTheDocument();
    expect(screen.queryByText(/RESEND_API_KEY/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/SMTP_PASS/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/password/i)).not.toBeInTheDocument();
  });
});
