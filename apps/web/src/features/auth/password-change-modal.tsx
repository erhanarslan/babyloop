"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent
} from "react";
import { createPortal } from "react-dom";

import { ChangePasswordForm } from "./change-password-form";
import { useBodyScrollLock } from "../../lib/body-scroll-lock";

const PASSWORD_CHANGE_PATH = "/account/password";
const PASSWORD_CHANGE_QUERY_KEY = "changePassword";

type PasswordChangeModalHostProps = {
  apiBaseUrl: string;
};

export function PasswordChangeModalHost({
  apiBaseUrl
}: PasswordChangeModalHostProps) {
  const pathname = usePathname();
  const router = useRouter();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  useBodyScrollLock(isOpen);

  const openModal = useCallback(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);

    const currentUrl = new URL(window.location.href);

    if (currentUrl.searchParams.get(PASSWORD_CHANGE_QUERY_KEY) === "1") {
      currentUrl.searchParams.delete(PASSWORD_CHANGE_QUERY_KEY);
      const nextUrl = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
      router.replace(nextUrl || "/account", { scroll: false });
    }

    window.setTimeout(() => {
      previousFocusRef.current?.focus({ preventScroll: true });
    }, 0);
  }, [router]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const shouldOpenFromQuery =
      new URLSearchParams(window.location.search).get(
        PASSWORD_CHANGE_QUERY_KEY
      ) === "1";

    if (pathname === PASSWORD_CHANGE_PATH || shouldOpenFromQuery) {
      openModal();
    }
  }, [openModal, pathname]);

  useEffect(() => {
    function handlePasswordLinkClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest<HTMLAnchorElement>("a[href]");

      if (!anchor || anchor.hasAttribute("download")) {
        return;
      }

      if (anchor.target && anchor.target !== "_self") {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);

      if (
        destination.origin !== window.location.origin ||
        destination.pathname !== PASSWORD_CHANGE_PATH
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      openModal();
    }

    document.addEventListener("click", handlePasswordLinkClick, true);

    return () => {
      document.removeEventListener("click", handlePasswordLinkClick, true);
    };
  }, [openModal]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    closeButtonRef.current?.focus({ preventScroll: true });

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeModal();
      }
    }

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [closeModal, isOpen]);

  if (!isMounted || !isOpen) {
    return null;
  }

  return createPortal(
    <div
      className="password-change-modal-backdrop"
      role="presentation"
      onMouseDown={(event: ReactMouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) {
          closeModal();
        }
      }}
    >
      <section
        aria-labelledby="password-change-modal-title"
        aria-modal="true"
        className="password-change-modal-card"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="password-change-modal-header">
          <div>
            <p className="eyebrow">Hesap güvenliği</p>
            <h2 id="password-change-modal-title">Şifreyi değiştir</h2>
          </div>

          <button
            aria-label="Şifre değiştirme penceresini kapat"
            className="password-change-modal-close"
            ref={closeButtonRef}
            type="button"
            onClick={closeModal}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="password-change-modal-content">
          <ChangePasswordForm apiBaseUrl={apiBaseUrl} />
        </div>
      </section>
    </div>,
    document.body
  );
}
