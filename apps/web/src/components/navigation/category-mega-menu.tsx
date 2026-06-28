"use client";

import Link from "next/link";
import { useState } from "react";
import type { ReactElement, SVGProps } from "react";
import type { Dictionary } from "../../lib/i18n/dictionaries";
import { babyCategoryGroups } from "./public-navigation-model";

type CategoryMegaMenuProps = {
  dictionary: Dictionary;
  isOpen: boolean;
  onNavigate: () => void;
};

type CategoryVisual = {
  Icon: (props: SVGProps<SVGSVGElement>) => ReactElement;
  tone: string;
};

type CategoryGroupId = keyof Dictionary["publicShell"]["categoryGroups"];

function StrollerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M8 13h7.2c1.8 0 3.3-1.4 3.5-3.2L19 7H8v6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 7a4 4 0 0 1 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 17h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" fill="currentColor" />
    </svg>
  );
}

function ShieldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 3 19 6v5c0 4.6-2.8 8.2-7 10-4.2-1.8-7-5.4-7-10V6l7-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MoonBedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M5 13h11a3 3 0 0 1 3 3v3H5v-6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M5 19V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 10h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M17 4a4.5 4.5 0 0 0 3.2 7.7A5.5 5.5 0 1 1 17 4Z" fill="currentColor" />
    </svg>
  );
}

function FeedingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M7 3v8M4 3v8M10 3v8M4 11h6M7 11v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 3v18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 3c2.2.6 4 2.9 4 5.8 0 2.5-1.4 4.5-4 5.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ShirtIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M8 4 5 6.5 3 10l4 2v8h10v-8l4-2-2-3.5L16 4l-4 2-4-2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 5.5a3.5 3.5 0 0 0 6 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ToyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M4 13h7v7H4v-7ZM13 11h7v9h-7v-9Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M7.5 8.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM16.5 8.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function CareIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M5 13h14v2a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5v-2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M7 13V8a3 3 0 0 1 6 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 5v3M19 6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function HeartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 20s-7-4.3-9-9.2C1.6 7.4 3.6 4 7.2 4c2 0 3.3 1 4.8 2.7C13.5 5 14.8 4 16.8 4c3.6 0 5.6 3.4 4.2 6.8C19 15.7 12 20 12 20Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function ScooterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M8 17h7a4 4 0 0 0 4-4V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 4h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" fill="currentColor" />
      <path d="M5 17h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ReuseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M7 7h8.5A4.5 4.5 0 0 1 20 11.5v0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="m17 4 3 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 17H8.5A4.5 4.5 0 0 1 4 12.5v0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="m7 20-3-3 3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const fallbackCategoryVisual: CategoryVisual = { Icon: StrollerIcon, tone: "travel" };

const categoryVisuals: Partial<Record<CategoryGroupId, CategoryVisual>> = {
  travel: { Icon: StrollerIcon, tone: "travel" },
  safety: { Icon: ShieldIcon, tone: "safety" },
  sleep: { Icon: MoonBedIcon, tone: "sleep" },
  feeding: { Icon: FeedingIcon, tone: "feeding" },
  clothing: { Icon: ShirtIcon, tone: "clothing" },
  play: { Icon: ToyIcon, tone: "play" },
  care: { Icon: CareIcon, tone: "care" },
  parent: { Icon: HeartIcon, tone: "parent" },
  kids: { Icon: ScooterIcon, tone: "kids" },
  reuse: { Icon: ReuseIcon, tone: "reuse" }
};

function getCategoryVisual(groupId: CategoryGroupId): CategoryVisual {
  return categoryVisuals[groupId] ?? fallbackCategoryVisual;
}

export function CategoryMegaMenu({
  dictionary,
  isOpen,
  onNavigate
}: CategoryMegaMenuProps) {
  const [activeGroupId, setActiveGroupId] = useState(babyCategoryGroups[0]?.id ?? "travel");
  const activeGroup =
    babyCategoryGroups.find((group) => group.id === activeGroupId) ?? babyCategoryGroups[0];

  if (!isOpen || !activeGroup) {
    return null;
  }

  const activeVisual = getCategoryVisual(activeGroup.id);
  const ActiveIcon = activeVisual.Icon;

  return (
    <div
      aria-hidden={false}
      className="category-mega-menu open"
      id="babyloop-category-mega-menu"
    >
      <div className="category-mega-menu-inner">
        <div className="category-mega-tabs" role="tablist" aria-label={dictionary.publicShell.header.allCategories}>
          {babyCategoryGroups.map((group) => {
            const visual = getCategoryVisual(group.id);
            const Icon = visual.Icon;
            const isActive = activeGroup.id === group.id;

            return (
              <button
                aria-selected={isActive}
                className={`category-mega-tab${isActive ? " active" : ""}`}
                key={group.id}
                role="tab"
                type="button"
                onClick={() => setActiveGroupId(group.id)}
                onMouseEnter={() => setActiveGroupId(group.id)}
              >
                <span className={`category-mega-icon category-mega-icon-${visual.tone}`} aria-hidden="true">
                  <Icon />
                </span>
                <span className="category-mega-tab-label">
                  {dictionary.publicShell.categoryGroups[group.id]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="category-mega-panel">
          <div className="category-mega-panel-heading">
            <span className={`category-mega-icon category-mega-icon-${activeVisual.tone}`} aria-hidden="true">
              <ActiveIcon />
            </span>
            <h2>{dictionary.publicShell.categoryGroups[activeGroup.id]}</h2>
          </div>

          <div className="category-mega-links">
            {activeGroup.links.map((item) => (
              <Link href={item.href} key={item.href} onClick={onNavigate}>
                {dictionary.publicShell.categoryLinks[item.labelKey]}
              </Link>
            ))}
          </div>

          <Link
            className="category-mega-all"
            href={`/browse?q=${encodeURIComponent(activeGroup.query)}`}
            onClick={onNavigate}
          >
            Tümünü gör
            <span aria-hidden="true">›</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
