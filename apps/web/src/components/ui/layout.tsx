import type { ReactNode } from "react";
import { SiteHeader } from "../site-header";

type SiteShellProps = {
  children: ReactNode;
};

export function SiteShell({ children }: SiteShellProps) {
  return (
    <main className="app-shell">
      <SiteHeader />
      {children}
    </main>
  );
}

type PageContainerProps = {
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
};

export function PageContainer({ ariaLabel, children, className = "" }: PageContainerProps) {
  return (
    <section
      className={`section page-container ${className}`.trim()}
      aria-label={ariaLabel}
    >
      {children}
    </section>
  );
}

type PageHeadingProps = {
  eyebrow: string;
  title: string;
  description?: string;
};

export function PageHeading({ description, eyebrow, title }: PageHeadingProps) {
  return (
    <section className="section page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </section>
  );
}
