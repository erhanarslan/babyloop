"use client";

import Link from "next/link";
import { Badge, Card, PageContainer } from "../../components/ui";

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

type AuthSurfaceConfig = {
  eyebrow: string;
  title: string;
  description: string;
  badge: string;
  steps: string[];
  actions: Array<{
    href: string;
    label: string;
  }>;
};

const AUTH_SURFACE_CONFIGS: Record<AuthSurfaceKind, AuthSurfaceConfig> = {
  login: {
    eyebrow: "Secure access",
    title: "Continue with your protected BabyLoop account",
    description:
      "Use your account to manage listings, messages, favorites, saved searches, child age-band needs, and assistant guidance.",
    badge: "Cookie session",
    steps: [
      "Access is handled with cookie-backed sessions rather than persistent browser storage.",
      "After signing in, use the menu to reach marketplace and account tools.",
      "Keep sensitive contact details out of public listing text, messages, and assistant prompts."
    ],
    actions: [
      { href: "/browse", label: "Browse" },
      { href: "/assistant", label: "Ask Assistant" },
      { href: "/register", label: "Create account" }
    ]
  },
  register: {
    eyebrow: "Create account",
    title: "Start with privacy-conscious marketplace tools",
    description:
      "Create an account to sell items, message safely, save filters, and get age-band based marketplace suggestions.",
    badge: "Privacy-first",
    steps: [
      "BabyLoop avoids exact child birth dates for lifecycle suggestions.",
      "Seller and buyer surfaces are separated to reduce unnecessary identity exposure.",
      "Use clear profile and listing information without adding private contact details."
    ],
    actions: [
      { href: "/browse", label: "Explore first" },
      { href: "/guides", label: "Read guides" },
      { href: "/login", label: "I have an account" }
    ]
  },
  forgot_password: {
    eyebrow: "Account recovery",
    title: "Recover access safely",
    description:
      "Use the recovery flow when you cannot access your account. After recovery, review account settings and avoid shared-device sessions.",
    badge: "Recovery",
    steps: [
      "Use the official BabyLoop recovery page only.",
      "After changing credentials, sign out on shared devices.",
      "Never share recovery links or codes with another person."
    ],
    actions: [
      { href: "/login", label: "Back to login" },
      { href: "/guides", label: "Parent guides" }
    ]
  },
  reset_password: {
    eyebrow: "Set new password",
    title: "Choose a stronger password before continuing",
    description:
      "After reset, BabyLoop continues using protected session handling and account-level safety checks.",
    badge: "Password",
    steps: [
      "Use a unique password that is not reused elsewhere.",
      "Avoid storing credentials in screenshots, notes, or messages.",
      "Return to marketplace tools after confirming the reset."
    ],
    actions: [
      { href: "/login", label: "Sign in" },
      { href: "/browse", label: "Browse" }
    ]
  },
  verify: {
    eyebrow: "Verification",
    title: "Finish account verification",
    description:
      "Verification keeps account actions clearer and helps protect marketplace interactions.",
    badge: "Verify",
    steps: [
      "Complete verification before relying on account-only features.",
      "Use messages for item questions and handover expectations.",
      "Report suspicious or misleading marketplace behavior."
    ],
    actions: [
      { href: "/login", label: "Login" },
      { href: "/guides", label: "Guides" }
    ]
  },
  change_password: {
    eyebrow: "Account security",
    title: "Update your password deliberately",
    description:
      "Use this page when you want to rotate credentials or secure your account after using a shared device.",
    badge: "Security",
    steps: [
      "Use a unique password and keep it separate from marketplace messages.",
      "After changing it, confirm that login and logout still behave correctly.",
      "Review messages and listings if you suspect account misuse."
    ],
    actions: [
      { href: "/account/seller", label: "Seller dashboard" },
      { href: "/my-listings", label: "My listings" },
      { href: "/notifications", label: "Notifications" }
    ]
  }
};

export function AuthSurfaceGuide({ kind }: AuthSurfaceGuideProps) {
  const config = AUTH_SURFACE_CONFIGS[kind];

  return (
    <PageContainer className="pt-0" ariaLabel={`${config.title} guidance`}>
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
