"use client";

import Link from "next/link";
import { Badge, Card, PageContainer } from "../../components/ui";
import { useI18n } from "../../lib/i18n/i18n-provider";

type AuthSurfaceKind =
  | "login"
  | "register"
  | "forgot_password"
  | "reset_password"
  | "verify"
  | "change_password";

type AuthSurfaceGuideProps = {
  kind: AuthSurfaceKind;
};

export function AuthSurfaceGuide({ kind }: AuthSurfaceGuideProps) {
  const { dictionary } = useI18n();
  const config = dictionary.authSurfaceGuide[kind];

  return (
    <PageContainer className="pt-0" ariaLabel={config.ariaLabel}>
      <Card as="section" className="mb-5 grid gap-4">
        <div className="flex items-start justify-between gap-4 max-[700px]:flex-col max-[700px]:items-stretch">
          <div>
            <p className="eyebrow">{config.eyebrow}</p>
            <h2 className="mb-1">{config.title}</h2>
            <p className="form-note">{config.description}</p>
          </div>
          <Badge>{config.badge}</Badge>
        </div>

        <ul className="question-list m-0 border-t border-border py-0 pl-5 pt-4">
          {config.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>

        <div className="home-personalization-actions max-[700px]:flex-col max-[700px]:items-stretch [&_a]:max-[700px]:w-full [&_a]:max-[700px]:justify-center">
          {config.actions.map((action) => (
            <Link href={action.href} key={`${action.href}-${action.label}`}>
              {action.label}
            </Link>
          ))}
        </div>
      </Card>
    </PageContainer>
  );
}
