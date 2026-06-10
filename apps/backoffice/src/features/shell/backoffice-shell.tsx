import Link from "next/link";
import type { ReactNode } from "react";

type BackofficeShellProps = {
  children: ReactNode;
};

const navigationItems = [
  {
    label: "Dashboard",
    href: "/",
    description: "Operational overview",
  },
  {
    label: "Moderation",
    href: "/moderation",
    description: "Cases and reports",
  },
  {
    label: "Users",
    href: "/users",
    description: "User management",
  },
  {
    label: "Listings",
    href: "/listings",
    description: "Listing operations",
  },
  {
    label: "Messages",
    href: "/messages",
    description: "Conversation safety",
  },
  {
    label: "Reports",
    href: "/reports",
    description: "Report triage",
  },
  {
    label: "Safety Events",
    href: "/safety-events",
    description: "Trust & safety signals",
  },
  {
    label: "Audit Logs",
    href: "/audit",
    description: "Admin action history",
  },
  {
    label: "AI Tools",
    href: "/ai",
    description: "AI-assisted operations",
  },
];

export function BackofficeShell({ children }: BackofficeShellProps) {
  return (
    <div className="backoffice-shell">
      <aside className="backoffice-sidebar" aria-label="Backoffice navigation">
        <div className="brand-block">
          <p className="brand-eyebrow">BabyLoop</p>
          <h1>Backoffice</h1>
        </div>

        <nav className="sidebar-nav">
          {navigationItems.map((item) => (
            <Link className="sidebar-link" href={item.href} key={item.href}>
              <span>{item.label}</span>
              <small>{item.description}</small>
            </Link>
          ))}
        </nav>
      </aside>

      <div className="backoffice-main-column">
        <header className="backoffice-topbar">
          <div>
            <p className="topbar-eyebrow">Operations Console</p>
            <strong>Moderation, trust & safety, support, audit, and AI tools</strong>
          </div>

          <div className="topbar-status" aria-label="Backoffice status">
            Foundation ready
          </div>
        </header>

        <main className="backoffice-content">{children}</main>
      </div>
    </div>
  );
}
