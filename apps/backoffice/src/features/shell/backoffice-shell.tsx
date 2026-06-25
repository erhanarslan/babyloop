import Link from "next/link";
import type { ReactNode } from "react";

type BackofficeShellProps = {
  children: ReactNode;
};

type NavigationItem =
  | {
      description: string;
      href: string;
      label: string;
      status: "active";
    }
  | {
      description: string;
      label: string;
      status: "planned";
    };

const navigationItems: NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/",
    description: "Operational overview",
    status: "active",
  },
  {
    label: "Moderation",
    href: "/moderation",
    description: "Cases and reports",
    status: "active",
  },
  {
    label: "Listings",
    href: "/listings",
    description: "Listing operations",
    status: "active",
  },
  {
    label: "Analytics",
    href: "/product-analytics",
    description: "Product discovery signals",
    status: "active",
  },
  {
    label: "Profiles",
    href: "/profiles",
    description: "Profile risk directory",
    status: "active",
  },
  {
    label: "Messages",
    href: "/conversations",
    description: "Conversation safety",
    status: "active",
  },
  {
    label: "Reports",
    description: "Report triage",
    status: "planned",
  },
  {
    label: "Safety Events",
    description: "Trust & safety signals",
    status: "planned",
  },
  {
    label: "Audit Logs",
    href: "/audit",
    description: "Admin action history",
    status: "active",
  },
  {
    label: "AI Tools",
    href: "/ai-ops",
    description: "AI-assisted operations",
    status: "active",
  },
  {
    label: "RAG",
    href: "/rag",
    description: "Knowledge base ops",
    status: "active",
  },
  {
    label: "Email Ops",
    href: "/email",
    description: "Provider, SMTP, test send",
    status: "active",
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
            item.status === "active" ? (
              <Link className="sidebar-link" href={item.href} key={item.label}>
                <span>{item.label}</span>
                <small>{item.description}</small>
              </Link>
            ) : (
              <div
                aria-disabled="true"
                className="sidebar-link sidebar-link-disabled"
                key={item.label}
              >
                <span>
                  {item.label}
                  <em>Planned</em>
                </span>
                <small>{item.description}</small>
              </div>
            )
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
