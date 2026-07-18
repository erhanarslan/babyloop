"use client";

import {
  useId,
  useState,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes
} from "react";

const TEXT_INPUT_CLASS =
  "min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const TEXTAREA_CLASS =
  "min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const SELECT_CLASS =
  "min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  labelClassName?: string;
  wide?: boolean;
};

export function TextInput({
  className,
  id,
  label,
  labelClassName,
  type,
  wide,
  ...props
}: TextInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const isPassword = type === "password";
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const resolvedType = isPassword && isPasswordVisible ? "text" : type;

  return (
    <label
      className={
        labelClassName ??
        joinClassNames(
          "form-field grid gap-2 text-sm font-medium text-foreground",
          wide && "form-field-wide"
        )
      }
      htmlFor={inputId}
    >
      <span>{label}</span>

      {isPassword ? (
        <div className="password-input-control relative">
          <input
            {...props}
            className={joinClassNames(TEXT_INPUT_CLASS, "pr-12", className)}
            id={inputId}
            type={resolvedType}
          />
          <button
            aria-controls={inputId}
            aria-label={isPasswordVisible ? "Şifreyi gizle" : "Şifreyi göster"}
            aria-pressed={isPasswordVisible}
            className="password-visibility-toggle absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-transparent text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
            data-password-visibility-icon={isPasswordVisible ? "eye-off" : "eye"}
            disabled={props.disabled}
            title={isPasswordVisible ? "Şifreyi gizle" : "Şifreyi göster"}
            type="button"
            onClick={() => setIsPasswordVisible((current) => !current)}
            onMouseDown={(event) => event.preventDefault()}
          >
            {isPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      ) : (
        <input
          {...props}
          className={joinClassNames(TEXT_INPUT_CLASS, className)}
          id={inputId}
          type={type}
        />
      )}
    </label>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  wide?: boolean;
};

export function Textarea({
  className,
  label,
  wide,
  ...props
}: TextareaProps) {
  return (
    <label
      className={joinClassNames(
        "form-field grid gap-2 text-sm font-medium text-foreground",
        wide && "form-field-wide"
      )}
    >
      <span>{label}</span>
      <textarea
        {...props}
        className={joinClassNames(TEXTAREA_CLASS, className)}
      />
    </label>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  wide?: boolean;
};

export function Select({
  children,
  className,
  label,
  wide,
  ...props
}: SelectProps) {
  return (
    <label
      className={joinClassNames(
        "form-field grid gap-2 text-sm font-medium text-foreground",
        wide && "form-field-wide"
      )}
    >
      <span>{label}</span>
      <select
        {...props}
        className={joinClassNames(SELECT_CLASS, className)}
      >
        {children}
      </select>
    </label>
  );
}

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      viewBox="0 0 24 24"
      width="20"
    >
      <path
        d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle
        cx="12"
        cy="12"
        r="2.75"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      viewBox="0 0 24 24"
      width="20"
    >
      <path
        d="m3 3 18 18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M10.6 5.65A10.9 10.9 0 0 1 12 5.55c6 0 9.5 6.45 9.5 6.45a15.8 15.8 0 0 1-3 3.75M6.1 6.25C3.75 8 2.5 12 2.5 12s3.5 6.45 9.5 6.45c1.45 0 2.75-.38 3.9-.95"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M9.8 9.8a3.1 3.1 0 0 0 4.4 4.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function joinClassNames(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(" ");
}
