"use client";

import Link from "next/link";
import { useState } from "react";

type NavigationItem = {
  href: string;
  label: string;
  description: string;
};

type NavigationSection = {
  title: string;
  items: NavigationItem[];
};

const NAVIGATION_SECTIONS: NavigationSection[] = [
  {
    title: "Marketplace",
    items: [
      {
        href: "/browse",
        label: "Browse",
        description: "Search listings, filters, and categories"
      },
      {
        href: "/sell",
        label: "Sell",
        description: "Create a listing with AI guidance"
      },
      {
        href: "/guides",
        label: "Guides",
        description: "Parent buying guides and safety notes"
      },
      {
        href: "/assistant",
        label: "Assistant",
        description: "Ask for stage needs and safer buying checks"
      }
    ]
  },
  {
    title: "My account",
    items: [
      {
        href: "/my-listings",
        label: "My listings",
        description: "Manage status, edits, and seller workflow"
      },
      {
        href: "/favorites",
        label: "Favorites",
        description: "Compare saved listings"
      },
      {
        href: "/account/saved-searches",
        label: "Saved searches",
        description: "Reuse useful filters"
      },
      {
        href: "/account/children",
        label: "Child profiles",
        description: "Age-band needs without exact birth dates"
      }
    ]
  },
  {
    title: "Activity",
    items: [
      {
        href: "/conversations",
        label: "Messages",
        description: "Talk through item details safely"
      },
      {
        href: "/notifications",
        label: "Notifications",
        description: "Review marketplace updates"
      },
      {
        href: "/account/seller",
        label: "Seller dashboard",
        description: "Aggregate seller insights"
      }
    ]
  }
];

export function PublicNavigationDrawer() {
  const [isOpen, setIsOpen] = useState(false);

  function closeDrawer() {
    setIsOpen(false);
  }

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-controls="public-navigation-drawer"
        className={isOpen ? "public-nav-toggle open" : "public-nav-toggle"}
        type="button"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
      >
        <span aria-hidden="true">☰</span>
        <span>Menu</span>
      </button>

      {isOpen ? (
        <button
          aria-label="Close navigation menu"
          className="public-nav-backdrop"
          type="button"
          onClick={closeDrawer}
        />
      ) : null}

      <aside
        aria-label="BabyLoop navigation"
        className={isOpen ? "public-sidebar open" : "public-sidebar"}
        id="public-navigation-drawer"
      >
        <div className="public-sidebar-header">
          <div>
            <p className="eyebrow">BabyLoop</p>
            <h2>Navigation</h2>
          </div>
          <button
            aria-label="Close navigation menu"
            className="public-sidebar-close"
            type="button"
            onClick={closeDrawer}
          >
            ×
          </button>
        </div>

        <nav className="public-sidebar-nav" aria-label="Primary navigation">
          {NAVIGATION_SECTIONS.map((section) => (
            <section className="public-sidebar-section" key={section.title}>
              <h3>{section.title}</h3>
              <ul>
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} onClick={closeDrawer}>
                      <span>{item.label}</span>
                      <small>{item.description}</small>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      </aside>
    </>
  );
}
