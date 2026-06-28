"use client";

import Link from "next/link";
import { Badge, Card } from "../../components/ui";
import { useI18n } from "../../lib/i18n/i18n-provider";

type AccountSurfaceGuideKind =
  | "my_listings"
  | "favorites"
  | "saved_searches"
  | "notifications"
  | "seller_dashboard";

type AccountSurfaceGuideProps = {
  kind: AccountSurfaceGuideKind;
};

export function AccountSurfaceGuide({ kind }: AccountSurfaceGuideProps) {
  const { dictionary } = useI18n();
  const config = dictionary.accountSurfaceGuide[kind];

  return (
    <Card as="section" className="grid gap-4">
      <div className="flex items-start justify-between gap-4 max-[700px]:flex-col max-[700px]:items-stretch">
        <div>
          <p className="eyebrow">{config.eyebrow}</p>
          <h2 className="mb-1">{config.title}</h2>
          <p className="form-note">{config.description}</p>
        </div>
        <Badge>{config.badge}</Badge>
      </div>

      <div className="grid gap-4 border-t border-border pt-4">
        <ul className="question-list m-0 pl-5">
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
      </div>
    </Card>
  );
}
