"use client";

import Link from "next/link";
import { Badge, Card } from "../../components/ui";

type AccountSurfaceGuideKind =
  | "my_listings"
  | "favorites"
  | "saved_searches"
  | "notifications"
  | "seller_dashboard";

type AccountSurfaceGuideProps = {
  kind: AccountSurfaceGuideKind;
};

type AccountSurfaceGuideConfig = {
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

const GUIDE_CONFIGS: Record<AccountSurfaceGuideKind, AccountSurfaceGuideConfig> = {
  my_listings: {
    eyebrow: "Listing management",
    title: "Keep every listing clear and actionable",
    description:
      "Review status, update condition, open the public page, and use seller insights before deciding whether to reserve, mark sold, or refresh a listing.",
    badge: "Seller workflow",
    steps: [
      "Check title, photos, condition, price, and included accessories.",
      "Use archive, restore, reserved, and sold actions intentionally.",
      "Open the public listing after major edits to verify the buyer view."
    ],
    actions: [
      { href: "/sell", label: "Create listing" },
      { href: "/account/seller", label: "Seller dashboard" },
      { href: "/guides", label: "Parent guides" }
    ]
  },
  favorites: {
    eyebrow: "Favorites",
    title: "Turn saved items into better decisions",
    description:
      "Favorites are a shortlist. Compare condition, photos, seller answers, and related guide topics before messaging.",
    badge: "Buyer workflow",
    steps: [
      "Revisit favorites that match current age-band or seasonal needs.",
      "Remove sold or irrelevant listings to keep the list useful.",
      "Use listing detail questions before committing to a handover."
    ],
    actions: [
      { href: "/browse", label: "Browse more" },
      { href: "/guides", label: "Buying guides" },
      { href: "/assistant", label: "Ask Assistant" }
    ]
  },
  saved_searches: {
    eyebrow: "Saved searches",
    title: "Reuse filters for recurring needs",
    description:
      "Saved searches help parents track size, season, price, and category needs without starting from scratch each time.",
    badge: "Retention",
    steps: [
      "Create one saved search per need, not one huge generic search.",
      "Use price and image filters when the item requires closer review.",
      "Notification delivery is intentionally separate and can be added later."
    ],
    actions: [
      { href: "/browse", label: "Create from browse" },
      { href: "/account/children", label: "Age-band needs" },
      { href: "/assistant", label: "Ask Assistant" }
    ]
  },
  notifications: {
    eyebrow: "Notifications",
    title: "Review marketplace updates from one place",
    description:
      "Use notifications to catch messages, listing interactions, and account updates without exposing buyer identities unnecessarily.",
    badge: "Inbox",
    steps: [
      "Open unread items first and clear the queue after review.",
      "Use conversation safety guidance for message-related notifications.",
      "Favorite and listing activity stays privacy-safe by default."
    ],
    actions: [
      { href: "/conversations", label: "Messages" },
      { href: "/favorites", label: "Favorites" },
      { href: "/my-listings", label: "My listings" }
    ]
  },
  seller_dashboard: {
    eyebrow: "Seller dashboard",
    title: "Use aggregate insight without exposing buyers",
    description:
      "Seller dashboard shows performance signals only. Buyer identity, private contact details, and message text should not be exposed here.",
    badge: "Privacy-safe",
    steps: [
      "Watch favorites, views, listing clicks, and contact intents together.",
      "Improve listings with weak photos, unclear condition, or low contact intent.",
      "Use AI draft and price guidance as a starting point, not an autopublish flow."
    ],
    actions: [
      { href: "/sell", label: "Create listing" },
      { href: "/my-listings", label: "Manage listings" },
      { href: "/assistant", label: "Ask Assistant" }
    ]
  }
};

export function AccountSurfaceGuide({ kind }: AccountSurfaceGuideProps) {
  const config = GUIDE_CONFIGS[kind];

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
