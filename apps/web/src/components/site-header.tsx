import Link from "next/link";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Browse" },
  { href: "/#sell", label: "Sell" },
  { href: "/#ai-valuation", label: "AI Valuation" },
  { href: "/#login", label: "Login" }
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
      </nav>
    </header>
  );
}
