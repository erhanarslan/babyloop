import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";

type SiteShellProps = {
  children: ReactNode;
};

export function SiteShell({ children }: SiteShellProps) {
  return (
    <>
      <main className="app-shell flex min-h-screen flex-col bg-background text-foreground">
        <SiteHeader />
        <div className="app-content flex-1">{children}</div>
        <SiteFooter />
      </main>
    </>
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
      className={cn("section page-container mx-auto w-full max-w-7xl px-5 py-14 sm:px-8 lg:px-10", className)}
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
    <section className="section page-heading mx-auto w-full max-w-7xl px-5 pb-8 pt-14 sm:px-8 lg:px-10">
      <p className="eyebrow mb-3 text-sm font-semibold uppercase tracking-wide text-primary">{eyebrow}</p>
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          {description}
        </p>
      ) : null}
    </section>
  );
}
