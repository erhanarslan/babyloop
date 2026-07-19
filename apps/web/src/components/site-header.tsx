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
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AUTH_CHANGED_EVENT,
  AUTH_SESSION_ENDED_EVENT,
  fetchCurrentUserWithoutRefresh,
  getAuthToken,
  logoutAndRedirectToHome,
  refreshSession,
  type AuthMe
} from "../lib/auth-client";
import { getApiBaseUrl } from "../lib/api";
import { useI18n } from "../lib/i18n/i18n-provider";
import { getRealtimeSocket } from "../lib/realtime-client";
import { useTheme } from "../lib/theme/theme-provider";
import { useAuthPrompt } from "../features/auth/auth-prompt-provider";
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  type Notification
} from "../features/notifications/api";
import { CART_CHANGED_EVENT, fetchCart } from "../features/cart/api";
import {
  buildNotificationSummary,
  sortNotifications
} from "../features/notifications/notification-summary";
import { NOTIFICATION_UNREAD_COUNT_UPDATED_EVENT } from "../features/notifications/unread-count-events";
import { CategoryMegaMenu } from "./navigation/category-mega-menu";
import {
  DEFAULT_LOCATION,
  LOCATION_CHANGED_EVENT,
  LocationSelector,
  readStoredLocation,
  storeLocation
} from "./navigation/location-selector";
import { MobileNavigationDrawer } from "./navigation/mobile-navigation-drawer";
import {
  accountLinks,
  getLocationQueryValue,
  quickCategoryLinks
} from "./navigation/public-navigation-model";
import { SearchOverlay } from "./navigation/search-overlay";

type HeaderMenu = "categories" | "account" | "notifications" | null;

export function SiteHeader() {
  const apiBaseUrl = getApiBaseUrl();
  const pathname = usePathname();
  const router = useRouter();
  const headerRef = useRef<HTMLElement | null>(null);
  const { dictionary } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [currentAuth, setCurrentAuth] = useState<AuthMe | null>(null);
  const [headerNotifications, setHeaderNotifications] = useState<Notification[]>([]);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [isMarkingNotificationsRead, setIsMarkingNotificationsRead] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [cartItemCount, setCartItemCount] = useState(0);
  const [openMenu, setOpenMenu] = useState<HeaderMenu>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { openAuthPrompt } = useAuthPrompt();
  const [selectedCity, setSelectedCityState] = useState(DEFAULT_LOCATION);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  useEffect(() => {
    setSelectedCityState(readStoredLocation());
  }, []);

  useEffect(() => {
    setOpenMenu(null);
    setIsDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    let isActive = true;

    async function loadCurrentAuth(options: { allowRefresh?: boolean } = {}) {
      const allowRefresh = options.allowRefresh ?? true;
      if (pathname === "/auth/callback") {
        return;
      }

      const token = getAuthToken();

      if (!token) {
        if (!allowRefresh) {
          setCurrentAuth(null);
          return;
        }

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
        const body = await fetchCurrentUserWithoutRefresh(apiBaseUrl);

        if (!isActive) {
          return;
        }

        setCurrentAuth(body.ok ? body.data : null);
      } catch {
        if (isActive) {
          setCurrentAuth(null);
        }
      }
    }

    function loadWithRefresh() {
      void loadCurrentAuth({ allowRefresh: true });
    }

    function checkWithoutRefresh() {
      void loadCurrentAuth({ allowRefresh: false });
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        checkWithoutRefresh();
      }
    }

    function handleSessionEnded() {
      setCurrentAuth(null);
    }

    loadWithRefresh();

    window.addEventListener(AUTH_CHANGED_EVENT, loadWithRefresh);
    window.addEventListener(AUTH_SESSION_ENDED_EVENT, handleSessionEnded);
    window.addEventListener("focus", checkWithoutRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isActive = false;
      window.removeEventListener(AUTH_CHANGED_EVENT, loadWithRefresh);
      window.removeEventListener(AUTH_SESSION_ENDED_EVENT, handleSessionEnded);
      window.removeEventListener("focus", checkWithoutRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!currentAuth) {
      setUnreadNotificationCount(0);
      setHeaderNotifications([]);
      setNotificationMessage(null);
      setCartItemCount(0);
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
      setHeaderNotifications((currentNotifications) =>
        sortNotifications([
          payload.notification,
          ...currentNotifications.filter((notification) => notification.id !== payload.notification.id)
        ])
      );
    }

    function handleNotificationRead(payload: NotificationReadPayload) {
      setUnreadNotificationCount(payload.unreadCount);
      setHeaderNotifications((currentNotifications) =>
        currentNotifications.map((notification) =>
          notification.id === payload.notificationId
            ? { ...notification, readAt: payload.readAt }
            : notification
        )
      );
    }

    function handleNotificationReadAll(payload: NotificationReadAllPayload) {
      setUnreadNotificationCount(payload.unreadCount);
      const readAt = new Date().toISOString();
      setHeaderNotifications((currentNotifications) =>
        currentNotifications.map((notification) => ({
          ...notification,
          readAt: notification.readAt ?? readAt
        }))
      );
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
    if (!currentAuth) {
      setCartItemCount(0);
      return;
    }

    let isActive = true;

    async function loadCartCount() {
      try {
        const body = await fetchCart(apiBaseUrl);

        if (isActive && body.ok) {
          setCartItemCount(body.data.cart.items.length);
        }
      } catch {
        if (isActive) {
          setCartItemCount(0);
        }
      }
    }

    void loadCartCount();
    window.addEventListener(CART_CHANGED_EVENT, loadCartCount);

    return () => {
      isActive = false;
      window.removeEventListener(CART_CHANGED_EVENT, loadCartCount);
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
    window.dispatchEvent(
      new CustomEvent(LOCATION_CHANGED_EVENT, {
        detail: { city }
      })
    );

    if (pathname === "/browse" || pathname.startsWith("/categories/")) {
      const params = new URLSearchParams(window.location.search);
      const cityQueryValue = getLocationQueryValue(city);

      if (cityQueryValue) {
        params.set("city", cityQueryValue);
      } else {
        params.delete("city");
      }

      params.delete("offset");
      const query = params.toString();
      router.push(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
    }
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

  async function loadHeaderNotifications() {
    if (!currentAuth) {
      return;
    }

    setIsNotificationsLoading(true);
    setNotificationMessage(null);

    try {
      const body = await fetchNotifications(apiBaseUrl);

      if (!body.ok) {
        setNotificationMessage(dictionary.notifications.unavailable);
        return;
      }

      const nextNotifications = sortNotifications(body.data.notifications);
      setHeaderNotifications(nextNotifications);
      setUnreadNotificationCount(nextNotifications.filter((notification) => !notification.readAt).length);
    } catch {
      setNotificationMessage(dictionary.notifications.unavailable);
    } finally {
      setIsNotificationsLoading(false);
    }
  }

  async function handleOpenNotifications() {
    const nextOpen = openMenu === "notifications" ? null : "notifications";

    setOpenMenu(nextOpen);

    if (nextOpen === "notifications") {
      await loadHeaderNotifications();
    }
  }

  async function handleMarkAllNotificationsRead() {
    setIsMarkingNotificationsRead(true);
    setNotificationMessage(null);

    try {
      const body = await markAllNotificationsRead(apiBaseUrl);

      if (!body.ok) {
        setNotificationMessage(dictionary.notifications.actionFailed);
        return;
      }

      const readAt = new Date().toISOString();
      setHeaderNotifications((currentNotifications) =>
        currentNotifications.map((notification) => ({
          ...notification,
          readAt: notification.readAt ?? readAt
        }))
      );
      setUnreadNotificationCount(0);
      window.dispatchEvent(
        new CustomEvent(NOTIFICATION_UNREAD_COUNT_UPDATED_EVENT, {
          detail: { unreadCount: 0 }
        })
      );
    } catch {
      setNotificationMessage(dictionary.notifications.actionFailed);
    } finally {
      setIsMarkingNotificationsRead(false);
    }
  }

  return (
    <header ref={headerRef} className="market-header" aria-label={dictionary.nav.mobileMenu}>
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
          <button className="market-icon-button" type="button" aria-label={dictionary.common.theme} onClick={toggleTheme}>
            {theme === "dark" ? "☀" : "◐"}
          </button>
          <Link
            authTitle={dictionary.listings.loginBeforeCreate}
            className="market-sell-cta"
            href="/sell"
            onClick={closeMenus}
          >
            {dictionary.publicShell.header.sell}
          </Link>
          <HeaderAccount
            currentAuth={currentAuth}
            cartItemCount={cartItemCount}
            dictionary={dictionary}
            pathname={pathname}
            headerNotifications={headerNotifications}
            isMarkingNotificationsRead={isMarkingNotificationsRead}
            isNotificationsLoading={isNotificationsLoading}
            notificationMessage={notificationMessage}
            onMarkAllNotificationsRead={() => void handleMarkAllNotificationsRead()}
            onLogin={() => openAuthPrompt({ title: dictionary.auth.loginTitle })}
            onLogout={handleLogout}
            onOpenAccount={() => setOpenMenu(openMenu === "account" ? null : "account")}
            onOpenNotifications={() => void handleOpenNotifications()}
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
              {dictionary.publicShell.quickCategoryLinks[item.labelKey]}
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
        onClose={closeDrawer}
        onLogin={() => {
          setIsDrawerOpen(false);
          openAuthPrompt({ title: dictionary.auth.loginTitle });
        }}
        onLocationChange={setSelectedCity}
        onLogout={handleLogout}
        selectedCity={selectedCity}
        theme={theme}
        toggleTheme={toggleTheme}
      />

    </header>
  );
}

function HeaderAccount({
  currentAuth,
  cartItemCount,
  dictionary,
  headerNotifications,
  isMarkingNotificationsRead,
  isNotificationsLoading,
  notificationMessage,
  onMarkAllNotificationsRead,
  onLogin,
  onLogout,
  onOpenAccount,
  onOpenNotifications,
  openMenu,
  pathname,
  unreadNotificationCount
}: {
  currentAuth: AuthMe | null;
  cartItemCount: number;
  dictionary: ReturnType<typeof useI18n>["dictionary"];
  headerNotifications: Notification[];
  isMarkingNotificationsRead: boolean;
  isNotificationsLoading: boolean;
  notificationMessage: string | null;
  onMarkAllNotificationsRead: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onOpenAccount: () => void;
  onOpenNotifications: () => void;
  openMenu: HeaderMenu;
  pathname: string;
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
  const notificationPopoverId = "market-notifications-popover";

  return (
    <div className="market-account">
      <Link
        aria-label={`Sepet${cartItemCount > 0 ? `, ${formatBadgeCount(cartItemCount)} ürün` : ""}`}
        className={`market-activity-link${isHeaderPathActive(pathname, "/cart") ? " is-active" : ""}`}
        href="/cart"
        title="Sepet"
      >
        <HeaderActionIcon kind="cart" />
        {cartItemCount > 0 ? (
          <span className="market-activity-badge">{formatBadgeCount(cartItemCount)}</span>
        ) : null}
      </Link>
      <Link
        aria-label={dictionary.publicShell.header.messages}
        className={`market-activity-link${isHeaderPathActive(pathname, "/conversations") ? " is-active" : ""}`}
        href="/conversations"
        title={dictionary.publicShell.header.messages}
      >
        <HeaderActionIcon kind="messages" />
      </Link>
      <button
        aria-controls={notificationPopoverId}
        aria-expanded={openMenu === "notifications"}
        aria-label={dictionary.publicShell.header.notifications}
        className={`market-activity-link market-notifications-trigger${
          isHeaderPathActive(pathname, "/notifications") || openMenu === "notifications"
            ? " is-active"
            : ""
        }`}
        title={dictionary.publicShell.header.notifications}
        type="button"
        onClick={onOpenNotifications}
      >
        <HeaderActionIcon kind="notifications" />
        {unreadNotificationCount > 0 ? (
          <span className="market-activity-badge">{formatBadgeCount(unreadNotificationCount)}</span>
        ) : null}
      </button>
      <button
        aria-expanded={openMenu === "account"}
        aria-label={`${displayName} hesabı`}
        className={`market-account-trigger${openMenu === "account" ? " is-active" : ""}`}
        type="button"
        onClick={onOpenAccount}
      >
        <span aria-hidden="true">{initial}</span>
        <strong>{displayName}</strong>
        <HeaderActionIcon kind="chevron" />
      </button>

      {openMenu === "account" ? (
        <div className="market-account-menu">
          {accountLinks.map((item) => (
            <Link href={item.href} key={item.href}>
              {dictionary.publicShell.accountMenu[item.labelKey]}
            </Link>
          ))}
          <button type="button" onClick={onLogout}>
            {dictionary.publicShell.accountMenu.logout}
          </button>
        </div>
      ) : null}

      {openMenu === "notifications" ? (
        <HeaderNotificationsPopover
          id={notificationPopoverId}
          isLoading={isNotificationsLoading}
          isMarkingAllRead={isMarkingNotificationsRead}
          message={notificationMessage}
          notifications={headerNotifications}
          dictionary={dictionary}
          onMarkAllRead={onMarkAllNotificationsRead}
        />
      ) : null}
    </div>
  );
}

function HeaderNotificationsPopover({
  dictionary,
  id,
  isLoading,
  isMarkingAllRead,
  message,
  notifications,
  onMarkAllRead
}: {
  dictionary: ReturnType<typeof useI18n>["dictionary"];
  id: string;
  isLoading: boolean;
  isMarkingAllRead: boolean;
  message: string | null;
  notifications: Notification[];
  onMarkAllRead: () => void;
}) {
  const summary = buildNotificationSummary(notifications);
  const favoriteTotal = summary.favoriteAggregates.reduce(
    (total, item) => total + item.totalCount,
    0
  );

  return (
    <div
      aria-label={dictionary.publicShell.header.notifications}
      className="market-notifications-popover"
      id={id}
      role="dialog"
    >
      <div className="market-notifications-popover-header">
        <strong>{dictionary.publicShell.header.notifications}</strong>
        <Link href="/notifications">{dictionary.notificationsArchive.recentTitle}</Link>
      </div>

      {isLoading ? <p className="market-notifications-muted">{dictionary.notifications.loading}</p> : null}
      {message ? <p className="market-notifications-error">{message}</p> : null}

      <div className="market-notifications-summary-row">
        <span>{dictionary.notificationsArchive.unreadMessage}: {summary.unreadMessageCount}</span>
        <Link href="/conversations">{dictionary.notificationsArchive.goToMessages}</Link>
      </div>

      <div className="market-notifications-favorites">
        <p>{dictionary.notificationsArchive.favoriteSummary.replace("{count}", String(favoriteTotal))}</p>
        {summary.favoriteAggregates.length > 0 ? (
          <ol>
            {summary.favoriteAggregates.slice(0, 4).map((item) => (
              <li key={item.listingId ?? item.title}>
                <div>
                  {item.href ? <Link href={item.href}>{item.title}</Link> : <span>{item.title}</span>}
                  <small>
                    {dictionary.notificationsArchive.favoriteStat
                      .replace("{total}", String(item.totalCount))
                      .replace("{today}", String(item.todayCount))}
                  </small>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <span className="market-notifications-muted">{dictionary.notificationsArchive.noFavoriteActivity}</span>
        )}
      </div>

      <button
        className="market-notifications-read-all"
        disabled={isMarkingAllRead || summary.unreadCount === 0}
        type="button"
        onClick={onMarkAllRead}
      >
        {isMarkingAllRead ? dictionary.notifications.markingAllRead : dictionary.notifications.markAllRead}
      </button>
    </div>
  );
}

type HeaderActionIconKind = "cart" | "chevron" | "messages" | "notifications";

function HeaderActionIcon({ kind }: { kind: HeaderActionIconKind }) {
  if (kind === "cart") {
    return (
      <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
        <path d="M3 4h2l1.7 9.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 7H6" />
        <circle cx="9" cy="19" r="1.4" />
        <circle cx="17" cy="19" r="1.4" />
      </svg>
    );
  }

  if (kind === "messages") {
    return (
      <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
        <path d="M5 5.5h14v10H9l-4 3v-13Z" />
        <path d="M8.5 9h7M8.5 12h4.5" />
      </svg>
    );
  }

  if (kind === "notifications") {
    return (
      <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
        <path d="M6.5 17h11l-1.2-1.7V10a4.3 4.3 0 0 0-8.6 0v5.3L6.5 17Z" />
        <path d="M10 19.2a2.2 2.2 0 0 0 4 0" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="m8 10 4 4 4-4" />
    </svg>
  );
}

function isHeaderPathActive(pathname: string, targetPath: string): boolean {
  return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
}

function formatBadgeCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}
