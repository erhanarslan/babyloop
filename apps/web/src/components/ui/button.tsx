import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({
  className = "",
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  const variantClasses = {
    primary: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
    secondary: "border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "bg-transparent text-primary hover:bg-accent hover:text-accent-foreground"
  };

  return (
    <button
      className={cn(
        `ui-button ui-button-${variant}`,
        "inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-55",
        variantClasses[variant],
        className
      )}
      type={type}
      {...props}
    />
  );
}
