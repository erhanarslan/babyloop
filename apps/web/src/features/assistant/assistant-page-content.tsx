"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
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

const assistantModes = new Set<AssistantMode>([
  "age_needs",
  "find_products",
  "sell_help",
  "safe_buying",
  "platform_help"
]);

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

const assistantPrinciples = [
  {
    title: "Grounded",
    body: "Uses curated BabyLoop guide topics and marketplace flows instead of open-ended parenting claims."
  },
  {
    title: "Bounded",
    body: "Helps with product discovery, selling, safer buying checks, and platform usage only."
  },
  {
    title: "Actionable",
    body: "Returns next-step links to guides, browse, saved searches, child profiles, and seller tools."
  }
];

const assistantResponsePipeline = [
  "Classify the intent into one of five controlled modes.",
  "Match the question to curated parent guide topics where possible.",
  "Return marketplace-only guidance with explicit safety disclaimers.",
  "Attach action links instead of pretending to make medical or personal decisions."
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
  ],
  safetyDisclaimers: [
    "Marketplace guidance only: no diagnosis, treatment, diet, therapy, or child-specific medical advice.",
    "Avoid sharing private contact details, credentials, or sensitive child information in prompts."
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
  const matchedPreviewTopic = useMemo(
    () => findRelevantTopic(inputValue || selectedPrompt.prompt, selectedMode),
    [inputValue, selectedMode, selectedPrompt.prompt]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prompt = params.get("prompt")?.trim();

    if (!prompt) {
      return;
    }

    const mode = params.get("mode");

    if (mode && assistantModes.has(mode as AssistantMode)) {
      setSelectedMode(mode as AssistantMode);
    }

    setInputValue(prompt.slice(0, 1000));
  }, []);

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
        description="A controlled assistant surface for parent needs, curated guide topics, safer buying checks, and listing preparation."
      />

      <PageContainer className="assistant-layout assistant-experience-layout" ariaLabel="BabyLoop Assistant">
        <section className="assistant-hero-card assistant-hero-card-polished">
          <div>
            <p className="eyebrow">Controlled AI assistant</p>
            <h2>Useful marketplace help without pretending to be a doctor.</h2>
            <p>
              BabyLoop Assistant classifies each request into a controlled mode, grounds answers in guide topics,
              and turns guidance into concrete marketplace actions.
            </p>
            <div className="assistant-hero-actions">
              <Link href="/guides">Parent guides</Link>
              <Link href="/browse">Browse marketplace</Link>
              <Link href="/sell">Create listing</Link>
              <Link href="/account/children">Child profiles</Link>
            </div>
          </div>

          <aside className="assistant-hero-principles" aria-label="Assistant safety principles">
            <div>
              <span>Modes</span>
              <strong>5 controlled entrypoints</strong>
            </div>
            <div>
              <span>Grounding</span>
              <strong>Curated guide topics</strong>
            </div>
            <div>
              <span>Boundary</span>
              <strong>No medical or therapy advice</strong>
            </div>
          </aside>
        </section>

        <section className="assistant-principle-grid" aria-label="Assistant operating principles">
          {assistantPrinciples.map((principle, index) => (
            <article className="assistant-principle-card" key={principle.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h2>{principle.title}</h2>
              <p>{principle.body}</p>
            </article>
          ))}
        </section>

        <section className="assistant-mode-grid assistant-mode-grid-polished" aria-label="Assistant quick prompts">
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

        <section className="assistant-chat-shell assistant-chat-shell-polished" aria-label="Assistant chat">
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
                  <Badge>Preparing</Badge>
                </div>
                <p>Matching the request to a controlled mode, curated guide topic, and safe marketplace actions...</p>
              </article>
            ) : null}
          </div>

          <form className="assistant-composer assistant-composer-polished" onSubmit={handleSubmit}>
            <div className="assistant-selected-mode">
              <Badge>{selectedPrompt.title}</Badge>
              <span>{selectedPrompt.description}</span>
            </div>

            {matchedPreviewTopic ? (
              <div className="assistant-grounding-preview" aria-label="Matched guide preview">
                <p className="eyebrow">Likely grounding topic</p>
                <strong>{matchedPreviewTopic.title}</strong>
                <span>{matchedPreviewTopic.summary}</span>
              </div>
            ) : null}

            <Textarea
              label="Ask BabyLoop Assistant"
              maxLength={1000}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="Example: My child is around 12-24 months. What should I start looking for?"
              rows={4}
              value={inputValue}
              wide
            />

            <div className="assistant-input-guardrails">
              <span>Do not share phone, address, credentials, exact birth dates, or medical details.</span>
              <span>{inputValue.length}/1000</span>
            </div>

            <div className="form-actions">
              <p className="form-note">
                The assistant is marketplace-only. It can prepare product checklists and listing questions, not health or therapy decisions.
              </p>
              <Button type="submit" disabled={isPending || inputValue.trim().length === 0}>
                {isPending ? "Getting guidance..." : "Get guidance"}
              </Button>
            </div>
          </form>
        </section>

        <section className="assistant-ops-panel" aria-label="Assistant control model">
          <div>
            <p className="eyebrow">Hallucination control model</p>
            <h2>Controlled prompts before full RAG expansion</h2>
            <p>
              This public demo shows the intended AI operating model: classify mode, ground to curated guides,
              attach deterministic actions, and keep unsafe advice out of the assistant response.
            </p>
          </div>
          <ol className="assistant-pipeline-list">
            {assistantResponsePipeline.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section className="assistant-safety-boundary assistant-safety-boundary-polished">
          <p className="eyebrow">Safety boundary</p>
          <h2>Marketplace guidance, not medical advice</h2>
          <p>
            BabyLoop Assistant helps with product discovery, listing preparation, buying checks, and platform usage.
            It does not diagnose, treat, prescribe, create diet plans, give therapy guidance, or replace a qualified professional.
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
        <div className="assistant-topic-panel assistant-topic-panel-polished">
          <p className="eyebrow">{message.topic.stageLabel}</p>
          <h3>{message.topic.title}</h3>
          <p>{message.topic.summary}</p>
          <div className="state-panel warning">
            <strong>Common misconception:</strong> {message.topic.commonMisconception}
          </div>
          <p className="form-note">
            <strong>Grounded guidance:</strong> {message.topic.guidance}
          </p>
          <div className="assistant-action-row">
            <Link href={`/guides/${message.topic.id}`}>Read guide</Link>
            <Link href={message.topic.browseHref}>Find listings</Link>
          </div>
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
          {message.meta.providerName} - {message.meta.promptVersion} - confidence{" "}
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
    safetyDisclaimers: normalizeSafetyDisclaimers(reply.safetyDisclaimers),
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
          { href: "/browse?hasImages=true&sort=newest", label: "Browse with photos" },
          { href: "/conversations", label: "Messaging checklist" }
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
        ],
        safetyDisclaimers: normalizeSafetyDisclaimers([])
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
    actions,
    safetyDisclaimers: normalizeSafetyDisclaimers(safetyDisclaimers ?? [])
  };

  if (topic) {
    baseMessage.topic = topic;
  }

  if (meta) {
    baseMessage.meta = meta;
  }

  return baseMessage;
}

function normalizeSafetyDisclaimers(disclaimers: string[]): string[] {
  const defaults = [
    "Marketplace guidance only: no diagnosis, treatment, diet, therapy, or child-specific medical advice.",
    "Verify safety-critical products with manufacturer guidance, recalls, labels, and professional sources when needed."
  ];

  return [...new Set([...disclaimers, ...defaults])].slice(0, 4);
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
    normalizedInput.includes("car seat") ||
    normalizedInput.includes("puset") ||
    normalizedInput.includes("oto")
  ) {
    return getTopicById("baby-gear-safety");
  }

  if (
    normalizedInput.includes("sell") ||
    normalizedInput.includes("listing") ||
    normalizedInput.includes("stroller") ||
    normalizedInput.includes("puset")
  ) {
    return getTopicById("baby-gear-safety");
  }

  if (
    normalizedInput.includes("preschool") ||
    normalizedInput.includes("3+") ||
    normalizedInput.includes("24-36")
  ) {
    return getTopicById("preschool-practical-needs");
  }

  const fallbackTopic = parentGuideTopics[0];

  return fallbackTopic ? mapParentGuideTopic(fallbackTopic) : null;
}
