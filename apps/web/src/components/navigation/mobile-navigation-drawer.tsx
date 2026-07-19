"use client";

import { useEffect, useRef, useState } from "react";

import { ProtectedActionLink as Link } from "../../features/auth/protected-action-link";
import type { AuthMe } from "../../lib/auth-client";
import type { Dictionary } from "../../lib/i18n/dictionaries";
import {
  accountLinks,
  babyCategoryGroups,
  getLocationLabel,
  locationOptions
} from "./public-navigation-model";
import { SearchOverlay } from "./search-overlay";

const DRAWER_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

type MobileNavigationDrawerProps = {
  apiBaseUrl: string;
  currentAuth: AuthMe | null;
  dictionary: Dictionary;
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
  onLocationChange: (city: string) => void;
  onLogout: () => void;
  selectedCity: string;
  theme: string;
  toggleTheme: () => void;
};

export function MobileNavigationDrawer({
  apiBaseUrl,
  currentAuth,
  dictionary,
  isOpen,
  onClose,
  onLogin,
  onLocationChange,
  onLogout,
  selectedCity,
  theme,
  toggleTheme
}: MobileNavigationDrawerProps) {
  const drawerRef = useRef<HTMLElement | null>(null);
  const [openCategoryId, setOpenCategoryId] = useState<string>(babyCategoryGroups[0]?.id ?? "travel");

  useEffect(() => {
    document.documentElement.classList.toggle("mobile-market-nav-open", isOpen);
    const previouslyFocusedElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    function handleDrawerKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getDrawerFocusableElements(drawerRef.current);
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);

      if (!firstElement || !lastElement) {
        event.preventDefault();
        drawerRef.current?.focus();
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleDrawerKeyDown);
      const firstElement = getDrawerFocusableElements(drawerRef.current)[0];
      (firstElement ?? drawerRef.current)?.focus();
    }

    return () => {
      document.documentElement.classList.remove("mobile-market-nav-open");
      document.removeEventListener("keydown", handleDrawerKeyDown);

      if (isOpen && previouslyFocusedElement?.isConnected) {
        previouslyFocusedElement.focus();
      }
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
        aria-hidden={!isOpen}
        aria-label={dictionary.mobileNavigation.drawerLabel}
        aria-modal={isOpen ? true : undefined}
        className={isOpen ? "mobile-market-drawer open" : "mobile-market-drawer"}
        id="mobile-market-navigation"
        inert={!isOpen}
        ref={drawerRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="mobile-market-drawer-header">
          <Link className="mobile-market-brand-logo" href="/" aria-label={dictionary.mobileNavigation.brandHomeLabel} onClick={onClose}>
            <img src="/brand/home/babyloop-logo-compact-transparent.png" alt="" aria-hidden="true" />
            <span className="sr-only">{dictionary.common.babyloop}</span>
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

        <section className="mobile-market-section mobile-market-location-section">
          <label className="mobile-market-location-field">
            <span>{dictionary.publicShell.header.location}</span>
            <select
              aria-label={dictionary.publicShell.header.locationAria}
              value={selectedCity}
              onChange={(event) => onLocationChange(event.target.value)}
            >
              {locationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {getLocationLabel(option.value, dictionary)}
                </option>
              ))}
            </select>
          </label>
        </section>

        <nav className="mobile-market-quick-links" aria-label={dictionary.mobileNavigation.quickLinksLabel}>
          <Link
            authTitle={dictionary.mobileNavigation.sellAuthTitle}
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
                          {dictionary.publicShell.categoryLinks[item.labelKey]}
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
                  {dictionary.publicShell.accountMenu[item.labelKey]}
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
            <button type="button" onClick={toggleTheme}>
              {theme === "dark" ? dictionary.common.light : dictionary.common.dark}
            </button>
          </div>
        </section>
      </aside>
    </>
  );
}

function getDrawerFocusableElements(drawer: HTMLElement | null): HTMLElement[] {
  if (!drawer) {
    return [];
  }

  return Array.from(
    drawer.querySelectorAll<HTMLElement>(DRAWER_FOCUSABLE_SELECTOR)
  ).filter((element) => !element.hasAttribute("disabled"));
}
