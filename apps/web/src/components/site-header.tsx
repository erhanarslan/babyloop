"use client";

import {
  REALTIME_EVENTS,
  type ApiResponse,
  type NotificationCreatedPayload,
  type NotificationReadAllPayload,
  type NotificationReadPayload,
  type NotificationUnreadCountUpdatedPayload
} from "@babyloop/shared";
import { ProtectedActionLink as Link } from "../features/auth/protected-action-link";
import { usePathname } from "next/navigation";
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
import { type Locale, locales } from "../lib/i18n/dictionaries";
import { useI18n } from "../lib/i18n/i18n-provider";
import { getRealtimeSocket } from "../lib/realtime-client";
import { useTheme } from "../lib/theme/theme-provider";
import { useAuthPrompt } from "../features/auth/auth-prompt-provider";
import { fetchUnreadNotificationCount } from "../features/notifications/api";
import { NOTIFICATION_UNREAD_COUNT_UPDATED_EVENT } from "../features/notifications/unread-count-events";
import { CategoryMegaMenu } from "./navigation/category-mega-menu";
import {
  DEFAULT_LOCATION,
  LocationSelector,
  readStoredLocation,
  storeLocation
} from "./navigation/location-selector";
import { MobileNavigationDrawer } from "./navigation/mobile-navigation-drawer";
import {
  accountLinks,
  quickCategoryLinks
} from "./navigation/public-navigation-model";
import { SearchOverlay } from "./navigation/search-overlay";

type HeaderMenu = "categories" | "account" | null;

export function SiteHeader() {
  const apiBaseUrl = getApiBaseUrl();
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement | null>(null);
  const { dictionary, locale, setLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [currentAuth, setCurrentAuth] = useState<AuthMe | null>(null);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [openMenu, setOpenMenu] = useState<HeaderMenu>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { openAuthPrompt } = useAuthPrompt();
  const [selectedCity, setSelectedCityState] = useState(DEFAULT_LOCATION);

  useEffect(() => {
    setSelectedCityState(readStoredLocation());
  }, []);

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
    if (!currentAuth) {
      setUnreadNotificationCount(0);
      return;
    }

    let isActive = true;

    async function loadUnreadCount() {
      try {
        const body = await fetchUnreadNotificationCount(apiBaseUrl);

        if (isActive && body.ok) {
          setUnreadNotificationCount(body.data.count);
        }
      } catch {
        if (isActive) {
          setUnreadNotificationCount(0);
        }
      }
    }

    void loadUnreadCount();

    function handleLocalUnreadCountUpdated(event: Event) {
      const customEvent = event as CustomEvent<{ unreadCount: number }>;
      setUnreadNotificationCount(customEvent.detail.unreadCount);
    }

    window.addEventListener(
      NOTIFICATION_UNREAD_COUNT_UPDATED_EVENT,
      handleLocalUnreadCountUpdated
    );

    const socket = getRealtimeSocket(apiBaseUrl, getAuthToken());

    if (!socket) {
      return () => {
        isActive = false;
        window.removeEventListener(
          NOTIFICATION_UNREAD_COUNT_UPDATED_EVENT,
          handleLocalUnreadCountUpdated
        );
      };
    }

    function handleNotificationCreated(payload: NotificationCreatedPayload) {
      setUnreadNotificationCount(payload.unreadCount);
    }

    function handleNotificationRead(payload: NotificationReadPayload) {
      setUnreadNotificationCount(payload.unreadCount);
    }

    function handleNotificationReadAll(payload: NotificationReadAllPayload) {
      setUnreadNotificationCount(payload.unreadCount);
    }

    function handleUnreadCountUpdated(payload: NotificationUnreadCountUpdatedPayload) {
      setUnreadNotificationCount(payload.unreadCount);
    }

    socket.on(REALTIME_EVENTS.notificationCreated, handleNotificationCreated);
    socket.on(REALTIME_EVENTS.notificationRead, handleNotificationRead);
    socket.on(REALTIME_EVENTS.notificationReadAll, handleNotificationReadAll);
    socket.on(REALTIME_EVENTS.notificationUnreadCountUpdated, handleUnreadCountUpdated);
    socket.io.on("reconnect", loadUnreadCount);

    return () => {
      isActive = false;
      window.removeEventListener(
        NOTIFICATION_UNREAD_COUNT_UPDATED_EVENT,
        handleLocalUnreadCountUpdated
      );
      socket.off(REALTIME_EVENTS.notificationCreated, handleNotificationCreated);
      socket.off(REALTIME_EVENTS.notificationRead, handleNotificationRead);
      socket.off(REALTIME_EVENTS.notificationReadAll, handleNotificationReadAll);
      socket.off(REALTIME_EVENTS.notificationUnreadCountUpdated, handleUnreadCountUpdated);
      socket.io.off("reconnect", loadUnreadCount);
    };
  }, [apiBaseUrl, currentAuth]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeTransientSurfaces();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function setSelectedCity(city: string) {
    setSelectedCityState(city);
    storeLocation(city);
  }

  function closeMenus() {
    setOpenMenu(null);
    setIsDrawerOpen(false);
  }

  function closeTransientSurfaces() {
    setOpenMenu(null);
    setIsDrawerOpen(false);
  }

  function handleLogout() {
    closeTransientSurfaces();
    setCurrentAuth(null);
    logoutAndRedirectToHome(apiBaseUrl);
  }

  return (
    <header ref={headerRef} className="market-header" aria-label="Main navigation">
      <div className="market-header-top">
        <button
          aria-controls="mobile-market-navigation"
          aria-expanded={isDrawerOpen}
          aria-label={dictionary.publicShell.header.openMenu}
          className="market-mobile-menu-button"
          type="button"
          onClick={() => setIsDrawerOpen(true)}
        >
          <span aria-hidden="true" />
        </button>

        <Link className="market-wordmark market-brand-logo" href="/" aria-label="BabyLoop home" onClick={closeMenus}>
          <img src="/brand/home/babyloop-logo-compact-transparent.png" alt="" aria-hidden="true" />
          <span className="sr-only">BabyLoop</span>
        </Link>

        <SearchOverlay
            apiBaseUrl={apiBaseUrl}
          className="market-header-search"
          dictionary={dictionary}
          isAuthenticated={Boolean(currentAuth)}
          selectedCity={selectedCity}
          onNavigate={closeMenus}
        />

        <div className="market-header-actions">
          <LocationSelector
            dictionary={dictionary}
            selectedCity={selectedCity}
            setSelectedCity={setSelectedCity}
          />
          <LanguageSwitcher locale={locale} setLocale={setLocale} />
          <button className="market-icon-button" type="button" aria-label={dictionary.common.theme} onClick={toggleTheme}>
            {theme === "dark" ? "☀" : "◐"}
          </button>
          <Link
            authTitle="İlan oluşturmak için giriş yap"
            className="market-sell-cta"
            href="/sell"
            onClick={closeMenus}
          >
            {dictionary.publicShell.header.sell}
          </Link>
          <HeaderAccount
            currentAuth={currentAuth}
            dictionary={dictionary}
            onLogin={() => openAuthPrompt({ title: "BabyLoop’a giriş yap" })}
            onLogout={handleLogout}
            onOpenAccount={() => setOpenMenu(openMenu === "account" ? null : "account")}
            openMenu={openMenu}
            unreadNotificationCount={unreadNotificationCount}
          />
        </div>
      </div>

      <div className="market-mobile-search-row">
        <SearchOverlay
            apiBaseUrl={apiBaseUrl}
          dictionary={dictionary}
          isAuthenticated={Boolean(currentAuth)}
          selectedCity={selectedCity}
          onNavigate={closeMenus}
        />
      </div>

      <div className="market-header-bottom">
        <button
          aria-controls="babyloop-category-mega-menu"
          aria-expanded={openMenu === "categories"}
          className={openMenu === "categories" ? "market-category-trigger active" : "market-category-trigger"}
          type="button"
          onClick={() => setOpenMenu(openMenu === "categories" ? null : "categories")}
        >
          <span aria-hidden="true">☰</span>
          {dictionary.publicShell.header.allCategories}
        </button>

        <nav className="market-quick-categories" aria-label={dictionary.publicShell.header.allCategories}>
          {quickCategoryLinks.map((item) => (
            <Link href={item.href} key={item.href} onClick={closeMenus}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <CategoryMegaMenu
        dictionary={dictionary}
        isOpen={openMenu === "categories"}
        onNavigate={closeMenus}
      />

      <MobileNavigationDrawer
        apiBaseUrl={apiBaseUrl}
        currentAuth={currentAuth}
        dictionary={dictionary}
        isOpen={isDrawerOpen}
        locale={locale}
        onClose={() => setIsDrawerOpen(false)}
        onLogin={() => {
          setIsDrawerOpen(false);
          openAuthPrompt({ title: "BabyLoop’a giriş yap" });
        }}
        onLogout={handleLogout}
        selectedCity={selectedCity}
        setLocale={setLocale}
        theme={theme}
        toggleTheme={toggleTheme}
      />

    </header>
  );
}

function HeaderAccount({
  currentAuth,
  dictionary,
  onLogin,
  onLogout,
  onOpenAccount,
  openMenu,
  unreadNotificationCount
}: {
  currentAuth: AuthMe | null;
  dictionary: ReturnType<typeof useI18n>["dictionary"];
  onLogin: () => void;
  onLogout: () => void;
  onOpenAccount: () => void;
  openMenu: HeaderMenu;
  unreadNotificationCount: number;
}) {
  if (!currentAuth) {
    return (
      <button className="market-login-button" type="button" onClick={onLogin}>
        {dictionary.common.login}
      </button>
    );
  }

  const displayName = currentAuth.profile.displayName || dictionary.nav.account;
  const initial = displayName.slice(0, 1).toUpperCase();

  return (
    <div className="market-account">
      <Link className="market-activity-link" href="/conversations">
        {dictionary.publicShell.header.messages}
      </Link>
      <Link className="market-activity-link" href="/notifications">
        {dictionary.publicShell.header.notifications}
        {unreadNotificationCount > 0 ? <span>{formatBadgeCount(unreadNotificationCount)}</span> : null}
      </Link>
      <button
        aria-expanded={openMenu === "account"}
        className="market-account-trigger"
        type="button"
        onClick={onOpenAccount}
      >
        <span aria-hidden="true">{initial}</span>
        <strong>{displayName}</strong>
      </button>

      {openMenu === "account" ? (
        <div className="market-account-menu">
          {accountLinks.map((item) => (
            <Link href={item.href} key={item.href}>
              {dictionary.publicShell.accountMenu[item.label as keyof typeof dictionary.publicShell.accountMenu]}
            </Link>
          ))}
          <button type="button" onClick={onLogout}>
            {dictionary.publicShell.accountMenu.logout}
          </button>
        </div>
      ) : null}
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
    <div className="market-language-switcher" aria-label="Language">
      {locales.map((item) => (
        <button
          aria-pressed={locale === item}
          key={item}
          type="button"
          onClick={() => setLocale(item)}
        >
          {item.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function formatBadgeCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}
