# Public Web Redesign Information Architecture

This document proposes the next public web IA for BabyLoop. It is intentionally implementation-facing but does not change code by itself.

## Product Principle

BabyLoop is a baby/child-focused marketplace for roughly 0-7 age needs. It is not a generic classifieds product.

Primary path:

1. Search for a product or need.
2. Refine by city/category/filter.
3. Open a listing.
4. Message seller.
5. Save/favorite/create saved search when not ready.

Secondary support:

- Guides.
- Assistant.
- Safety/report/block.
- Child profiles.
- Seller analytics.

These should help the primary path without taking over the interface.

## Header Top Row

Desktop top row should contain only high-frequency marketplace controls:

| Area | Content | Behavior |
|---|---|---|
| Brand | `babyloop` wordmark | Links to `/`. No duplicated "BL" badge plus wordmark unless brand system requires it. |
| Search | Prominent marketplace search | Focus opens search overlay. Enter submits to `/browse?q=...`. |
| Location | City selector/chip | Default `Istanbul, Turkiye`; disabled or foundation state until backend city filtering exists. |
| Sell CTA | `Ilan ver` / `Sell` | Links to `/sell`; if logged out, auth gate happens on sell page or modal. |
| Auth/account | Login button or account avatar/name | Login opens modal; account opens compact menu. |
| Activity | Messages and notifications | Compact icons/text with badge; no long labels on narrow desktop. |
| Preferences | Language and theme | Compact controls; not visually stronger than search/sell. |

Remove from top row:

- Full account link list.
- Assistant as primary action.
- Guides.
- Favorites.
- Saved searches.
- Child profiles.
- Seller dashboard.
- Gear icon as a separate primary control.

## Header Second Row

Second row is for discovery:

| Slot | Content |
|---|---|
| Category trigger | `Tum kategoriler` with menu icon and mega menu. |
| Quick categories | 5-7 BabyLoop-specific shortcuts. |
| Optional helpers | `Assistant` as a small secondary link, not primary. |

Recommended quick category links:

- Bebek arabasi
- Oto koltugu
- Mama sandalyesi
- Park yatak
- Oyuncak & kitap
- Bebek giyim
- Ucretsiz / bagis

## Desktop Mega Menu Structure

The mega menu should be stable and BabyLoop-specific.

Left column:

- Primary category groups with simple icons.
- Active group highlighted.
- Keyboard focus should follow button semantics.

Right panel:

- Group title.
- 6-10 safe subcategory/search links.
- Optional short helper text.
- "Tum ilanlari gor" link.

Recommended groups:

| Group | Example links |
|---|---|
| Bebek Arabasi & Seyahat | Bebek arabasi, puset, portbebe, kanguru, seyahat sistemi |
| Oto Koltugu & Guvenlik | Oto koltugu, ana kucagi, guvenlik kapisi, bebek telsizi |
| Bebek Odasi & Uyku | Besik, park yatak, yatak, uyku tulumu, oda mobilyasi |
| Beslenme | Mama sandalyesi, biberon, sterilizator, sut pompasi, mama onlugu |
| Bebek Giyim | 0-3 ay, 3-6 ay, 1 yas, 2 yas mont, ayakkabi |
| Oyuncak & Kitap | Montessori oyuncak, egitici oyuncak, kitap, puzzle, aktivite masasi |
| Banyo & Bakim | Bebek kuveti, bez degistirme, bakım cantasi, hijyen |
| Anne Urunleri | Hamile giyim, emzirme, lohusa ihtiyaclari |
| 3-7 Yas Cocuk | Bisiklet, scooter, kitap, okul oncesi oyuncak, kiyafet |
| Ucretsiz / Bagis / Takas | Ucretsiz bebek kiyafeti, bagis, takas, ihtiyac fazlasi |

Routing rule:

- Use existing `/categories/[slug]` only when the slug exists in API category data.
- Otherwise use `/browse?q=<encoded term>`.
- Do not create links to non-existing pages.

## Mobile Drawer Structure

The mobile drawer should replace both current drawer systems with one full-height app drawer.

Sections:

1. Account state
   - Logged out: Login, Create account, "login unlocks messages/favorites/selling".
   - Logged in: display name/initials, Account hub, Logout.
2. Search shortcut
   - Focuses or routes to `/browse`.
3. Sell CTA
   - Prominent.
4. Category accordion
   - Same groups as desktop mega menu.
5. Marketplace links
   - Browse, Favorites, Saved searches, My listings.
6. Activity
   - Messages, Notifications.
7. Support
   - Assistant, Guides.
8. Preferences
   - TR/EN, dark/light.

Drawer behavior:

- Full viewport height.
- Overlay/backdrop.
- Body scroll lock.
- Escape closes.
- Close button in top-right.
- Accordion state local only.
- No account token or sensitive state in storage.

## User Menu Structure

The account menu should be concise:

Primary:

- Account hub
- My listings
- Favorites
- Messages
- Notifications
- Logout

Secondary inside account hub:

- Seller dashboard
- Saved searches
- Child profiles
- Account security
- Notification preferences
- Payment tools placeholder

Remove from direct user menu:

- Email verification unless account state requires it.
- Long descriptions.
- Gear as separate top-level control.

## Account/Profile Hub Structure

Proposed route: `/account`.

Sections:

| Section | Purpose |
|---|---|
| Profile basics | Display name, city, public profile preview. |
| Marketplace shortcuts | Favorites, saved searches, messages, notifications. |
| Seller tools | My listings, seller dashboard, create listing. |
| Family planning | Child profiles, suggested saved searches. |
| Security | Password, MFA/OTP placeholder, trusted devices placeholder, login notifications placeholder. |
| Preferences | Language, theme, notification preferences placeholder. |
| Payments | Future external agreement + safe payment mode placeholder. |

This hub should prevent the header/user menu from becoming a route dump.

## Search Overlay Structure

Search overlay should appear on focus/click of desktop search and mobile search.

Content order:

1. Search input with current query.
2. Submit/view results button.
3. Recent searches.
4. Popular searches.
5. Suggested category groups.
6. Optional "sell this item" helper for empty results later.

Behavior:

- Enter submits.
- Escape closes.
- Recent searches are stored locally after sanitization:
  - trim;
  - collapse whitespace;
  - max length around 64-80 chars;
  - max count around 6-8;
  - dedupe case-insensitively.
- Category suggestions are secondary. User should feel they are searching products, not forced to choose taxonomy first.

Popular searches:

- Bebek arabasi
- Oto koltugu
- Mama sandalyesi
- Park yatak
- Montessori oyuncak
- 2 yas mont
- Ucretsiz bebek kiyafeti

## Location Selector Structure

MVP:

- Header chip: `Istanbul, Turkiye`.
- Click opens small selector.
- If backend filter is missing, show disabled cities with "City filtering coming soon".

Future:

- Supported city list.
- Use query param, for example `/browse?city=istanbul&q=...`.
- Browse active filters show city chip.
- Saved searches include city when selected.
- Header remembers last selected city using non-sensitive local preference only if product approves it.

## Page-Level Primary Actions

| Page | Primary action | Secondary action | Tertiary/helper |
|---|---|---|---|
| Home | Search marketplace | Browse category / Sell | Assistant, guides |
| Browse | Open listing | Save search / refine filters | Assistant, guides |
| Category | Open listing | Switch category / filter | Guide for category |
| Listing detail | Message seller | Favorite | Report, ask assistant, guide |
| Sell | Submit listing | Upload images | AI suggestions, seller guide |
| My listings | Manage listing status/edit | Create listing | Seller dashboard |
| Seller dashboard | Improve/open listing | Manage listings | Ask seller assistant |
| Favorites | Open listing | Remove favorite | Ask comparison assistant |
| Saved searches | Open results | Delete/edit alert | Child profile link |
| Child profiles | Add/edit age band | Create saved search | Guides/assistant |
| Conversations | Open unread thread | Filter/search conversations | Safety note |
| Conversation detail | Send message | View listing context | Report/block in safety menu |
| Notifications | Open update | Mark read/all read | Filter |
| Guides | Read guide | Browse related listings | Assistant prompt |
| Guide detail | Read checklist | Find related listings | Save search/assistant |
| Assistant | Send prompt | Use quick prompt | Browse/sell/guides |
| Login/register | Submit auth form | Google/full account link | Security note |
| Password/recovery | Submit form | Back to login | Short security note |

## Implementation Sequence Recommendation

1. Header/search/drawer IA cleanup.
2. Browse result-first layout.
3. Listing detail CTA hierarchy.
4. Messaging thread/inbox simplification.
5. Account hub + user menu cleanup.
6. Content reduction across home/account/guides/assistant/auth.
7. i18n dictionary consolidation.
8. Visual polish and responsive QA.
