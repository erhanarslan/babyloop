import Link from "next/link";
import { getApiBaseUrl } from "../lib/api";
import { AuthNav } from "./auth-nav";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Browse" },
  { href: "/sell", label: "Sell" },
  { href: "/favorites", label: "Favorites" },
  { href: "/conversations", label: "Messages" },
  { href: "/#ai-valuation", label: "AI Valuation" }
];

export function SiteHeader() {
  return (
    <header className="site-header" aria-label="Main navigation">
      <Link className="brand" href="/" aria-label="BabyLoop home">
        BabyLoop
      </Link>
      <nav className="nav-links">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
        <AuthNav apiBaseUrl={getApiBaseUrl()} />
      </nav>
    </header>
  );
}
