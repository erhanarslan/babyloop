"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, Card, LoadingBlock, PageContainer, PageHeading } from "../../components/ui";
import { getApiErrorMessage } from "../../lib/api-error-message";
import type { AuthMe } from "../../lib/auth-client";
import { useI18n } from "../../lib/i18n/i18n-provider";
import { useProtectedRoute } from "../../lib/use-protected-route";
import { fetchCurrentUser } from "../auth/api";

type AccountProfilePageContentProps = {
  apiBaseUrl: string;
};

const shortcutGroups = [
  {
    key: "marketplaceShortcuts",
    links: [
      { href: "/favorites", labelKey: "favorites" },
      { href: "/account/saved-searches", labelKey: "savedSearches" },
      { href: "/conversations", labelKey: "messages" },
      { href: "/notifications", labelKey: "notifications" }
    ]
  },
  {
    key: "sellerTools",
    links: [
      { href: "/sell", labelKey: "sell" },
      { href: "/my-listings", labelKey: "myListings" },
      { href: "/account/seller", labelKey: "sellerDashboard" }
    ]
  },
  {
    key: "familyPlanning",
    links: [
      { href: "/account/children", labelKey: "childProfiles" },
      { href: "/guides", labelKey: "guides" },
      { href: "/assistant", labelKey: "assistant" }
    ]
  }
] as const;

export function AccountProfilePageContent({ apiBaseUrl }: AccountProfilePageContentProps) {
  const { dictionary } = useI18n();
  const [currentUser, setCurrentUser] = useState<AuthMe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  return (
    <>
      <PageHeading
        eyebrow={dictionary.publicPages.account.profileSummary}
        title={dictionary.publicPages.account.hubTitle}
        description={dictionary.publicPages.account.hubBody}
      />

      <PageContainer className="account-hub-layout" ariaLabel={dictionary.publicPages.account.hubTitle}>
        {isCheckingAuth || isLoading ? (
          <LoadingBlock title={dictionary.common.loading} />
        ) : null}

        {errorMessage ? (
          <Alert title={dictionary.common.requestFailed} message={errorMessage} />
        ) : null}

        {currentUser ? (
          <Card as="section" className="account-hub-profile-card">
            <div>
              <p className="eyebrow">{dictionary.publicPages.account.profileSummary}</p>
              <h2>{currentUser.profile.displayName}</h2>
              <p>{currentUser.profile.locationCity ?? dictionary.common.notProvided}</p>
            </div>
            <Link href="/account/password">{dictionary.publicShell.accountMenu.security}</Link>
          </Card>
        ) : null}

        <div className="account-hub-grid">
          {shortcutGroups.map((group) => (
            <Card as="section" className="account-hub-section" key={group.key}>
              <h2>{dictionary.publicPages.account[group.key]}</h2>
              <div>
                {group.links.map((link) => (
                  <Link href={link.href} key={link.href}>
                    {getShortcutLabel(dictionary, link.labelKey)}
                  </Link>
                ))}
              </div>
            </Card>
          ))}

          <Card as="section" className="account-hub-section muted">
            <h2>{dictionary.publicPages.account.security}</h2>
            <div>
              <Link href="/account/password">{dictionary.publicShell.accountMenu.security}</Link>
              <span>OTP / MFA · {dictionary.publicPages.account.comingSoon}</span>
              <span>Mobile approval · {dictionary.publicPages.account.comingSoon}</span>
              <span>Trusted devices · {dictionary.publicPages.account.comingSoon}</span>
            </div>
          </Card>

          <Card as="section" className="account-hub-section muted">
            <h2>{dictionary.publicPages.account.preferences}</h2>
            <div>
              <span>{dictionary.publicPages.account.notificationPreferences} · {dictionary.publicPages.account.comingSoon}</span>
              <span>{dictionary.publicPages.account.payments} · {dictionary.publicPages.account.comingSoon}</span>
            </div>
          </Card>
        </div>
      </PageContainer>
    </>
  );
}

function getShortcutLabel(dictionary: ReturnType<typeof useI18n>["dictionary"], key: string): string {
  if (key === "sell") {
    return dictionary.publicShell.header.sell;
  }

  if (key === "guides") {
    return dictionary.publicPages.support.guidesTitle;
  }

  if (key === "assistant") {
    return dictionary.publicShell.header.assistant;
  }

  return dictionary.publicShell.accountMenu[key as keyof typeof dictionary.publicShell.accountMenu];
}
