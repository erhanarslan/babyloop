"use client";

import { ProtectedActionLink } from "../features/auth/protected-action-link";
import { useLegalConsent } from "../features/legal/legal-consent";
import { useI18n } from "../lib/i18n/i18n-provider";

export function SiteFooter() {
  const { dictionary } = useI18n();
  const { openPreferences } = useLegalConsent();

  const footerGroups = [
    {
      links: [
        { href: "/legal/kvkk", label: "KVKK Aydınlatma Metni" },
        { href: "/legal/privacy", label: "Gizlilik Politikası" },
        { href: "/legal/terms", label: "Kullanım Koşulları" },
        { href: "/legal/cookies", label: "Çerez Politikası" },
        { href: "/legal/ai-notice", label: "Yapay zekâ bildirimi" },
        { href: "/legal/marketplace", label: "Pazaryeri güvenliği" }
      ],
      title: "Yasal ve güven"
    },
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
        { href: "/support/contact", label: "İletişim ve destek" },
        { href: "/legal/data-deletion", label: "Hesap ve veri silme" }
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
              {group.title === "Yasal ve güven" ? (
                <button className="footer-link-button" type="button" onClick={openPreferences}>
                  Çerez tercihleri
                </button>
              ) : null}
            </nav>
          ))}
        </div>
      </div>
    </footer>
  );
}
