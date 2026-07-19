"use client";

import { ProtectedActionLink } from "../features/auth/protected-action-link";
import { useI18n } from "../lib/i18n/i18n-provider";

export function SiteFooter() {
  const { dictionary } = useI18n();

  const footerGroups = [
    {
      links: [
        { href: "/browse", label: dictionary.footer.browse },
        { href: "/sell", label: dictionary.footer.sell },
        { href: "/favorites", label: dictionary.footer.favorites },
        { href: "/conversations", label: dictionary.footer.messages }
      ],
      title: dictionary.footer.marketplace
    },
    {
      links: [
        { href: "/login", label: dictionary.footer.login },
        { href: "/register", label: dictionary.footer.register },
        { href: "/auth/verify-email/request", label: dictionary.footer.verifyEmail },
        { href: "/forgot-password", label: dictionary.footer.resetPassword }
      ],
      title: dictionary.footer.account
    },
    {
      links: [
        { href: "/guides", label: dictionary.home.safetyEyebrow },
        { href: "/browse", label: dictionary.common.browseMarketplace }
      ],
      title: dictionary.footer.support
    }
  ];

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-brand">
          <ProtectedActionLink className="brand footer-brand-logo footer-brand-logo-full" href="/" aria-label="BabyLoop home">
            <img src="/brand/home/babyloop-logo-full-transparent.png" alt="" aria-hidden="true" />
            <span className="sr-only">
              {dictionary.common.babyloop}
              {dictionary.nav.tagline}
            </span>
          </ProtectedActionLink>
        </div>

        <div className="footer-links">
          {footerGroups.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2>{group.title}</h2>
              {group.links.map((link) => (
                <ProtectedActionLink key={link.href} href={link.href}>
                  {link.label}
                </ProtectedActionLink>
              ))}
            </nav>
          ))}
        </div>
      </div>
    </footer>
  );
}
