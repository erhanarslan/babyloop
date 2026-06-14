import type {
  AssistantChatBody,
  AssistantMode
} from "../schemas/assistant.schemas.js";

export const ASSISTANT_CHAT_PROMPT_VERSION = "assistant-chat-v1";
export const ASSISTANT_CHAT_PROVIDER_NAME = "curated-assistant";

export type AssistantTopic = {
  id: string;
  title: string;
  eyebrow: string;
  summary: string;
  stageLabel: string;
  commonMisconception: string;
  guidance: string;
  browseHref: string;
};

export type AssistantAction = {
  href: string;
  label: string;
};

export type AssistantChatReply = {
  mode: AssistantMode;
  content: string;
  topic?: AssistantTopic;
  actions: AssistantAction[];
  safetyDisclaimers: string[];
  providerName: typeof ASSISTANT_CHAT_PROVIDER_NAME;
  promptVersion: typeof ASSISTANT_CHAT_PROMPT_VERSION;
  confidenceScore: number;
};

const NEWBORN_TOPIC: AssistantTopic = {
  id: "newborn-first-needs",
  title: "Newborn first needs",
  eyebrow: "0-3 months",
  summary: "A practical starter list for parents preparing the first weeks at home.",
  stageLabel: "Newborn stage",
  commonMisconception: "Everything must be bought brand new before birth.",
  guidance:
    "Plan low-risk items gradually and check safety-critical products carefully for missing parts, hygiene, and current condition.",
  browseHref: "/browse?q=newborn&sort=newest"
};

const GEAR_SAFETY_TOPIC: AssistantTopic = {
  id: "baby-gear-safety",
  title: "Second-hand baby gear safety",
  eyebrow: "Buying guide",
  summary: "A simple checklist for strollers, carriers, feeding chairs, and similar gear.",
  stageLabel: "Gear decisions",
  commonMisconception: "If the product looks clean in photos, it is automatically safe.",
  guidance:
    "Ask about product history, missing parts, stability, moving mechanisms, fabric condition, and whether extra photos are available.",
  browseHref: "/browse?hasImages=true&sort=newest"
};

const SIX_TO_TWELVE_TOPIC: AssistantTopic = {
  id: "six-to-twelve-months",
  title: "6-12 month discovery list",
  eyebrow: "6-12 months",
  summary: "Useful categories as babies start sitting, exploring, eating, and moving more.",
  stageLabel: "Exploration stage",
  commonMisconception: "More toys always means better development.",
  guidance:
    "A smaller set of age-appropriate, easy-to-clean, safe items is often more useful than buying many similar products at once.",
  browseHref: "/browse?q=6-12&sort=newest"
};

const TODDLER_TOPIC: AssistantTopic = {
  id: "toddler-mobility",
  title: "Toddler mobility and play",
  eyebrow: "12-24 months",
  summary: "A parent-friendly list for movement, outdoor time, toys, clothing, and daily routines.",
  stageLabel: "Toddler stage",
  commonMisconception: "Toddlers only need toys; routine products do not matter much.",
  guidance:
    "Practical daily-use products such as weather-ready clothing, feeding helpers, and safe activity toys can be as useful as larger gear.",
  browseHref: "/browse?q=toddler&sort=newest"
};

const PRESCHOOL_TOPIC: AssistantTopic = {
  id: "preschool-practical-needs",
  title: "Preschool practical needs",
  eyebrow: "24-36 months",
  summary: "A compact guide for parents planning the next stage of clothing, play, travel, and routines.",
  stageLabel: "Preschool stage",
  commonMisconception: "Older toddlers need fewer marketplace checks.",
  guidance:
    "Needs change quickly around this stage. Saved searches can help parents follow size, season, and category needs without browsing from scratch.",
  browseHref: "/browse?q=preschool&sort=newest"
};

const ASSISTANT_TOPICS = [
  NEWBORN_TOPIC,
  GEAR_SAFETY_TOPIC,
  SIX_TO_TWELVE_TOPIC,
  TODDLER_TOPIC,
  PRESCHOOL_TOPIC
];

const SAFETY_DISCLAIMERS = [
  "BabyLoop Assistant provides marketplace guidance, not diagnosis, treatment, diet, therapy, or child-specific medical advice.",
  "Do not share unnecessary private contact details or sensitive child information.",
  "For safety-sensitive products, verify condition, missing parts, and product history before use."
];

export function createAssistantChatReply(input: AssistantChatBody): AssistantChatReply {
  const topic = findRelevantTopic(input.content, input.mode);

  switch (input.mode) {
    case "find_products":
      return buildReply({
        mode: input.mode,
        content:
          "Start with the closest category, filter for listings with photos, and save the search if this is an upcoming need. Related guide topics can help you ask better questions before messaging a seller.",
        topic,
        actions: [
          { href: topic?.browseHref ?? "/browse?hasImages=true&sort=newest", label: "Find listings" },
          { href: "/account/saved-searches", label: "Saved searches" },
          { href: "/guides", label: "Read guides" }
        ],
        confidenceScore: topic ? 0.82 : 0.68
      });

    case "sell_help":
      return buildReply({
        mode: input.mode,
        content:
          "For a stronger listing, include product type, condition, missing parts, accessories, usage history, clear photos, pickup expectations, and whether the price is flexible. Then use the listing draft and price suggestion tools before publishing.",
        topic,
        actions: [
          { href: "/sell", label: "Open sell form" },
          { href: "/account/seller", label: "Seller dashboard" },
          { href: "/guides", label: "Read guides" }
        ],
        confidenceScore: topic ? 0.8 : 0.7
      });

    case "age_needs":
      return buildReply({
        mode: input.mode,
        content:
          "Use a privacy-light child age band to prepare an upcoming-needs list. BabyLoop can turn stage needs into category links, guide topics, and saved-search ideas without storing exact birth dates.",
        topic: topic ?? NEWBORN_TOPIC,
        actions: [
          { href: "/account/children", label: "Manage child profiles" },
          { href: topic?.browseHref ?? "/browse?sort=newest", label: "Browse related items" },
          { href: "/guides", label: "Open parent guides" }
        ],
        confidenceScore: topic ? 0.86 : 0.72
      });

    case "safe_buying":
      return buildReply({
        mode: input.mode,
        content:
          "Before buying second-hand, ask about usage history, missing parts, defects, cleaning needs, included accessories, and whether the product has had any safety issue. Be extra careful with safety-sensitive gear.",
        topic: topic ?? GEAR_SAFETY_TOPIC,
        actions: [
          { href: "/guides", label: "Open safety guides" },
          { href: "/browse?hasImages=true&sort=newest", label: "Browse with photos" }
        ],
        confidenceScore: topic ? 0.9 : 0.78
      });

    case "platform_help":
      return buildReply({
        mode: input.mode,
        content:
          "Browse categories, open listings, save useful searches, add child age bands for lifecycle suggestions, and message sellers through BabyLoop. Sellers can use draft and price guidance before publishing.",
        topic: null,
        actions: [
          { href: "/browse", label: "Browse" },
          { href: "/account/children", label: "Child profiles" },
          { href: "/sell", label: "Sell" }
        ],
        confidenceScore: 0.76
      });
  }
}

function buildReply({
  mode,
  content,
  topic,
  actions,
  confidenceScore
}: {
  mode: AssistantMode;
  content: string;
  topic: AssistantTopic | null;
  actions: AssistantAction[];
  confidenceScore: number;
}): AssistantChatReply {
  const baseReply: Omit<AssistantChatReply, "topic"> = {
    mode,
    content,
    actions,
    safetyDisclaimers: SAFETY_DISCLAIMERS,
    providerName: ASSISTANT_CHAT_PROVIDER_NAME,
    promptVersion: ASSISTANT_CHAT_PROMPT_VERSION,
    confidenceScore
  };

  return topic ? { ...baseReply, topic } : baseReply;
}

function findRelevantTopic(content: string, mode: AssistantMode): AssistantTopic | null {
  const normalizedContent = normalize(content);

  if (mode === "age_needs") {
    if (
      normalizedContent.includes("12") ||
      normalizedContent.includes("24") ||
      normalizedContent.includes("toddler")
    ) {
      return TODDLER_TOPIC;
    }

    if (normalizedContent.includes("6") || normalizedContent.includes("six")) {
      return SIX_TO_TWELVE_TOPIC;
    }

    if (
      normalizedContent.includes("newborn") ||
      normalizedContent.includes("0-3") ||
      normalizedContent.includes("first weeks")
    ) {
      return NEWBORN_TOPIC;
    }
  }

  if (
    normalizedContent.includes("safe") ||
    normalizedContent.includes("second-hand") ||
    normalizedContent.includes("second hand") ||
    normalizedContent.includes("gear") ||
    normalizedContent.includes("stroller") ||
    normalizedContent.includes("car seat") ||
    normalizedContent.includes("feeding chair")
  ) {
    return GEAR_SAFETY_TOPIC;
  }

  if (
    normalizedContent.includes("preschool") ||
    normalizedContent.includes("36") ||
    normalizedContent.includes("3+")
  ) {
    return PRESCHOOL_TOPIC;
  }

  return (
    ASSISTANT_TOPICS.find((topic) =>
      [topic.title, topic.summary, topic.eyebrow, topic.stageLabel]
        .join(" ")
        .toLowerCase()
        .split(/\s+/)
        .some((token) => token.length > 4 && normalizedContent.includes(token))
    ) ?? null
  );
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
