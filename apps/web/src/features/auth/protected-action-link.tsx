"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";
import { getOrRefreshAuthToken } from "../../lib/auth-client";
import { useAuthPrompt } from "./auth-prompt-provider";
import { isAuthPromptHref, isProtectedHref } from "./protected-routes";

type ProtectedActionLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  authTitle?: string;
};

export function ProtectedActionLink({
  authTitle,
  href,
  onClick,
  ...props
}: ProtectedActionLinkProps) {
  const router = useRouter();
  const { apiBaseUrl, openAuthPrompt } = useAuthPrompt();

  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);

    if (event.defaultPrevented) {
      return;
    }

    if (isAuthPromptHref(href)) {
      event.preventDefault();

      openAuthPrompt({
        title: authTitle ?? getDefaultAuthTitle(href),
        returnTo: getCurrentReturnTo()
      });

      return;
    }

    if (!isProtectedHref(href)) {
      return;
    }

    event.preventDefault();

    const navigateToHref = () => {
      router.push(href);
      router.refresh();
    };

    const token = await getOrRefreshAuthToken(apiBaseUrl);

    if (token) {
      navigateToHref();
      return;
    }

    openAuthPrompt({
      title: authTitle ?? getDefaultAuthTitle(href),
      returnTo: href,
      onAuthenticated: navigateToHref
    });
  }

  return <Link href={href} onClick={handleClick} {...props} />;
}

function getCurrentReturnTo(): string {
  if (typeof window === "undefined") {
    return "/";
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function getDefaultAuthTitle(href: string): string {
  if (href.startsWith("/sell")) {
    return "İlan oluşturmak için giriş yap";
  }

  if (href.startsWith("/favorites")) {
    return "Favorilerini görmek için giriş yap";
  }

  if (href.startsWith("/messages") || href.startsWith("/conversations") || href.startsWith("/inbox")) {
    return "Mesajlarını görmek için giriş yap";
  }

  if (href.startsWith("/notifications")) {
    return "Bildirimlerini görmek için giriş yap";
  }

  if (href.startsWith("/children") || href.startsWith("/child") || href.startsWith("/child-profiles")) {
    return "Çocuğum alanını kullanmak için giriş yap";
  }

  if (href.startsWith("/assistant")) {
    return "Asistanı kullanmak için giriş yap";
  }

  if (href.startsWith("/account")) {
    return "Hesabını yönetmek için giriş yap";
  }

  if (href.startsWith("/my-listings")) {
    return "İlanlarını yönetmek için giriş yap";
  }

  if (href.startsWith("/register")) {
    return "BabyLoop’a kayıt ol";
  }

  if (href.startsWith("/forgot-password")) {
    return "Şifreni yenile";
  }

  if (href.startsWith("/auth/verify-email/request")) {
    return "E-posta doğrulama bağlantısı gönder";
  }

  return "BabyLoop’a giriş yap";
}
