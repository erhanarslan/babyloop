# Public Web UX Audit

Scope: read-only audit of `apps/web` public and account-facing surfaces. No TSX, CSS, API contract, or feature logic changes are part of this document.

BabyLoop should behave like a focused baby/child marketplace first: search -> category -> listing -> message seller. Assistant, guides, safety, reports, blocks, and account education should support that flow without competing with it.

## Executive Findings

- The current header feels like a route directory. Marketplace search, category discovery, auth state, account links, and feature links compete in one dense area.
- Search works technically, but it behaves like a small autocomplete widget rather than the primary marketplace action. It lacks recent searches, city context, popular needs, and a search-first overlay.
- The mobile navigation has two competing systems: a global sidebar drawer and a header mobile panel. They do not share a clear information architecture.
- Many pages explain BabyLoop's architecture more than they help the user complete the task. This is visible on home, browse, listing detail, messaging, guides, assistant, auth, favorites, saved searches, child profiles, and seller dashboard.
- i18n coverage is partial. The dictionary has EN/TR blocks, but many visible strings remain hardcoded in TSX, mostly in English.
- The public marketplace hierarchy is inverted in several places: Assistant, guides, safety, and operational education are often visually equal to or stronger than product browsing, listing cards, message seller, and sell actions.

## Page-by-Page Audit

| Route / feature | Current primary user goal | What currently blocks the user | Excessive/secondary content that should be hidden or moved | Missing primary action | Navigation/search issue | Mobile issue | i18n issue | Redesign priority | Proposed fix |
|---|---|---|---|---|---|---|---|---|---|
| `/` home | Understand BabyLoop and start browsing or selling | First fold reads like product architecture: "AI-assisted discovery", lifecycle planning, trust architecture | Product ecosystem, marketplace loop, assistant CTA, repeated safety sections | A dominant marketplace search with city and category shortcuts | Header search is small; home does not act as marketplace entry | Long vertical page before products; heavy cards | Mixed hardcoded EN and dictionary copy | P0 | First fold should be search-led: "Bebek arabasi, oto koltugu..." + Istanbul selector + category chips + sell CTA. Move architecture narrative below or remove. |
| `/browse` | Search/filter listings and open result cards | Filter sidebar is dense; discovery panel and assistant links appear before results | Marketplace discovery panel, buying guides, assistant, saved search education | Strong result grid and clear filter apply/reset | Category tree shows slugs and technical hierarchy; no city filter | Sidebar/card density likely stacks into long scroll before results | Many filter labels hardcoded EN | P0 | Put search/location/category controls at top, results immediately below. Collapse advanced filters. Show category chips, active filters, and sort compactly. |
| `/categories/[slug]` | Browse one category landing and listings | Uses the same browse component plus large category hero; category page starts with explanatory content | "Category landing", guide strip, assistant/saved search links | Open listings and refine category | Category route inherits browse complexity; category navigation is not BabyLoop IA-specific | Repeated hero + filters before cards | Category landing copy hardcoded EN | P1 | Category pages should show category title, count, sibling chips, products. Move buyer checklist to small help drawer. |
| `/listings/[id]` | Inspect item and message seller | Page has two H1-style decision sections; message action appears after many guidance cards | Buyer decision hero, photo review summary, buyer guide, decision support, related guide, recently viewed, related listings all compete | Sticky/visible "Message seller" and favorite actions | Back to category, assistant, guides, report all compete with CTA | Buyer has to scroll through guidance before acting; action panel may be buried | Many detail strings hardcoded EN | P0 | Listing detail should be commerce-first: photos, title, price, seller, primary CTA. Make safety/checklist collapsible and report secondary. |
| `/sell` | Create a listing | Seller onboarding, support grid, AI co-pilot callout, intro text appear before form | Prepare/enhance/publish cards and AI philosophy | Start form / upload image | Header sell flow hidden behind dropdown when logged in | Form starts too low on mobile | Many seller strings hardcoded EN | P1 | Put listing form first with compact progress. Move seller guide and assistant to side/help panel. |
| `/my-listings` | Manage own listings | Seller operations hero, workflow cards, account guide precede actual list | Review/update/close cards and AccountSurfaceGuide | "Create listing", status actions, edit image/status | Account menu/header does not clearly lead here | Own listings may be below long intro | Mixed dictionary + hardcoded EN | P1 | Show list and status tabs first. Put seller education below empty state or help sidebar. |
| `/account/seller` | See seller metrics and act on listings | Strong privacy/analytics narrative before listing insight actions | Funnel theory and seller principles text | "Improve listing", "open listing", "manage status" | Account path hidden among many account links | KPI grid can crowd small screens | Mostly hardcoded EN | P2 | Keep dashboard but reduce copy. Highlight top actionable listing issues and link to my listings. |
| `/favorites` | Reopen saved listings and compare | Hero/workflow/account guide delay the actual favorite cards | Shortlist/validate/refresh education | Open listing, remove favorite, message seller from detail | Saved state is hidden in account dropdown | Cards likely stack after long intro | Hardcoded EN in card facts/actions | P1 | Make favorites a compact shortlist. Put sort/filter, cards, and stale-state cues first. |
| `/account/saved-searches` | Reopen/delete saved searches | Lifecycle education dominates; "saved search lifecycle" feels internal | Capture/revisit/refine cards, overview text | Open results, edit/delete/alerts | Search concept is disconnected from header search | Many cards before saved list on mobile | Many hardcoded EN | P1 | Treat as utility list: saved query, city/category, alert state, open results. Education as empty-state only. |
| `/account/children` | Manage age-band profiles | Product planning language is lengthy; not a marketplace primary path | Lifecycle planning cards, upcoming needs, guide topics | Add/edit age band and create saved search from it | Account menu lacks a clean account hub | Long dashboard-like mobile page | Hardcoded EN labels and values | P2 | Keep child profiles under account hub. Make it compact and link to suggested searches, not a main nav item. |
| `/conversations` | See messages and open thread | Messaging hero, workflow grid, safety overview before conversation list | Private/safe/actionable explanation cards | Open unread thread | Header exposes messages, but inbox itself starts with education | User must scroll to list | Hardcoded EN | P0 | Make inbox WhatsApp-like: conversations first, unread filters, listing context. Safety note in small footer/empty state. |
| `/conversations/[id]` | Read/send messages | Page heading + context hero + safety block reduce chat immediacy | Ask Assistant, large safety guide, repeated messaging warnings | Composer and message thread should dominate | Report/block are visible in main action row | Composer may sit low; context panel consumes vertical space | Hardcoded EN in thread/composer | P0 | Chat layout: compact listing context top, messages, sticky composer. Move report/block to overflow/safety menu. |
| `/notifications` | Triage updates | Activity workflow and AccountSurfaceGuide precede inbox | Triage/act/clear cards, privacy explanations | Mark read/open linked item | Notifications in header but page repeats education | Filter tabs and cards after long intro | Hardcoded EN labels | P2 | Inbox-first list with filters and mark-all. Educational content only in empty/help state. |
| `/guides` | Read buying guides | Guide page presents product education system and AI grounding before guide cards | Product education hero, workflow, metrics, AI notes | Browse guide topics | Header places guides near marketplace routes, over-promoting content | Long page before useful guide cards | Mostly hardcoded EN | P2 | Guides should be secondary content hub. Keep concise filters and cards; remove AI/RAG framing from user-facing page. |
| `/guides/[id]` | Read one guide and act | Multiple panels repeat "turn into marketplace action" | Misconception, AI note, related categories, action panel, safety boundary all large | Related listings / saved search / checklist | Guide action links compete with reading | Dense mobile cards | Hardcoded EN | P2 | Use article layout with short checklist and compact related listings CTA. Put safety boundary in footer note. |
| `/assistant` | Ask marketplace assistant | Assistant explains pipeline, grounding, controlled modes before chat | Principles, response pipeline, mode theory, safety disclaimers | Chat input should be primary | Header promotes Assistant too strongly for marketplace | Long intro before composer | Mostly hardcoded EN | P1 | Make assistant a secondary tool. Chat first, quick prompts below, small safety note. Remove internal implementation language. |
| `/login` | Sign in | AuthSurfaceGuide appears before form; safety checklist competes with login | Session/cookie/internal security copy | Email/password form and Google button | Header login navigates full page only | Mobile users scroll before form | Hardcoded EN in auth guide despite dictionary | P1 | Login page form first. Explain benefits in short bullets; deep security copy below. |
| `/register` | Create account | Guide before form adds friction | Privacy-first long text | Account creation form | Header lacks modal/fast entry | Form starts below education | Hardcoded EN | P1 | Register form first, benefits concise: sell, message, save searches. |
| `/forgot-password` | Request password reset | Recovery guide before form | Long recovery safety copy | Email field and submit | Fine route, over-explained | Long intro on mobile | Mixed EN | P2 | Keep one sentence and form. |
| `/reset-password` | Set new password | Similar over-explained shell | Password guidance rail | Password form | Fine route, no marketplace issue | Long intro | Mixed EN | P2 | Form first; safety note below. |
| `/account/password` | Change password | AuthSurfaceGuide and AuthPageShell make it feel like education page | Security checklist and actions | Current/new password form | Account menu has no account hub | Long on mobile | Mixed EN | P2 | Place under Account Security hub with compact form and upcoming settings. |
| Account hub missing | Manage profile/settings/preferences | There is no clear `/account` dashboard/hub | Private tools scattered across header, drawer, footer | Profile settings, notification preferences, security, child profiles, saved searches | User menu is overloaded | Drawer flat lists many account links | N/A | P0 | Add account hub IA before adding more account pages; user menu should link to hub and top 3 tasks only. |

## Header Audit

### Actions that should stay in the header

- BabyLoop wordmark.
- Prominent search field.
- Location selector or city display.
- Sell / Ilan ver CTA.
- Login when logged out.
- Compact account trigger when logged in.
- Messages and notifications as compact icons or text+badge, not large route links.
- Category entrypoint: "Tum kategoriler".
- Language and theme as compact preferences.

### Actions that should move to user menu

- Favorites.
- Saved searches.
- My listings.
- Seller dashboard.
- Child profiles.
- Account/password/security.
- Email verification.
- Detailed notification page link.

### Gear icon

The separate gear is not necessary in the main header. It adds one more control without a clear primary marketplace role. Prefer one account trigger that opens a user menu with "Account & security". If a gear remains, it should be inside the account menu or account hub, not a top-level competing header action.

### Desktop header recommendation

- Row 1: wordmark, search, location, sell CTA, login/account, compact messages/notifications.
- Row 2: categories mega menu, baby/child quick categories, optional Assistant as secondary.
- Avoid a generic "Marketplace" dropdown. Marketplace is the whole product, not one menu item.

### Mobile header recommendation

- Row 1: menu button, wordmark, sell or account avatar.
- Row 2: full-width search with city chip.
- Drawer: full-height app drawer with account state, search shortcut, category accordion, core marketplace links, account links, language/theme, logout.
- Remove the separate `PublicNavigationDrawer` + header `mobile-nav-panel` duplication.

## Search Audit

- Current header search waits for 3 characters and shows listing result links. It is useful, but small and narrow.
- It does not support recent searches, popular baby/child searches, city context, or a proper search-first overlay.
- Browse search and header search are disconnected in feel.

Recommended flow:

- Typing or focusing search opens a focused overlay.
- User can search product terms first: "bebek arabasi", "oto koltugu", "mama sandalyesi".
- Recent searches are sanitized, trimmed, deduped, length-limited, and stored locally.
- Popular searches appear before categories.
- Category suggestions are secondary, not the main search behavior.
- Submit routes to `/browse?q=<encoded>`.
- Location chip adds `city=...` once backend supports it; until then it should show "City filter coming soon" or be disabled with clear explanation.

## Location Audit

- Current public web does not expose a real city-based browse control.
- Seller/listing data has `locationCity` surfaces, but header/location is not connected to browse filters.
- A static location label risks misleading users.

Recommended location model:

- Header city chip opens selector.
- Selector writes non-sensitive query state such as `/browse?city=istanbul&q=...` when backend supports it.
- Before backend support, show a clear disabled foundation state: "Istanbul selected - city filtering is coming soon".
- Browse active filters should show city alongside q/category/price/condition.

## Category Navigation Audit

- Current category browsing uses API category tree and displays slugs in the sidebar.
- Header has no BabyLoop-specific category IA.
- Drawer categories are generic sections, not baby/child category groups.

Recommended BabyLoop IA:

- Bebek Arabasi & Seyahat
- Oto Koltugu & Guvenlik
- Bebek Odasi & Uyku
- Beslenme
- Bebek Giyim
- Oyuncak & Kitap
- Banyo & Bakim
- Anne Urunleri
- 3-7 Yas Cocuk
- Ucretsiz / Bagis / Takas

Desktop mega menu should use these as primary groups and route to existing category slugs when available, otherwise safe `/browse?q=...` links.

Mobile drawer should use the same groups as accordions.

## Messaging Audit

- The current conversation page puts safety context, assistant link, report user, block user, and safety guide at prominent hierarchy levels.
- Report/block are important but should not dominate normal buyer-seller messaging.
- Message composer includes helpful prompts, but it is visually surrounded by warnings.

Recommended hierarchy:

- Conversation list: inbox first, unread first.
- Conversation detail: compact listing context, message thread, sticky composer.
- Report/block: overflow menu or compact "Safety" drawer.
- Message-level report: hidden behind per-message action menu, not always visible on every bubble.

## Browse Audit

- The browse page contains a discovery panel, filter panel, result summary, active filters, assistant links, guide links, saved search links, results, recently viewed, and pagination.
- The result grid is not the first mental object.
- Category navigation exposes technical slug text.

Recommended hierarchy:

- Search + city + category chips top.
- Results count + sort + active filters.
- Product cards.
- Collapsible filters.
- Save search CTA after filter usage, not before browsing.
- Assistant/guides in side/help surfaces only.

## Listing Detail Audit

- Buyer primary action should be "Message seller".
- Favorite should be secondary.
- Ask Assistant and report should be tertiary.
- Safety checklist should be collapsible or inline under "What to check", not several large cards.
- Seller card should be close to CTA and concise.

Recommended above-the-fold:

- Image gallery.
- Title, price, status, condition, location.
- Seller summary.
- Message seller CTA.
- Favorite.
- Short safety checklist link.

## Home Audit

Home should be marketplace landing, not product platform brochure.

Keep:

- Search.
- City.
- Popular categories.
- Featured/latest listings if available.
- Sell CTA.
- Short trust note.

Reduce/remove:

- Product ecosystem explanations.
- Marketplace loop theory.
- Trust architecture card.
- Assistant CTA block as primary section.
- Repeated guide/safety framing.

## Account/Profile Audit

Recommended account model:

- User menu:
  - Profile/account hub
  - My listings
  - Favorites
  - Messages
  - Notifications
  - Logout
- Account hub:
  - Profile basics
  - Security/password/MFA placeholders
  - Notification preferences placeholder
  - Saved searches
  - Child profiles
  - Seller tools
  - Payment tools placeholder

## Assistant/Guides Audit

- Assistant and guides are valuable, but currently over-explain controlled modes, grounding, AI boundaries, and internal product strategy.
- They should not compete with browse/listing/message flow.
- Safety boundaries should be short, contextual, and repeated only where needed.
- RAG/hallucination/grounding language belongs in docs/admin/internal surfaces, not public marketplace UI.

## P0 Summary

1. Rebuild header/navigation IA around search, location, category, sell, account.
2. Make `/browse` result-first and collapse advanced/help content.
3. Rebuild listing detail CTA hierarchy around "Message seller".
4. Simplify messaging into inbox/thread/composer first; move report/block to safety menus.
5. Add a real account hub IA and simplify user menu.
6. Start i18n/content reduction because the mixed EN/TR copy is now visible across core routes.
