export type ParentGuideAgeBand =
  | "expecting"
  | "newborn_0_3"
  | "infant_3_6"
  | "infant_6_12"
  | "toddler_12_24"
  | "preschool_24_36"
  | "child_3_plus";

export type ParentGuideTopic = {
  id: string;
  title: string;
  eyebrow: string;
  summary: string;
  stageLabel: string;
  ageBands: ParentGuideAgeBand[];
  categorySlugs: string[];
  commonQuestions: string[];
  knownMyth: string;
  aiNote: string;
  browseHref: string;
};

export const parentGuideTopics: ParentGuideTopic[] = [
  {
    id: "newborn-first-needs",
    title: "Newborn first needs",
    eyebrow: "0-3 months",
    summary: "A practical starter list for parents preparing the first weeks at home.",
    stageLabel: "Newborn stage",
    ageBands: ["expecting", "newborn_0_3"],
    categorySlugs: ["strollers", "clothing", "feeding", "sleep"],
    commonQuestions: [
      "Which items are truly useful in the first weeks?",
      "What can be bought second-hand safely?",
      "Which products should be checked more carefully?"
    ],
    knownMyth: "Everything must be bought brand new before birth.",
    aiNote:
      "Many low-risk items can be planned gradually. Safety-critical products should be checked for condition, recalls, missing parts, and hygiene.",
    browseHref: "/browse?q=newborn&sort=newest"
  },
  {
    id: "baby-gear-safety",
    title: "Second-hand baby gear safety",
    eyebrow: "Buying guide",
    summary: "A simple checklist for strollers, carriers, feeding chairs, and similar gear.",
    stageLabel: "Gear decisions",
    ageBands: ["infant_3_6", "infant_6_12", "toddler_12_24"],
    categorySlugs: ["strollers", "car-seats", "feeding", "toys"],
    commonQuestions: [
      "Which parts should be inspected before buying?",
      "How important are straps, brakes, folding mechanisms, and fabric condition?",
      "When is it better to skip a second-hand item?"
    ],
    knownMyth: "If the product looks clean in photos, it is automatically safe.",
    aiNote:
      "Photos help, but parents should also check product history, moving parts, stability, missing accessories, and whether the item still fits the child's stage.",
    browseHref: "/browse?hasImages=true&sort=newest"
  },
  {
    id: "six-to-twelve-months",
    title: "6-12 month discovery list",
    eyebrow: "6-12 months",
    summary: "Useful categories as babies start sitting, exploring, eating, and moving more.",
    stageLabel: "Exploration stage",
    ageBands: ["infant_6_12"],
    categorySlugs: ["feeding", "toys", "clothing", "strollers"],
    commonQuestions: [
      "Which feeding products become useful?",
      "Which toys fit this stage better?",
      "What should be checked in used activity products?"
    ],
    knownMyth: "More toys always means better development.",
    aiNote:
      "A smaller set of age-appropriate, easy-to-clean, safe items is often more useful than buying many similar products at once.",
    browseHref: "/browse?q=6-12&sort=newest"
  },
  {
    id: "toddler-mobility",
    title: "Toddler mobility and play",
    eyebrow: "12-24 months",
    summary: "A parent-friendly list for movement, outdoor time, toys, clothing, and daily routines.",
    stageLabel: "Toddler stage",
    ageBands: ["toddler_12_24"],
    categorySlugs: ["toys", "clothing", "strollers", "feeding"],
    commonQuestions: [
      "Which products help active toddlers?",
      "Which outdoor items should be checked carefully?",
      "What is worth following with saved searches?"
    ],
    knownMyth: "Toddlers only need toys; routine products do not matter much.",
    aiNote:
      "At this stage, practical daily-use products such as weather-ready clothing, feeding helpers, and safe activity toys can be as useful as larger gear.",
    browseHref: "/browse?q=toddler&sort=newest"
  },
  {
    id: "preschool-practical-needs",
    title: "Preschool practical needs",
    eyebrow: "24-36 months",
    summary: "A compact guide for parents planning the next stage of clothing, play, travel, and routines.",
    stageLabel: "Preschool stage",
    ageBands: ["preschool_24_36", "child_3_plus"],
    categorySlugs: ["toys", "clothing", "books", "travel"],
    commonQuestions: [
      "Which items are worth tracking before prices rise?",
      "Which products can be reused across seasons?",
      "How can saved searches help?"
    ],
    knownMyth: "Older toddlers need fewer marketplace checks.",
    aiNote:
      "Needs change quickly around this stage. Saved searches can help parents follow size, season, and category needs without browsing from scratch.",
    browseHref: "/browse?q=preschool&sort=newest"
  }
];

export function getGuideTopicsForAgeBand(ageBand: ParentGuideAgeBand): ParentGuideTopic[] {
  return parentGuideTopics.filter((topic) => topic.ageBands.includes(ageBand));
}

export function getPrimaryGuideForCategorySlug(categorySlug: string): ParentGuideTopic | null {
  return parentGuideTopics.find((topic) => topic.categorySlugs.includes(categorySlug)) ?? null;
}

export function getParentGuideTopicById(id: string): ParentGuideTopic | null {
  return parentGuideTopics.find((topic) => topic.id === id) ?? null;
}
