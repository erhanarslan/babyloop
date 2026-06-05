import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";
import { cn } from "../../lib/utils";

type FieldShellProps = {
  label: string;
  wide?: boolean;
  children: ReactNode;
};

function FieldShell({ children, label, wide = false }: FieldShellProps) {
  return (
    <label
      className={cn(
        "form-field grid gap-2 text-sm font-medium text-foreground",
        wide && "form-field-wide"
      )}
    >
      <span className="text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  wide?: boolean;
};

export function TextInput({ label, wide, ...props }: TextInputProps) {
  return (
    <FieldShell label={label} wide={wide ?? false}>
      <input
        className="min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
    </FieldShell>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  wide?: boolean;
};

export function Textarea({ label, wide, ...props }: TextareaProps) {
  return (
    <FieldShell label={label} wide={wide ?? false}>
      <textarea
        className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
    </FieldShell>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  wide?: boolean;
};

export function Select({ children, label, wide, ...props }: SelectProps) {
  return (
    <FieldShell label={label} wide={wide ?? false}>
      <select
        className="min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}
