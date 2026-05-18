import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: "article" | "aside" | "div" | "section";
  children: ReactNode;
  className?: string;
};

export function Card({ as: Component = "div", children, className = "", ...props }: CardProps) {
  return (
    <Component className={`ui-card ${className}`.trim()} {...props}>
      {children}
    </Component>
  );
}

type BadgeProps = {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning";
};

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return <span className={`ui-badge ui-badge-${tone}`}>{children}</span>;
}

type AlertProps = {
  message: string;
  title: string;
  tone?: "error" | "info";
};

export function Alert({ message, title, tone = "error" }: AlertProps) {
  return (
    <div className={`ui-alert ui-alert-${tone}`} role="status">
      <h2>{title}</h2>
      <p>{message}</p>
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
    <div className="empty-state">
      <h2>{title}</h2>
      {message ? <p>{message}</p> : null}
      {actionHref && actionLabel ? (
        <Link className="primary-link" href={actionHref}>
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
    <div className="empty-state" role="status">
      <h2>{title}</h2>
      {message ? <p>{message}</p> : null}
    </div>
  );
}
