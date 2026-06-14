"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  PageContainer,
  PageHeading,
  Textarea
} from "../../components/ui";
import {
  parentGuideTopics,
  type ParentGuideTopic
} from "../parent-guides/parent-guide-data";
import {
  requestAssistantChat,
  type AssistantChatAction,
  type AssistantChatReply,
  type AssistantChatTopic,
  type AssistantMode
} from "./api";

type AssistantMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  topic?: AssistantDisplayTopic;
  actions?: AssistantChatAction[];
  safetyDisclaimers?: string[];
  meta?: {
    providerName: string;
    promptVersion: string;
    confidenceScore: number;
  };
};

type AssistantDisplayTopic = {
  id: string;
  title: string;
  eyebrow: string;
  summary: string;
  stageLabel: string;
  commonMisconception: string;
  guidance: string;
  browseHref: string;
};

type QuickPrompt = {
  mode: AssistantMode;
  title: string;
  description: string;
  prompt: string;
};

type AssistantPageContentProps = {
  apiBaseUrl: string;
};

const DEFAULT_QUICK_PROMPT: QuickPrompt = {
  mode: "age_needs",
  title: "Plan by age band",
  description: "Get a stage-based needs list without storing exact birth dates.",
  prompt: "My child is around 12-24 months. What should I start looking for?"
};

const quickPrompts: QuickPrompt[] = [
  DEFAULT_QUICK_PROMPT,
  {
    mode: "find_products",
    title: "Find useful products",
    description: "Turn a parent need into browse actions and saved-search ideas.",
    prompt: "I need practical winter items for a toddler. What should I search for?"
  },
  {
    mode: "sell_help",
    title: "Create a better listing",
    description: "Get safer listing structure before using the sell form AI panels.",
    prompt: "I want to sell a stroller. What details should I include?"
  },
  {
    mode: "safe_buying",
    title: "Buy second-hand safely",
    description: "Ask better questions before messaging a seller.",
    prompt: "What should I check before buying second-hand baby gear?"
  },
  {
    mode: "platform_help",
    title: "Use BabyLoop",
    description: "Learn how to browse, save searches, message, and create listings.",
    prompt: "How should I use BabyLoop to find what my child needs?"
  }
];

const initialAssistantMessage: AssistantMessage = {
  id: "assistant-initial",
  role: "assistant",
  content:
    "Hi, I can help you plan age-band needs, find marketplace categories, prepare safer listing details, and understand second-hand buying checks. I use curated BabyLoop guide topics in this first version.",
  actions: [
    { href: "/guides", label: "Open guides" },
    { href: "/account/children", label: "Add child profile" },
    { href: "/browse", label: "Browse marketplace" }
  ]
};

export function AssistantPageContent({ apiBaseUrl }: AssistantPageContentProps) {
  const [selectedMode, setSelectedMode] = useState<AssistantMode>("age_needs");
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([initialAssistantMessage]);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedPrompt = useMemo(
    () => quickPrompts.find((prompt) => prompt.mode === selectedMode) ?? DEFAULT_QUICK_PROMPT,
    [selectedMode]
  );

  function handlePromptClick(prompt: string, mode: AssistantMode) {
    setSelectedMode(mode);
    setInputValue(prompt);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedInput = inputValue.trim();

    if (!normalizedInput || isPending) {
      return;
    }

    const userMessage: AssistantMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: normalizedInput
    };

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setInputValue("");
    setIsPending(true);
    setErrorMessage(null);

    const response = await requestAssistantChat(apiBaseUrl, {
      mode: selectedMode,
      content: normalizedInput
    });

    if (response.ok) {
      setMessages((currentMessages) => [
        ...currentMessages,
        mapApiReplyToMessage(response.data.reply)
      ]);
      setIsPending(false);
      return;
    }

    setErrorMessage(`${response.error.code}: ${response.error.message}`);
    setMessages((currentMessages) => [
      ...currentMessages,
      buildLocalFallbackReply(normalizedInput, selectedMode)
    ]);
    setIsPending(false);
  }

  return (
    <>
      <PageHeading
        eyebrow="BabyLoop Assistant"
        title="Plan, search, and sell with guided help"
        description="A first assistant surface for parent needs, curated guide topics, safer buying checks, and listing preparation."
      />

      <PageContainer className="assistant-layout" ariaLabel="BabyLoop Assistant">
        <section className="assistant-hero-card">
          <div>
            <p className="eyebrow">Assistant foundation</p>
            <h2>Curated API guidance now, AI orchestration next</h2>
            <p>
              This version calls BabyLoop's assistant endpoint and falls back to local curated guidance if the API is unavailable.
            </p>
          </div>

          <div className="assistant-hero-actions">
            <Link href="/guides">Parent guides</Link>
            <Link href="/sell">Create listing</Link>
            <Link href="/account/children">Child profiles</Link>
          </div>
        </section>

        <section className="assistant-mode-grid" aria-label="Assistant quick prompts">
          {quickPrompts.map((prompt) => (
            <button
              className={prompt.mode === selectedMode ? "assistant-mode-card active" : "assistant-mode-card"}
              key={prompt.mode}
              type="button"
              onClick={() => handlePromptClick(prompt.prompt, prompt.mode)}
            >
              <span>{prompt.title}</span>
              <small>{prompt.description}</small>
            </button>
          ))}
        </section>

        <section className="assistant-chat-shell" aria-label="Assistant chat">
          {errorMessage ? (
            <Alert
              title="Assistant API fallback"
              message={`Using local curated guidance because the API request failed. ${errorMessage}`}
            />
          ) : null}

          <div className="assistant-chat-messages">
            {messages.map((message) => (
              <AssistantMessageCard key={message.id} message={message} />
            ))}

            {isPending ? (
              <article className="assistant-message-card assistant">
                <div className="assistant-message-heading">
                  <strong>BabyLoop Assistant</strong>
                  <Badge>Thinking</Badge>
                </div>
                <p>Preparing curated guidance...</p>
              </article>
            ) : null}
          </div>

          <form className="assistant-composer" onSubmit={handleSubmit}>
            <div className="assistant-selected-mode">
              <Badge>{selectedPrompt.title}</Badge>
              <span>{selectedPrompt.description}</span>
            </div>

            <Textarea
              label="Ask BabyLoop Assistant"
              maxLength={1000}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="Example: My child is around 12-24 months. What should I start looking for?"
              rows={4}
              value={inputValue}
              wide
            />

            <div className="form-actions">
              <p className="form-note">
                Do not share private contact details or child-specific medical information here.
              </p>
              <Button type="submit" disabled={isPending || inputValue.trim().length === 0}>
                {isPending ? "Getting guidance..." : "Get guidance"}
              </Button>
            </div>
          </form>
        </section>

        <section className="assistant-safety-boundary">
          <p className="eyebrow">Safety boundary</p>
          <h2>Marketplace guidance, not medical advice</h2>
          <p>
            BabyLoop Assistant helps with product discovery, listing preparation, buying checks, and platform usage.
            It does not diagnose, treat, prescribe, create diet plans, or replace a qualified professional.
          </p>
        </section>
      </PageContainer>
    </>
  );
}

function AssistantMessageCard({ message }: { message: AssistantMessage }) {
  return (
    <article className={`assistant-message-card ${message.role}`}>
      <div className="assistant-message-heading">
        <strong>{message.role === "assistant" ? "BabyLoop Assistant" : "You"}</strong>
        {message.topic ? <Badge>{message.topic.eyebrow}</Badge> : null}
      </div>

      <p>{message.content}</p>

      {message.topic ? (
        <div className="assistant-topic-panel">
          <p className="eyebrow">{message.topic.stageLabel}</p>
          <h3>{message.topic.title}</h3>
          <p>{message.topic.summary}</p>
          <div className="state-panel warning">
            <strong>Common misconception:</strong> {message.topic.commonMisconception}
          </div>
          <p className="form-note">
            <strong>Guidance:</strong> {message.topic.guidance}
          </p>
        </div>
      ) : null}

      {message.safetyDisclaimers && message.safetyDisclaimers.length > 0 ? (
        <ul className="assistant-disclaimer-list">
          {message.safetyDisclaimers.map((disclaimer) => (
            <li key={disclaimer}>{disclaimer}</li>
          ))}
        </ul>
      ) : null}

      {message.actions && message.actions.length > 0 ? (
        <div className="assistant-action-row">
          {message.actions.map((action) => (
            <Link href={action.href} key={`${action.href}-${action.label}`}>
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}

      {message.meta ? (
        <p className="ai-debug">
          {message.meta.providerName} · {message.meta.promptVersion} · confidence{" "}
          {message.meta.confidenceScore}
        </p>
      ) : null}
    </article>
  );
}

function mapApiReplyToMessage(reply: AssistantChatReply): AssistantMessage {
  return buildAssistantMessage({
    id: `assistant-${Date.now()}`,
    content: reply.content,
    topic: reply.topic ? mapApiTopic(reply.topic) : null,
    actions: reply.actions,
    safetyDisclaimers: reply.safetyDisclaimers,
    meta: {
      providerName: reply.providerName,
      promptVersion: reply.promptVersion,
      confidenceScore: reply.confidenceScore
    }
  });
}

function buildLocalFallbackReply(input: string, mode: AssistantMode): AssistantMessage {
  const matchedTopic = findRelevantTopic(input, mode);

  switch (mode) {
    case "find_products":
      return buildAssistantMessage({
        id: `assistant-local-${Date.now()}`,
        content:
          "Start with the closest category, filter for listings with photos, and save the search if this is an upcoming need.",
        topic: matchedTopic,
        actions: [
          { href: matchedTopic?.browseHref ?? "/browse?hasImages=true&sort=newest", label: "Find listings" },
          { href: "/account/saved-searches", label: "Saved searches" },
          { href: "/guides", label: "Read guides" }
        ]
      });

    case "sell_help":
      return buildAssistantMessage({
        id: `assistant-local-${Date.now()}`,
        content:
          "For a stronger listing, include exact product type, condition, missing parts, accessories, usage history, clear photos, and pickup expectations.",
        topic: matchedTopic,
        actions: [
          { href: "/sell", label: "Open sell form" },
          { href: "/account/seller", label: "Seller dashboard" },
          { href: "/guides", label: "Read guides" }
        ]
      });

    case "age_needs":
      return buildAssistantMessage({
        id: `assistant-local-${Date.now()}`,
        content:
          "Use the child profile age band to prepare a lightweight upcoming-needs list without storing exact birth dates.",
        topic: matchedTopic ?? getTopicById("newborn-first-needs"),
        actions: [
          { href: "/account/children", label: "Manage child profiles" },
          { href: matchedTopic?.browseHref ?? "/browse?sort=newest", label: "Browse related items" },
          { href: "/guides", label: "Open parent guides" }
        ]
      });

    case "safe_buying":
      return buildAssistantMessage({
        id: `assistant-local-${Date.now()}`,
        content:
          "Before buying second-hand, ask about usage history, missing parts, defects, cleaning needs, included accessories, and whether the product has had any safety issue.",
        topic: matchedTopic ?? getTopicById("baby-gear-safety"),
        actions: [
          { href: "/guides", label: "Open safety guides" },
          { href: "/browse?hasImages=true&sort=newest", label: "Browse with photos" }
        ]
      });

    case "platform_help":
      return {
        id: `assistant-local-${Date.now()}`,
        role: "assistant",
        content:
          "Browse categories, open listings, save useful searches, add child age bands for lifecycle suggestions, and message sellers through BabyLoop.",
        actions: [
          { href: "/browse", label: "Browse" },
          { href: "/account/children", label: "Child profiles" },
          { href: "/sell", label: "Sell" }
        ]
      };
  }
}

function buildAssistantMessage({
  id,
  content,
  topic,
  actions,
  safetyDisclaimers,
  meta
}: {
  id: string;
  content: string;
  topic: AssistantDisplayTopic | null;
  actions: AssistantChatAction[];
  safetyDisclaimers?: string[];
  meta?: AssistantMessage["meta"];
}): AssistantMessage {
  const baseMessage: AssistantMessage = {
    id,
    role: "assistant",
    content,
    actions
  };

  if (topic) {
    baseMessage.topic = topic;
  }

  if (safetyDisclaimers && safetyDisclaimers.length > 0) {
    baseMessage.safetyDisclaimers = safetyDisclaimers;
  }

  if (meta) {
    baseMessage.meta = meta;
  }

  return baseMessage;
}

function mapApiTopic(topic: AssistantChatTopic): AssistantDisplayTopic {
  return {
    id: topic.id,
    title: topic.title,
    eyebrow: topic.eyebrow,
    summary: topic.summary,
    stageLabel: topic.stageLabel,
    commonMisconception: topic.commonMisconception,
    guidance: topic.guidance,
    browseHref: topic.browseHref
  };
}

function mapParentGuideTopic(topic: ParentGuideTopic): AssistantDisplayTopic {
  return {
    id: topic.id,
    title: topic.title,
    eyebrow: topic.eyebrow,
    summary: topic.summary,
    stageLabel: topic.stageLabel,
    commonMisconception: topic.knownMyth,
    guidance: topic.aiNote,
    browseHref: topic.browseHref
  };
}

function getTopicById(id: string): AssistantDisplayTopic | null {
  const topic = parentGuideTopics.find((guideTopic) => guideTopic.id === id);

  return topic ? mapParentGuideTopic(topic) : null;
}

function findRelevantTopic(input: string, mode: AssistantMode): AssistantDisplayTopic | null {
  const normalizedInput = input.toLowerCase();

  if (mode === "age_needs") {
    if (normalizedInput.includes("12") || normalizedInput.includes("24") || normalizedInput.includes("toddler")) {
      return getTopicById("toddler-mobility");
    }

    if (normalizedInput.includes("6") || normalizedInput.includes("12")) {
      return getTopicById("six-to-twelve-months");
    }

    if (normalizedInput.includes("newborn") || normalizedInput.includes("0-3")) {
      return getTopicById("newborn-first-needs");
    }
  }

  if (
    normalizedInput.includes("safe") ||
    normalizedInput.includes("second") ||
    normalizedInput.includes("gear") ||
    normalizedInput.includes("stroller") ||
    normalizedInput.includes("car seat")
  ) {
    return getTopicById("baby-gear-safety");
  }

  const matchedTopic = parentGuideTopics.find((topic) =>
    [topic.title, topic.summary, topic.eyebrow, topic.stageLabel]
      .join(" ")
      .toLowerCase()
      .split(/\s+/)
      .some((token) => token.length > 4 && normalizedInput.includes(token))
  );

  return matchedTopic ? mapParentGuideTopic(matchedTopic) : null;
}
