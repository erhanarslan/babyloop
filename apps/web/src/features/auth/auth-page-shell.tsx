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

  return (
    <>
      <section className="auth-hero">
        <p className="eyebrow">{dictionary.nav.account}</p>
        <h1>{dictionary.auth[titleKey]}</h1>
        <p>{dictionary.auth[descriptionKey]}</p>
      </section>

      <PageContainer className="auth-layout" ariaLabel={ariaLabel}>
        <Card className="form-panel auth-panel">{children}</Card>
      </PageContainer>
    </>
  );
}
