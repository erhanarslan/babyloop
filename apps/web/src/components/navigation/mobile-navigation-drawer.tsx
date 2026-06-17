"use client";

import { ProtectedActionLink as Link } from "../../features/auth/protected-action-link";
import { useEffect, useState } from "react";
import type { AuthMe } from "../../lib/auth-client";
import type { Dictionary, Locale } from "../../lib/i18n/dictionaries";
import {
  accountLinks,
  babyCategoryGroups
} from "./public-navigation-model";
import { SearchOverlay } from "./search-overlay";

type MobileNavigationDrawerProps = {
  apiBaseUrl: string;
  currentAuth: AuthMe | null;
  dictionary: Dictionary;
  isOpen: boolean;
  locale: Locale;
  onClose: () => void;
  onLogin: () => void;
  onLogout: () => void;
  selectedCity: string;
  setLocale: (locale: Locale) => void;
  theme: string;
  toggleTheme: () => void;
};

export function MobileNavigationDrawer({
  apiBaseUrl,
  currentAuth,
  dictionary,
  isOpen,
  locale,
  onClose,
  onLogin,
  onLogout,
  selectedCity,
  setLocale,
  theme,
  toggleTheme
}: MobileNavigationDrawerProps) {
  const [openCategoryId, setOpenCategoryId] = useState<string>(babyCategoryGroups[0]?.id ?? "travel");

  useEffect(() => {
    document.documentElement.classList.toggle("mobile-market-nav-open", isOpen);

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.documentElement.classList.remove("mobile-market-nav-open");
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  return (
    <>
      {isOpen ? (
        <button
          aria-label={dictionary.publicShell.header.close}
          className="mobile-market-drawer-backdrop"
          type="button"
          onClick={onClose}
        />
      ) : null}

      <aside
        aria-label="BabyLoop mobile navigation"
        className={isOpen ? "mobile-market-drawer open" : "mobile-market-drawer"}
        id="mobile-market-navigation"
      >
        <div className="mobile-market-drawer-header">
          <Link className="mobile-market-brand-logo" href="/" aria-label="BabyLoop home" onClick={onClose}>
            <img src="/brand/home/babyloop-logo-compact-transparent.png" alt="" aria-hidden="true" />
            <span className="sr-only">BabyLoop</span>
          </Link>
          <button type="button" aria-label={dictionary.publicShell.header.close} onClick={onClose}>
            ×
          </button>
        </div>

        <section className="mobile-market-account">
          {currentAuth ? (
            <>
              <strong>{currentAuth.profile.displayName}</strong>
              <span>{dictionary.publicPages.account.hubBody}</span>
              <Link href="/account/profile" onClick={onClose}>
                {dictionary.publicShell.accountMenu.profile}
              </Link>
            </>
          ) : (
            <>
              <strong>{dictionary.common.login}</strong>
              <span>{dictionary.publicShell.header.loginUnlocks}</span>
              <button type="button" onClick={onLogin}>{dictionary.common.login}</button>
            </>
          )}
        </section>

        <SearchOverlay
        apiBaseUrl={apiBaseUrl}
          dictionary={dictionary}
          isAuthenticated={Boolean(currentAuth)}
          selectedCity={selectedCity}
          onNavigate={onClose}
        />

        <nav className="mobile-market-quick-links" aria-label="Mobile marketplace links">
          <Link
            authTitle="İlan oluşturmak için giriş yap"
            href="/sell"
            onClick={onClose}
          >
            {dictionary.publicShell.header.sell}
          </Link>
          <Link href="/browse" onClick={onClose}>{dictionary.common.browseMarketplace}</Link>
          <Link href="/conversations" onClick={onClose}>{dictionary.publicShell.header.messages}</Link>
          <Link href="/notifications" onClick={onClose}>{dictionary.publicShell.header.notifications}</Link>
          <Link href="/account/saved-searches" onClick={onClose}>{dictionary.publicShell.header.savedSearches}</Link>
          <Link href="/account/children" onClick={onClose}>{dictionary.publicShell.accountMenu.childProfiles}</Link>
          <Link href="/assistant" onClick={onClose}>{dictionary.publicShell.header.assistant}</Link>
        </nav>

        <section className="mobile-market-section">
          <h2>{dictionary.publicShell.header.allCategories}</h2>
          <div className="mobile-market-accordion">
            {babyCategoryGroups.map((group) => {
              const isCategoryOpen = openCategoryId === group.id;

              return (
                <div className="mobile-market-category" key={group.id}>
                  <button
                    aria-expanded={isCategoryOpen}
                    type="button"
                    onClick={() => setOpenCategoryId(isCategoryOpen ? "" : group.id)}
                  >
                    <span aria-hidden="true">{group.icon}</span>
                    {dictionary.publicShell.categoryGroups[group.id]}
                  </button>
                  {isCategoryOpen ? (
                    <div>
                      {group.links.map((item) => (
                        <Link href={item.href} key={item.href} onClick={onClose}>
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        {currentAuth ? (
          <section className="mobile-market-section">
            <h2>{dictionary.nav.account}</h2>
            <nav className="mobile-market-account-links" aria-label={dictionary.nav.account}>
              {accountLinks.map((item) => (
                <Link href={item.href} key={item.href} onClick={onClose}>
                  {dictionary.publicShell.accountMenu[item.label as keyof Dictionary["publicShell"]["accountMenu"]]}
                </Link>
              ))}
              <button type="button" onClick={onLogout}>
                {dictionary.publicShell.accountMenu.logout}
              </button>
            </nav>
          </section>
        ) : null}

        <section className="mobile-market-section">
          <h2>{dictionary.common.theme}</h2>
          <div className="mobile-market-preferences">
            <button
              aria-pressed={locale === "tr"}
              type="button"
              onClick={() => setLocale(locale === "tr" ? "en" : "tr")}
            >
              {locale === "tr" ? "TR" : "EN"}
            </button>
            <button type="button" onClick={toggleTheme}>
              {theme === "dark" ? dictionary.common.light : dictionary.common.dark}
            </button>
          </div>
        </section>
      </aside>
    </>
  );
}
