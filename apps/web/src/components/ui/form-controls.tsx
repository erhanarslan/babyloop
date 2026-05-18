import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";

type FieldShellProps = {
  label: string;
  wide?: boolean;
  children: ReactNode;
};

function FieldShell({ children, label, wide = false }: FieldShellProps) {
  return (
    <label className={`form-field ${wide ? "form-field-wide" : ""}`.trim()}>
      <span>{label}</span>
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
      <input {...props} />
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
      <textarea {...props} />
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
      <select {...props}>{children}</select>
    </FieldShell>
  );
}
