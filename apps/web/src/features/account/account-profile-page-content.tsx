"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, LoadingBlock, PageContainer } from "../../components/ui";
import { getApiErrorMessage } from "../../lib/api-error-message";
import type { AuthMe } from "../../lib/auth-client";
import type { Dictionary } from "../../lib/i18n/dictionaries";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { useProtectedRoute } from "../../lib/use-protected-route";
import { fetchCurrentUser } from "../auth/api";

type AccountProfilePageContentProps = {
  apiBaseUrl: string;
};

type AccountSectionId =
  | "profile"
  | "marketplace"
  | "seller"
  | "family"
  | "security"
  | "preferences";

type AccountMenuItem = {
  id: AccountSectionId;
  label: string;
  description: string;
};

type AccountLink = {
  description: string;
  href: string;
  label: string;
};

export function AccountProfilePageContent({ apiBaseUrl }: AccountProfilePageContentProps) {
  const { dictionary } = useI18n();
  const [activeSectionId, setActiveSectionId] = useState<AccountSectionId>("profile");
  const [currentUser, setCurrentUser] = useState<AuthMe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const accountMenuItems = useMemo(() => buildAccountMenuItems(dictionary), [dictionary]);
  const clearProtectedState = useCallback(() => {
    setCurrentUser(null);
    setErrorMessage(null);
    setIsLoading(false);
  }, []);
  const { isCheckingAuth, requireAuth } = useProtectedRoute({
    apiBaseUrl,
    onUnauthenticated: clearProtectedState
  });

  useEffect(() => {
    let isActive = true;

    async function loadAccount() {
      if (!(await requireAuth())) {
        return;
      }

      try {
        const body = await fetchCurrentUser(apiBaseUrl);

        if (!isActive) {
          return;
        }

        if (!body.ok) {
          setErrorMessage(getApiErrorMessage(body.error, dictionary));
          return;
        }

        setCurrentUser(body.data);
      } catch {
        if (isActive) {
          setErrorMessage(dictionary.common.apiUnavailable);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadAccount();

    return () => {
      isActive = false;
    };
  }, [apiBaseUrl, dictionary, requireAuth]);

  const activeSection = useMemo(
    () => accountMenuItems.find((item) => item.id === activeSectionId) ?? accountMenuItems[0]!,
    [accountMenuItems, activeSectionId]
  );

  return (
    <PageContainer className="account-profile-page pb-16 pt-6 sm:pt-8" ariaLabel={dictionary.accountProfile.ariaLabel}>
      <section className="mb-4 sm:mb-5">
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          {dictionary.accountProfile.pageTitle}
        </h1>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground sm:text-base">
          {dictionary.accountProfile.pageDescription}
        </p>
      </section>

      <section className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-background/90 shadow-[0_18px_60px_rgba(55,48,42,0.09)]">
        <div className="grid lg:grid-cols-[320px_1fr]">
          <aside className="border-b border-border/70 bg-muted/25 p-3 sm:p-4 lg:border-b-0 lg:border-r">
            <nav aria-label={dictionary.accountProfile.sectionsLabel} className="flex gap-2 overflow-x-auto pb-3 lg:grid lg:overflow-visible lg:pb-0">
              {accountMenuItems.map((item) => {
                const isActive = item.id === activeSection.id;

                return (
                  <button
                    aria-pressed={isActive}
                    className={[
                      "min-w-[190px] rounded-2xl border p-3 text-left transition lg:min-w-0",
                      isActive
                        ? "border-primary/40 bg-background shadow-sm"
                        : "border-transparent bg-transparent hover:bg-background/75"
                    ].join(" ")}
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSectionId(item.id)}
                  >
                    <span
                      className={[
                        "block rounded-xl px-3 py-2 text-sm font-black",
                        isActive ? "bg-primary text-primary-foreground" : "text-foreground"
                      ].join(" ")}
                    >
                      {item.label}
                    </span>
                    <span className="mt-2 block px-3 text-xs font-bold leading-5 text-muted-foreground">
                      {item.description}
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <article className="grid content-start gap-5 p-5 sm:p-7 lg:p-9">
            {isCheckingAuth || isLoading ? (
              <LoadingBlock title={dictionary.accountProfile.loadingTitle} />
            ) : null}

            {errorMessage ? (
              <Alert title={dictionary.accountProfile.loadFailedTitle} message={errorMessage} />
            ) : null}

            {!isCheckingAuth && !isLoading && !errorMessage ? (
              <AccountSectionPanel
                currentUser={currentUser}
                dictionary={dictionary}
                sectionId={activeSection.id}
                title={activeSection.label}
              />
            ) : null}
          </article>
        </div>
      </section>
    </PageContainer>
  );
}

function AccountSectionPanel({
  currentUser,
  dictionary,
  sectionId,
  title
}: {
  currentUser: AuthMe | null;
  dictionary: Dictionary;
  sectionId: AccountSectionId;
  title: string;
}) {
  if (sectionId === "profile") {
    return <ProfileSummary currentUser={currentUser} dictionary={dictionary} title={title} />;
  }

  if (sectionId === "marketplace") {
    return <LinkSection dictionary={dictionary} links={buildMarketplaceLinks(dictionary)} title={title} />;
  }

  if (sectionId === "seller") {
    return <LinkSection dictionary={dictionary} links={buildSellerLinks(dictionary)} title={title} />;
  }

  if (sectionId === "family") {
    return <LinkSection dictionary={dictionary} links={buildFamilyLinks(dictionary)} title={title} />;
  }

  if (sectionId === "security") {
    return <SecuritySection dictionary={dictionary} title={title} />;
  }

  return <PreferencesSection dictionary={dictionary} title={title} />;
}

function ProfileSummary({
  currentUser,
  dictionary,
  title
}: {
  currentUser: AuthMe | null;
  dictionary: Dictionary;
  title: string;
}) {
  return (
    <div className="grid gap-5">
      <SectionHeading
        title={title}
        description={dictionary.accountProfile.profileSummaryDescription}
      />

      <dl className="grid gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
        <div className="grid gap-1 sm:grid-cols-[160px_1fr] sm:items-center">
          <dt className="text-sm font-black text-muted-foreground">{dictionary.accountProfile.name}</dt>
          <dd className="text-base font-black text-foreground">
            {currentUser?.profile.displayName || dictionary.common.notProvided}
          </dd>
        </div>
        <div className="grid gap-1 sm:grid-cols-[160px_1fr] sm:items-center">
          <dt className="text-sm font-black text-muted-foreground">{dictionary.accountProfile.city}</dt>
          <dd className="text-base font-bold text-foreground">
            {currentUser?.profile.locationCity || dictionary.common.notProvided}
          </dd>
        </div>
      </dl>

      <div>
        <Link
          className="inline-flex rounded-full border border-border bg-background px-4 py-2.5 text-sm font-black text-foreground transition hover:bg-muted"
          href="/account/security"
        >
          {dictionary.accountProfile.securityAndPassword}
        </Link>
      </div>
    </div>
  );
}

function LinkSection({
  dictionary,
  links,
  title
}: {
  dictionary: Dictionary;
  links: AccountLink[];
  title: string;
}) {
  return (
    <div className="grid gap-5">
      <SectionHeading
        title={title}
        description={dictionary.accountProfile.sectionFastAccessDescription}
      />
      <div className="grid gap-3">
        {links.map((link) => (
          <Link
            className="grid gap-1 rounded-2xl border border-border/70 bg-muted/20 p-4 transition hover:border-primary/30 hover:bg-primary/5"
            href={link.href}
            key={link.href}
          >
            <span className="text-base font-black text-foreground">{link.label}</span>
            <span className="text-sm font-semibold leading-6 text-muted-foreground">
              {link.description}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SecuritySection({ dictionary, title }: { dictionary: Dictionary; title: string }) {
  return (
    <div className="grid gap-5">
      <SectionHeading
        title={title}
        description={dictionary.accountProfile.securityDescription}
      />
      <div className="grid gap-3">
        <Link
          className="grid gap-1 rounded-2xl border border-border/70 bg-muted/20 p-4 transition hover:border-primary/30 hover:bg-primary/5"
          href="/account/security"
        >
          <span className="text-base font-black text-foreground">Güvenlik merkezini aç</span>
          <span className="text-sm font-semibold leading-6 text-muted-foreground">
            Şifreni, OTP / MFA ayarını ve aktif cihaz oturumlarını yönet.
          </span>
        </Link>
      </div>
    </div>
  );
}

function PreferencesSection({ dictionary, title }: { dictionary: Dictionary; title: string }) {
  return (
    <div className="grid gap-5">
      <SectionHeading
        title={title}
        description={dictionary.accountProfile.preferencesDescription}
      />
      <div className="grid gap-3">
        <Link
          className="grid gap-1 rounded-2xl border border-border/70 bg-muted/20 p-4 transition hover:border-primary/30 hover:bg-primary/5"
          href="/account/notification-preferences"
        >
          <span className="text-base font-black text-foreground">{dictionary.publicPages.account.notificationPreferences}</span>
          <span className="text-sm font-semibold leading-6 text-muted-foreground">
            {dictionary.accountProfile.notificationPreferencesDescription}
          </span>
        </Link>
        <DisabledPreferenceRow
          description={dictionary.accountProfile.paymentToolsDescription}
          dictionary={dictionary}
          label={dictionary.accountProfile.paymentTools}
        />
      </div>
    </div>
  );
}

function SectionHeading({
  description,
  title
}: {
  description: string;
  title: string;
}) {
  return (
    <div>
      <h2 className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function DisabledPreferenceRow({
  description,
  dictionary,
  label
}: {
  description: string;
  dictionary: Dictionary;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-base font-black text-foreground">{label}</strong>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-black text-muted-foreground">
            {dictionary.accountProfile.comingSoon}
          </span>
        </div>
        <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

function buildAccountMenuItems(dictionary: Dictionary): AccountMenuItem[] {
  return [
    {
      id: "profile",
      label: dictionary.accountProfile.menuItems.profile.label,
      description: dictionary.accountProfile.menuItems.profile.description
    },
    {
      id: "marketplace",
      label: dictionary.accountProfile.menuItems.marketplace.label,
      description: dictionary.accountProfile.menuItems.marketplace.description
    },
    {
      id: "seller",
      label: dictionary.accountProfile.menuItems.seller.label,
      description: dictionary.accountProfile.menuItems.seller.description
    },
    {
      id: "family",
      label: dictionary.accountProfile.menuItems.family.label,
      description: dictionary.accountProfile.menuItems.family.description
    },
    {
      id: "security",
      label: dictionary.accountProfile.menuItems.security.label,
      description: dictionary.accountProfile.menuItems.security.description
    },
    {
      id: "preferences",
      label: dictionary.accountProfile.menuItems.preferences.label,
      description: dictionary.accountProfile.menuItems.preferences.description
    }
  ];
}

function buildMarketplaceLinks(dictionary: Dictionary): AccountLink[] {
  return [
    {
      href: "/favorites",
      label: dictionary.accountProfile.links.favorites.label,
      description: dictionary.accountProfile.links.favorites.description
    },
    {
      href: "/account/saved-searches",
      label: dictionary.accountProfile.links.savedSearches.label,
      description: dictionary.accountProfile.links.savedSearches.description
    },
    {
      href: "/conversations",
      label: dictionary.accountProfile.links.messages.label,
      description: dictionary.accountProfile.links.messages.description
    },
    {
      href: "/notifications",
      label: dictionary.accountProfile.links.notifications.label,
      description: dictionary.accountProfile.links.notifications.description
    }
  ];
}

function buildSellerLinks(dictionary: Dictionary): AccountLink[] {
  return [
    {
      href: "/sell",
      label: dictionary.accountProfile.links.sell.label,
      description: dictionary.accountProfile.links.sell.description
    },
    {
      href: "/my-listings",
      label: dictionary.accountProfile.links.myListings.label,
      description: dictionary.accountProfile.links.myListings.description
    },
    {
      href: "/account/seller",
      label: dictionary.accountProfile.links.sellerDashboard.label,
      description: dictionary.accountProfile.links.sellerDashboard.description
    }
  ];
}

function buildFamilyLinks(dictionary: Dictionary): AccountLink[] {
  return [
    {
      href: "/account/children",
      label: dictionary.accountProfile.links.children.label,
      description: dictionary.accountProfile.links.children.description
    },
    {
      href: "/guides",
      label: dictionary.accountProfile.links.guides.label,
      description: dictionary.accountProfile.links.guides.description
    },
    {
      href: "/assistant",
      label: dictionary.accountProfile.links.assistant.label,
      description: dictionary.accountProfile.links.assistant.description
    }
  ];
}
