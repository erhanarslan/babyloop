"use client";

import type { ApiResponse } from "@babyloop/shared";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AUTH_CHANGED_EVENT,
  authFetch,
  getAuthToken,
  logoutAndRedirectToHome,
  refreshSession,
  type AuthMe
} from "../lib/auth-client";
import { getApiBaseUrl } from "../lib/api";
import type { ListingsPayload, ListingSummary } from "../lib/api";
import { type Locale, locales } from "../lib/i18n/dictionaries";
import { useI18n } from "../lib/i18n/i18n-provider";
import { useTheme } from "../lib/theme/theme-provider";
import { cn } from "../lib/utils";
import {
  formatCategoryName,
  formatListingCondition,
  formatListingPrice
} from "../features/listings/listing-display";

type OpenMenu = "marketplace" | "sell" | "account" | "mobile" | null;

type NavItem = {
  description: string;
  href: string;
  label: string;
};

type AccountItem = {
  href: string;
  label: string;
};

export function SiteHeader() {
  const apiBaseUrl = getApiBaseUrl();
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement | null>(null);
  const { dictionary, locale, setLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [currentAuth, setCurrentAuth] = useState<AuthMe | null>(null);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);

  const marketplaceItems: NavItem[] = [
    {
      description: dictionary.nav.browseDescription,
      href: "/browse",
      label: dictionary.nav.browseListings
    },
    ...(currentAuth
      ? [
          {
            description: dictionary.nav.favoritesDescription,
            href: "/favorites",
            label: dictionary.nav.favorites
          },
          {
            description: dictionary.nav.messagesDescription,
            href: "/conversations",
            label: dictionary.nav.messages
          }
        ]
      : [])
  ];

  const sellItems: NavItem[] = currentAuth
    ? [
        {
          description: dictionary.nav.myListingsDescription,
          href: "/sell",
          label: dictionary.common.createListing
        },
        {
          description: dictionary.nav.myListingsDescription,
          href: "/my-listings",
          label: dictionary.nav.myListings
        }
      ]
    : [];

  const accountItems: AccountItem[] = currentAuth
    ? [
        { href: "/favorites", label: dictionary.nav.favorites },
        { href: "/my-listings", label: dictionary.nav.myListings },
        { href: "/auth/verify-email/request", label: dictionary.nav.verifyEmail },
        { href: "/account/password", label: dictionary.nav.changePassword }
      ]
    : [];

  useEffect(() => {
    let isActive = true;

    async function loadCurrentAuth() {
      if (pathname === "/auth/callback") {
        return;
      }

      const token = getAuthToken();

      if (!token) {
        const refreshed = await refreshSession(apiBaseUrl);

        if (!isActive) {
          return;
        }

        setCurrentAuth(
          refreshed.ok
            ? {
                profile: refreshed.data.profile,
                user: refreshed.data.user
              }
            : null
        );
        return;
      }

      try {
        const response = await authFetch(apiBaseUrl, "/api/v1/auth/me");
        const body = (await response.json()) as ApiResponse<AuthMe>;

        if (!isActive) {
          return;
        }

        setCurrentAuth(response.ok && body.ok ? body.data : null);
      } catch {
        if (isActive) {
          setCurrentAuth(null);
        }
      }
    }

    void loadCurrentAuth();
    window.addEventListener(AUTH_CHANGED_EVENT, loadCurrentAuth);

    return () => {
      isActive = false;
      window.removeEventListener(AUTH_CHANGED_EVENT, loadCurrentAuth);
    };
  }, [apiBaseUrl, pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function closeMenus() {
    setOpenMenu(null);
  }

  function handleLogout() {
    closeMenus();
    setCurrentAuth(null);
    logoutAndRedirectToHome(apiBaseUrl);
  }

  return (
    <header ref={headerRef} className="site-header" aria-label="Main navigation">
      <div className="site-header-inner">
        <Link className="brand" href="/" aria-label="BabyLoop home" onClick={closeMenus}>
          <span className="brand-mark" aria-hidden="true">
            BL
          </span>
          <span>
            {dictionary.common.babyloop}
            <small>{dictionary.nav.tagline}</small>
          </span>
        </Link>

        <HeaderSearch apiBaseUrl={apiBaseUrl} onNavigate={closeMenus} />

        <nav className="desktop-nav" aria-label="Primary navigation">
          <Link href="/" onClick={closeMenus}>
            {dictionary.nav.home}
          </Link>

          <NavDropdown
            id="marketplace"
            label={dictionary.nav.marketplace}
            items={marketplaceItems}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
          />

          {currentAuth ? (
            <NavDropdown
              id="sell"
              label={dictionary.nav.sell}
              items={sellItems}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
            />
          ) : null}
        </nav>

        <div className="header-tools" aria-label="Preferences">
          <LanguageSwitcher locale={locale} setLocale={setLocale} />
          <button
            className="theme-toggle"
            type="button"
            aria-label={dictionary.common.theme}
            onClick={toggleTheme}
          >
            {theme === "dark" ? dictionary.common.light : dictionary.common.dark}
          </button>
        </div>

        <div className="header-auth">
          {currentAuth ? (
            <AccountMenu
              currentAuth={currentAuth}
              items={accountItems}
              label={dictionary.nav.account}
              logoutLabel={dictionary.common.logout}
              onLogout={handleLogout}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
            />
          ) : (
            <div className="auth-actions">
              <Link className="ghost-auth-link" href="/login" onClick={closeMenus}>
                {dictionary.common.login}
              </Link>
              <Link className="solid-auth-link" href="/register" onClick={closeMenus}>
                {dictionary.common.register}
              </Link>
            </div>
          )}
        </div>

        <button
          className="mobile-menu-trigger"
          type="button"
          aria-expanded={openMenu === "mobile"}
          aria-controls="mobile-navigation"
          onClick={() => setOpenMenu(openMenu === "mobile" ? null : "mobile")}
        >
          {dictionary.nav.mobileMenu} <span aria-hidden="true">⌄</span>
        </button>
      </div>

      <div
        id="mobile-navigation"
        className={cn("mobile-nav-panel", openMenu === "mobile" && "mobile-nav-panel-open")}
      >
        <nav aria-label="Mobile navigation">
          <Link href="/" onClick={closeMenus}>
            {dictionary.nav.home}
          </Link>

          <p>{dictionary.nav.marketplace}</p>
          {marketplaceItems.map((item) => (
            <Link key={item.href} href={item.href} onClick={closeMenus}>
              {item.label}
            </Link>
          ))}

          {currentAuth ? (
            <>
              <p>{dictionary.nav.sell}</p>
              {sellItems.map((item) => (
                <Link key={item.href} href={item.href} onClick={closeMenus}>
                  {item.label}
                </Link>
              ))}

              <p>{dictionary.nav.account}</p>
              <span className="mobile-user-label">{currentAuth.profile.displayName}</span>

              {accountItems.map((item) => (
                <Link key={item.href} href={item.href} onClick={closeMenus}>
                  {item.label}
                </Link>
              ))}

              <button type="button" onClick={() => void handleLogout()}>
                {dictionary.common.logout}
              </button>
            </>
          ) : (
            <>
              <p>{dictionary.nav.account}</p>
              <Link href="/login" onClick={closeMenus}>
                {dictionary.common.login}
              </Link>
              <Link href="/register" onClick={closeMenus}>
                {dictionary.common.register}
              </Link>
            </>
          )}

          <p>{dictionary.common.language}</p>
          <div className="mobile-preferences">
            <LanguageSwitcher locale={locale} setLocale={setLocale} />
            <button className="theme-toggle" type="button" onClick={toggleTheme}>
              {theme === "dark" ? dictionary.common.light : dictionary.common.dark}
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
}

function HeaderSearch({
  apiBaseUrl,
  onNavigate
}: {
  apiBaseUrl: string;
  onNavigate: () => void;
}) {
  const router = useRouter();
  const { dictionary } = useI18n();
  const searchRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ListingSummary[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (trimmedQuery.length < 3) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      setIsOpen(true);

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/v1/listings?q=${encodeURIComponent(trimmedQuery)}`,
          {
            cache: "no-store",
            signal: controller.signal
          }
        );
        const body = (await response.json()) as ApiResponse<ListingsPayload>;

        if (body.ok) {
          setResults(body.data.listings.slice(0, 5));
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setResults([]);
        }
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [apiBaseUrl, trimmedQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function goToBrowse() {
    const destination =
      trimmedQuery.length >= 3 ? `/browse?q=${encodeURIComponent(trimmedQuery)}` : "/browse";

    setIsOpen(false);
    onNavigate();
    router.push(destination);
  }

  return (
    <div ref={searchRef} className="header-search" role="search">
      <label className="sr-only" htmlFor="header-listing-search">
        {dictionary.nav.searchPlaceholder}
      </label>
      <span aria-hidden="true">{dictionary.nav.searchLabel}</span>
      <input
        id="header-listing-search"
        value={query}
        placeholder={dictionary.nav.searchHint}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(event.target.value.trim().length >= 3);
        }}
        onFocus={() => setIsOpen(trimmedQuery.length >= 3)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            goToBrowse();
          }

          if (event.key === "Escape") {
            setIsOpen(false);
          }
        }}
      />
      <button type="button" onClick={goToBrowse}>
        {dictionary.nav.searchViewAll}
      </button>

      {isOpen ? (
        <div className="search-results-panel">
          {isLoading ? <p>{dictionary.nav.searchLoading}</p> : null}
          {!isLoading && results.length === 0 ? <p>{dictionary.nav.searchEmpty}</p> : null}
          {!isLoading
            ? results.map((listing) => (
                <Link
                  key={listing.id}
                  href={`/listings/${listing.id}`}
                  onClick={() => {
                    setIsOpen(false);
                    onNavigate();
                  }}
                >
                  <strong>{listing.title}</strong>
                  <span>
                    {formatCategoryName(listing.category, dictionary)} ·{" "}
                    {formatListingCondition(listing.condition, dictionary)} ·{" "}
                    {formatListingPrice(listing.price, dictionary)}
                  </span>
                </Link>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}

type NavDropdownProps = {
  id: Exclude<OpenMenu, "account" | "mobile" | null>;
  items: NavItem[];
  label: string;
  openMenu: OpenMenu;
  setOpenMenu: (menu: OpenMenu) => void;
};

function NavDropdown({ id, items, label, openMenu, setOpenMenu }: NavDropdownProps) {
  const isOpen = openMenu === id;

  return (
    <div className="nav-dropdown">
      <button
        className={cn("nav-dropdown-trigger", isOpen && "nav-dropdown-trigger-active")}
        type="button"
        aria-expanded={isOpen}
        onClick={() => setOpenMenu(isOpen ? null : id)}
      >
        {label} <span aria-hidden="true">⌄</span>
      </button>
      <div className={cn("nav-dropdown-menu", isOpen && "nav-dropdown-menu-open")}>
        {items.map((item) => (
          <Link key={item.href} href={item.href} onClick={() => setOpenMenu(null)}>
            <strong>{item.label}</strong>
            <span>{item.description}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

type AccountMenuProps = {
  currentAuth: AuthMe;
  items: AccountItem[];
  label: string;
  logoutLabel: string;
  onLogout: () => void;
  openMenu: OpenMenu;
  setOpenMenu: (menu: OpenMenu) => void;
};

function AccountMenu({
  currentAuth,
  items,
  label,
  logoutLabel,
  onLogout,
  openMenu,
  setOpenMenu
}: AccountMenuProps) {
  const isOpen = openMenu === "account";
  const displayName = currentAuth.profile.displayName || currentAuth.user.email;
  const initial = displayName.slice(0, 1).toUpperCase();

  return (
    <div className="nav-dropdown account-dropdown">
      <button
        className={cn("account-trigger", isOpen && "account-trigger-active")}
        type="button"
        aria-expanded={isOpen}
        aria-label={label}
        onClick={() => setOpenMenu(isOpen ? null : "account")}
      >
        <span>{initial}</span>
        <strong>{displayName}</strong>
        <em aria-hidden="true">⌄</em>
      </button>
      <div className={cn("nav-dropdown-menu account-menu", isOpen && "nav-dropdown-menu-open")}>
        {items.map((item) => (
          <Link key={item.href} href={item.href} onClick={() => setOpenMenu(null)}>
            <strong>{item.label}</strong>
          </Link>
        ))}
        <button type="button" onClick={onLogout}>
          {logoutLabel}
        </button>
      </div>
    </div>
  );
}

function LanguageSwitcher({
  locale,
  setLocale
}: {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}) {
  return (
    <div className="language-switcher" aria-label="Language">
      {locales.map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={locale === item}
          onClick={() => setLocale(item)}
        >
          {item.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
