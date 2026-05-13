# User Roles and Permissions

## Role Definitions

| Role | Definition |
| --- | --- |
| Guest | Unauthenticated visitor who can browse public listings and limited guide content. |
| Registered user | Authenticated user with profile, saved items, searches, and messaging eligibility. |
| Buyer | Registered user who can contact sellers, make offers, buy, rent, request donation items, and review transactions. |
| Seller | Registered user who can create listings, manage inventory, receive messages, accept offers, and view seller analytics. |
| Parent profile owner | User who manages child profile data such as age range, preferences, budget, and product-stage needs. |
| Moderator | Staff user who reviews reported content, risky messages, suspicious listings, and AI moderation queues. |
| Admin | Staff user who manages marketplace operations, categories, content, reports, analytics, and user support. |
| Super admin | Highest-privilege operator who manages staff access, critical configuration, AI prompt approvals, and audit review. |

Users can hold multiple functional roles. For example, a registered user becomes a buyer when making purchase-related requests and becomes a seller when creating listings. The matrix below describes eventual platform permissions; early phases should expose only the subset implemented in the current roadmap step.

## Permission Matrix

| Capability | Guest | Registered | Buyer | Seller | Parent owner | Moderator | Admin | Super admin |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Browse public listings | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Search and filter listings | Limited | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Save favorites/searches | No | Yes | Yes | Yes | Yes | No | No | No |
| Create parent profiles | No | Yes | Yes | Yes | Yes | No | No | No |
| Create listings | No | No | No | Yes | If seller | No | No | No |
| Use AI listing helper | No | No | No | Yes | If seller | No | No | No |
| Use AI valuation | No | No | No | Yes | If seller | Yes | Yes | Yes |
| Send messages | No | Yes | Yes | Yes | Yes | Limited | Limited | Limited |
| Make buy/rent/swap/donation requests | No | No | Yes | If buyer | If buyer | No | No | No |
| Report listing/user/message | No | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Review moderation queue | No | No | No | No | No | Yes | Yes | Yes |
| Override AI moderation result | No | No | No | No | No | Yes | Yes | Yes |
| View marketplace analytics | No | No | No | Seller-only | No | Limited | Yes | Yes |
| Manage categories and policies | No | No | No | No | No | No | Yes | Yes |
| Manage staff permissions | No | No | No | No | No | No | No | Yes |
| Approve production AI prompt versions | No | No | No | No | No | No | Limited | Yes |

## Admin and Moderator Capabilities

Moderators should be able to:

- review flagged messages, listings, users, and images
- see AI risk scores, reasons, and evidence
- issue warnings, message blocks, rate limits, temporary restrictions, and escalation recommendations
- request more seller information for safety-sensitive items
- record human decisions and override reasons

Admins should be able to:

- manage categories, attributes, guide content, and platform policies
- review marketplace-level analytics
- inspect AI task logs and prompt versions
- configure moderation thresholds with super admin approval for high-impact actions
- manage support cases and dispute workflows
- export limited operational reports

Super admins should be able to:

- manage admin/moderator access
- approve production prompt versions
- manage sensitive platform configuration
- review audit logs for staff actions
- approve high-risk automation changes

## Safety Restrictions

- AI must not permanently ban users without human review.
- Gender-based restrictions must not be used. Risk scoring must be behavior-based.
- Critical baby safety categories must show warnings and checklists, not safety guarantees.
- Admin AI analytics must be read-only.
- Staff access to private user data must be minimized and audited.
- Sensitive actions must write audit logs.
- Moderation decisions must keep evidence, reason, actor, timestamp, and override status.

## Future RBAC Considerations

The first production model should support role-based access control with permission checks at the API layer. Later phases can add:

- organization/team roles for professional sellers
- region-based moderation assignment
- scoped support-agent permissions
- temporary elevated access with expiration
- field-level privacy controls
- permission change audit logs
