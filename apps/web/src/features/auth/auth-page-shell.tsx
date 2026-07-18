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

export function AuthPageShell({ ariaLabel, children, kind }: AuthPageShellProps) {
  const { dictionary } = useI18n();
  const [titleKey, descriptionKey] = pageCopyKeys[kind];
  const context = dictionary.authPageShell[kind];

  return (
    <>
      <section className="auth-page-ux auth-hero auth-hero-polished">
        <div>
          <p className="eyebrow">{context.eyebrow}</p>
          <h1>{dictionary.auth[titleKey]}</h1>
          <p>{dictionary.auth[descriptionKey]}</p>
        </div>

        <aside className="auth-hero-assurance" aria-label={dictionary.authPageShell.assuranceLabel}>
          <span>{context.badge}</span>
          <strong>{dictionary.authPageShell.assuranceTitle}</strong>
          <p>{dictionary.authPageShell.assuranceBody}</p>
        </aside>
      </section>

      <PageContainer className="auth-page-layout-ux auth-layout auth-layout-polished" ariaLabel={ariaLabel}>
        <Card className="form-panel auth-panel auth-panel-polished">{children}</Card>

        <Card as="aside" className="auth-trust-rail" aria-label={dictionary.authPageShell.checklistLabel}>
          <p className="eyebrow">{dictionary.authPageShell.checklistEyebrow}</p>
          <h2>{dictionary.authPageShell.checklistTitle}</h2>
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
