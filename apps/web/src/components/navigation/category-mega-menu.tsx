"use client";

import Link from "next/link";
import { useState } from "react";
import type { Dictionary } from "../../lib/i18n/dictionaries";
import { babyCategoryGroups } from "./public-navigation-model";

type CategoryMegaMenuProps = {
  dictionary: Dictionary;
  isOpen: boolean;
  onNavigate: () => void;
};

export function CategoryMegaMenu({
  dictionary,
  isOpen,
  onNavigate
}: CategoryMegaMenuProps) {
  const [activeGroupId, setActiveGroupId] = useState(babyCategoryGroups[0]?.id ?? "travel");
  const activeGroup =
    babyCategoryGroups.find((group) => group.id === activeGroupId) ?? babyCategoryGroups[0];

  if (!activeGroup) {
    return null;
  }

  return (
    <div
      aria-hidden={!isOpen}
      className={isOpen ? "category-mega-menu open" : "category-mega-menu"}
      id="babyloop-category-mega-menu"
    >
      <div className="category-mega-menu-inner">
        <div className="category-mega-tabs" role="tablist" aria-label={dictionary.publicShell.header.allCategories}>
          {babyCategoryGroups.map((group) => (
            <button
              aria-selected={activeGroup.id === group.id}
              className={activeGroup.id === group.id ? "active" : ""}
              key={group.id}
              role="tab"
              type="button"
              onClick={() => setActiveGroupId(group.id)}
              onMouseEnter={() => setActiveGroupId(group.id)}
            >
              <span aria-hidden="true">{group.icon}</span>
              {dictionary.publicShell.categoryGroups[group.id]}
            </button>
          ))}
        </div>

        <div className="category-mega-panel">
          <p className="eyebrow">{dictionary.publicShell.header.suggestedCategories}</p>
          <h2>{dictionary.publicShell.categoryGroups[activeGroup.id]}</h2>
          <div className="category-mega-links">
            {activeGroup.links.map((item) => (
              <Link href={item.href} key={item.href} onClick={onNavigate}>
                {item.label}
              </Link>
            ))}
          </div>
          <Link className="category-mega-all" href="/browse" onClick={onNavigate}>
            {dictionary.common.browseMarketplace}
          </Link>
        </div>
      </div>
    </div>
  );
}
