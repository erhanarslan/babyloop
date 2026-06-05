import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: "article" | "aside" | "div" | "section";
  children: ReactNode;
  className?: string;
};

export function Card({ as: Component = "div", children, className = "", ...props }: CardProps) {
  return (
    <Component
      className={cn(
        "ui-card rounded-lg border border-border bg-card text-card-foreground shadow-soft",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

type BadgeProps = {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning";
};

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return (
    <span
      className={cn(
        `ui-badge ui-badge-${tone}`,
        "inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold"
      )}
    >
      {children}
    </span>
  );
}

type AlertProps = {
  message: string;
  title: string;
  tone?: "error" | "info";
};

export function Alert({ message, title, tone = "error" }: AlertProps) {
  return (
    <div
      className={cn(
        `ui-alert ui-alert-${tone}`,
        "grid gap-2 rounded-md border p-4 text-sm",
        tone === "info"
          ? "border-primary/25 bg-primary/10 text-foreground"
          : "border-destructive/25 bg-destructive/10 text-foreground"
      )}
      role="status"
    >
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="leading-6 text-muted-foreground">{message}</p>
    </div>
  );
}

type EmptyStateProps = {
  actionHref?: string | undefined;
  actionLabel?: string | undefined;
  message?: string | undefined;
  title: string;
};

export function EmptyState({ actionHref, actionLabel, message, title }: EmptyStateProps) {
  return (
    <div className="empty-state grid gap-3 rounded-lg border border-dashed border-border bg-card/80 p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      {message ? <p className="text-sm leading-6 text-muted-foreground">{message}</p> : null}
      {actionHref && actionLabel ? (
        <Link
          className="primary-link inline-flex w-fit items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          href={actionHref}
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

type LoadingBlockProps = {
  message?: string;
  title: string;
};

export function LoadingBlock({ message, title }: LoadingBlockProps) {
  return (
    <div className="empty-state grid gap-3 rounded-lg border border-border bg-card/80 p-6" role="status">
      <h2 className="text-xl font-semibold">{title}</h2>
      {message ? <p className="text-sm leading-6 text-muted-foreground">{message}</p> : null}
    </div>
  );
}
