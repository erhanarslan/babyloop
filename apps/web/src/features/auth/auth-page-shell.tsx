"use client";

import type { ReactNode } from "react";
import { Card, PageContainer } from "../../components/ui";
import type { Dictionary } from "../../lib/i18n/dictionaries";
import { useI18n } from "../../lib/i18n/i18n-provider";

type AuthPageKind =
  | "callback"
  | "forgot"
  | "login"
  | "password"
  | "register"
  | "requestVerify"
  | "reset"
  | "verify";

type AuthPageShellProps = {
  ariaLabel: string;
  children: ReactNode;
  kind: AuthPageKind;
};

const pageCopyKeys = {
  callback: ["callbackTitle", "callbackDescription"],
  forgot: ["forgotTitle", "forgotDescription"],
  login: ["loginTitle", "loginDescription"],
  password: ["changePasswordTitle", "changePasswordDescription"],
  register: ["registerTitle", "registerDescription"],
  requestVerify: ["requestVerifyTitle", "requestVerifyDescription"],
  reset: ["resetTitle", "resetDescription"],
  verify: ["verifyTitle", "verifyDescription"]
} as const satisfies Record<AuthPageKind, readonly [keyof Dictionary["auth"], keyof Dictionary["auth"]]>;

const authHeroContext: Record<AuthPageKind, {
  badge: string;
  checks: string[];
  eyebrow: string;
}> = {
  callback: {
    badge: "Session",
    eyebrow: "Authentication",
    checks: [
      "Finalizes the provider callback",
      "Refreshes the protected session",
      "Redirects only after session validation"
    ]
  },
  forgot: {
    badge: "Recovery",
    eyebrow: "Account recovery",
    checks: [
      "Does not reveal whether an account exists",
      "Uses official BabyLoop recovery flow",
      "Recovery links and tokens must stay private"
    ]
  },
  login: {
    badge: "Secure access",
    eyebrow: "Account sign in",
    checks: [
      "Cookie-backed session handling",
      "Access token is kept in memory",
      "Protected actions use authenticated requests"
    ]
  },
  password: {
    badge: "Security",
    eyebrow: "Account security",
    checks: [
      "Requires the current password",
      "Ends active refresh sessions after change",
      "Keeps credentials out of messages and listings"
    ]
  },
  register: {
    badge: "Private profile",
    eyebrow: "Account creation",
    checks: [
      "Creates a marketplace profile",
      "Email verification can be completed separately",
      "Child planning uses age bands, not exact birth dates"
    ]
  },
  requestVerify: {
    badge: "Verification",
    eyebrow: "Email verification",
    checks: [
      "Uses an official verification request",
      "Does not expose account existence unnecessarily",
      "Verification links should not be shared"
    ]
  },
  reset: {
    badge: "New password",
    eyebrow: "Password reset",
    checks: [
      "Reset token is single-use",
      "New password should be unique",
      "Return to login after completion"
    ]
  },
  verify: {
    badge: "Verify",
    eyebrow: "Email verification",
    checks: [
      "Checks the verification token",
      "Finishes account confirmation",
      "Requests a new link when expired"
    ]
  }
};

export function AuthPageShell({ ariaLabel, children, kind }: AuthPageShellProps) {
  const { dictionary } = useI18n();
  const [titleKey, descriptionKey] = pageCopyKeys[kind];
  const context = authHeroContext[kind];

  return (
    <>
      <section className="auth-hero auth-hero-polished">
        <div>
          <p className="eyebrow">{context.eyebrow}</p>
          <h1>{dictionary.auth[titleKey]}</h1>
          <p>{dictionary.auth[descriptionKey]}</p>
        </div>

        <aside className="auth-hero-assurance" aria-label="Authentication safety summary">
          <span>{context.badge}</span>
          <strong>Designed for safer marketplace access</strong>
          <p>
            BabyLoop keeps account actions separated from public browsing and avoids exposing private recovery state.
          </p>
        </aside>
      </section>

      <PageContainer className="auth-layout auth-layout-polished" ariaLabel={ariaLabel}>
        <Card className="form-panel auth-panel auth-panel-polished">{children}</Card>

        <Card as="aside" className="auth-trust-rail" aria-label="Account safety checklist">
          <p className="eyebrow">Safety checklist</p>
          <h2>Before continuing</h2>
          <ul className="question-list">
            {context.checks.map((check) => (
              <li key={check}>{check}</li>
            ))}
          </ul>
        </Card>
      </PageContainer>
    </>
  );
}
