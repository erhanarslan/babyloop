# Web i18n and Content Reduction Plan

Scope: public web and account-facing `apps/web` UI copy. This document is a read-only audit output and does not modify implementation.

## Current i18n State

- `apps/web/src/lib/i18n/dictionaries.ts` defines `en` and `tr` dictionaries.
- Core common/nav/home/auth/listings/messaging/notifications/safety/favorites/admin keys exist.
- Many visible strings still live directly in TSX files.
- Some routes combine dictionary strings with hardcoded English strings in the same viewport.
- Default `html lang` is currently `en`, while the target marketplace appears Turkish-first for Istanbul/Turkiye usage.

## Visible Hardcoded String Categories

| Category | Examples found | Risk |
|---|---|---|
| Header/navigation | "Assistant", "Child profiles", "Saved searches", "Seller dashboard", "Plan needs, buying checks..." | Mixed EN/TR in primary navigation; inconsistent IA. |
| Drawer navigation | "Marketplace", "Browse", "Sell", "Guides", "My account", "Activity", "Navigation" | Drawer ignores dictionary and duplicates alternate IA. |
| Home marketing copy | "Product ecosystem", "Marketplace loop", "Trust architecture", "SEO-ready marketplace pages" | Reads like internal product pitch rather than buyer/seller landing. |
| Browse filters | "Search", "All categories", "Minimum price", "Only listings with images", "Apply filters", "Clear filters" | Core marketplace actions not fully localized. |
| Browse helper content | "Marketplace discovery", "Start broad", "Ask smarter", "Discovery reset" | Too much explanatory English before listings. |
| Listing cards/detail | "Ask checks", "Buyer decision page", "Photo review", "Buyer guide", "Decision support" | Listing detail becomes guidance page; mixed copy. |
| Sell flow | "Seller onboarding", "Use AI as a listing co-pilot", "Listing draft workspace" | Form is delayed by English education copy. |
| My listings | "Seller operations", "Review", "Update", "Close" | Seller actions mixed with explanatory English. |
| Favorites | "Buyer shortlist", "Turn saved listings into clearer buying decisions" | Private utility page over-explains. |
| Saved searches | "Saved search lifecycle", "Lifecycle tracking", "Capture/Revisit/Refine" | Internal lifecycle framing not user-simple. |
| Child profiles | "Family planning", "Lifecycle setup", "Upcoming needs plan" | Heavy internal planning language. |
| Messaging | "Buyer-seller messaging", "Plain-text message", "Safe messaging", "Ask clear item-specific question" | Chat UI has too much safety/explanation copy. |
| Notifications | "Activity inbox", "Triage/Act/Clear", "Privacy-safe seller signal" | Notification center feels operational, not inbox-like. |
| Seller dashboard | "Aggregate funnel", "Contact intents", "Privacy-safe seller insights" | Analytics copy is verbose and English-heavy. |
| Guides | "Controlled guides before open-ended AI answers", "AI note", "Marketplace guidance only" | AI/internal framing visible to end users. |
| Assistant | "Controlled AI assistant", "Grounded", "Bounded", "Actionable", "5 controlled entrypoints" | Explains system design instead of helping users ask. |
| Auth | "Cookie-backed sessions", "Access token is kept in memory", "Private surfaces" | Auth pages expose implementation language and mix i18n. |
| Loading/error states | "Browse could not load", "Fetching marketplace updates safely" | Many route-level states are hardcoded English. |

## Pages With Mixed Turkish/English Risk

| Page / area | Current issue | Priority |
|---|---|---|
| Header and drawer | Dictionary nav labels plus hardcoded Assistant/account labels | P0 |
| `/browse` | Dictionary listing labels plus hardcoded filter labels and helper panels | P0 |
| `/listings/[id]` | Dictionary status/price plus hardcoded buyer guidance and CTA copy | P0 |
| `/conversations/[id]` | Dictionary message labels plus hardcoded thread safety/composer text | P0 |
| `/sell` | Dictionary page heading plus hardcoded seller onboarding/callout text | P1 |
| `/my-listings` | Dictionary heading plus hardcoded seller operations and workflow cards | P1 |
| `/favorites` | Dictionary heading plus hardcoded shortlist explanation | P1 |
| `/account/saved-searches` | Mostly hardcoded page copy and labels | P1 |
| `/account/children` | Mostly hardcoded child planning labels | P1 |
| `/notifications` | Dictionary heading plus hardcoded workflow/filter helper text | P1 |
| `/guides` and `/guides/[id]` | Mostly hardcoded public education copy | P2 |
| `/assistant` | Mostly hardcoded assistant mode/pipeline copy | P1 |
| Auth/recovery pages | Dictionary form copy plus hardcoded security surfaces | P1 |

## TR/EN Coverage Plan

### Phase 1: Core Marketplace Dictionary

Create or expand these dictionary namespaces:

- `shell`
  - header labels
  - drawer labels
  - user menu labels
  - search overlay labels
  - location selector labels
- `search`
  - placeholder
  - recent searches
  - popular searches
  - clear recent
  - view all results
  - empty state
- `categories`
  - BabyLoop IA group labels
  - subcategory labels
  - mega menu labels
- `browse`
  - filters
  - active filter chips
  - results summary
  - empty state
  - save search CTA
- `listingDetail`
  - message seller CTA
  - favorite
  - safety collapsed labels
  - seller summary
  - report secondary labels

### Phase 2: Account and Transactional Dictionary

- `account`
  - account hub
  - user menu
  - security
  - preferences
- `seller`
  - sell form
  - my listings
  - seller dashboard
- `messaging`
  - inbox
  - thread
  - composer
  - safety menu
- `notifications`
  - inbox filters
  - mark read
  - event labels
- `auth`
  - login/register/recovery/password pages

### Phase 3: Support Content Dictionary

- `guides`
  - guide index
  - guide detail actions
  - compact safety boundary
- `assistant`
  - prompt modes
  - quick prompts
  - chat states
  - short safety boundary
- `emptyStates`
  - shared empty/loading/error messages.

## Content Reduction Plan

### Global Rule

Every page should answer:

1. What can I do here?
2. What is the primary action?
3. What is the minimum safety/context note needed?

If a paragraph explains BabyLoop architecture, AI grounding, privacy model internals, SEO, audit, lifecycle theory, or system design, move it to docs, help text, or remove it.

## Page-Specific Reduction

| Area | Reduce | Keep |
|---|---|---|
| Home | Product ecosystem, marketplace loop, trust architecture, long assistant CTA | Search, city, category chips, featured/latest listings, sell CTA, one trust sentence |
| Browse | Discovery panel, assistant/guide/saved search action clusters, category slug display | Search, city, filters, active chips, product cards, save search after filtering |
| Category | Category landing essay and buyer checklist strip | Category title, count, sibling categories, product cards |
| Listing detail | Buyer decision hero, photo review card, buyer guide card, decision support card | Photos, price, title, seller, message seller, favorite, compact safety checklist |
| Sell | Seller onboarding hero, support grid, AI co-pilot essay | Form, image upload, required fields, compact AI assist controls |
| My listings | Seller operations intro, workflow cards, account guide | Listing list, status tabs, edit/status/image actions |
| Favorites | Shortlist education, workflow cards, account guide | Favorite cards, stale indicators, remove/open actions |
| Saved searches | Lifecycle theory, overview metrics | Saved search cards, open/delete/alert state |
| Child profiles | Planning theory and guide topic overflow | Add/edit age band, suggested searches, privacy note |
| Conversations | Messaging hero/workflow/safety overview | Conversation list, unread state, listing context |
| Conversation detail | Large private thread hero, safety guide always visible | Compact listing context, messages, sticky composer, safety overflow |
| Notifications | Workflow grid and account guide | Inbox list, filters, mark all read |
| Guides | AI/RAG/controlled guide language | User-friendly article cards and concise checklist |
| Assistant | Pipeline/principles/grounding explanation | Chat input, quick prompts, compact marketplace boundary |
| Auth | Cookie/access-token implementation language | Form, Google/email options, concise benefit/security note |

## Safety, Assistant, and Guide Copy Rules

- Safety text should be contextual and short:
  - listing detail: "Check condition, parts, recall/safety-sensitive history before meeting."
  - messaging: "Keep arrangements in BabyLoop. Report or block from the safety menu."
  - sell: "Do not include private contact data."
- Assistant text should be action-oriented:
  - "Ask what to check before buying this item."
  - Avoid "controlled modes", "prompt version", "grounding pipeline", "RAG", "hallucination".
- Guide text should be educational but concise:
  - title, short summary, checklist, related listings.
  - Move repeated medical/safety disclaimer to a small footer/callout.

## Proposed Dictionary Structure

```ts
type PublicDictionary = {
  common: {
    babyloop: string;
    loading: string;
    error: string;
    save: string;
    cancel: string;
    close: string;
    back: string;
  };
  shell: {
    header: {
      sell: string;
      login: string;
      account: string;
      messages: string;
      notifications: string;
      allCategories: string;
    };
    drawer: {
      title: string;
      accountLocked: string;
      marketplace: string;
      account: string;
      preferences: string;
    };
    userMenu: {
      accountHub: string;
      myListings: string;
      favorites: string;
      messages: string;
      notifications: string;
      logout: string;
    };
  };
  search: {
    placeholder: string;
    recent: string;
    clearRecent: string;
    popular: string;
    suggestedCategories: string;
    viewResults: string;
    empty: string;
  };
  location: {
    current: string;
    selectCity: string;
    comingSoon: string;
  };
  categories: {
    groups: Record<string, {
      label: string;
      links: Array<{ label: string; query: string }>;
    }>;
  };
  browse: {
    title: string;
    filters: Record<string, string>;
    sort: Record<string, string>;
    activeFilters: string;
    resultCount: string;
    empty: string;
  };
  listingDetail: {
    messageSeller: string;
    favorite: string;
    seller: string;
    safetyChecklist: string;
    reportListing: string;
  };
  account: {
    hubTitle: string;
    security: string;
    preferences: string;
    childProfiles: string;
    savedSearches: string;
  };
  messaging: {
    inboxTitle: string;
    threadTitle: string;
    composerPlaceholder: string;
    safetyMenu: string;
  };
  assistant: {
    title: string;
    placeholder: string;
    quickPrompts: Record<string, string>;
    boundary: string;
  };
};
```

## Copy Tone

Turkish-first marketplace tone should be:

- short;
- concrete;
- product/action-first;
- family-safe without sounding clinical;
- less internal/product-management language.

Examples:

- Instead of "Marketplace discovery": "Ne ariyorsun?"
- Instead of "Turn product questions into safer buying and selling decisions": "Almadan once neye bakmaliyim?"
- Instead of "Controlled AI assistant": "BabyLoop Asistan"
- Instead of "Buyer decision page": "Ilan detayi"
- Instead of "Contact intents": "Mesaj baslatma"

## Acceptance Checklist

- Header, drawer, browse, listing detail, sell, messaging, auth are fully dictionary-backed.
- No route mixes Turkish and English in the same visible card group.
- Public SEO pages can have Turkish and English variants later, but current single-locale runtime should be internally consistent.
- Marketplace pages have fewer explanatory paragraphs and stronger primary actions.
- Assistant/guides/safety copy is supporting content, not first-order navigation.
- Account/private pages use concise utility language.

## Implementation Follow-Up

The first UX rebuild moved the new public shell, search, location, account hub, home, browse, listing-detail, and messaging copy onto dictionary-backed labels where new UI was introduced. Legacy feature surfaces still contain hardcoded text and need a follow-up extraction pass before this checklist can be considered complete.
