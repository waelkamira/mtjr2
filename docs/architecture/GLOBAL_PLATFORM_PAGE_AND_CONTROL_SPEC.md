# Global Marketplace Page, Dashboard and Control Specification

**Status:** Target functional specification; not an implementation-completion claim.  
**Applies to:** Public storefront, customer account, seller center, platform administration, restricted finance/security/operations, and the separate property domain.  
**Companion documents:** [49-system blueprint](COMPLETE_PLATFORM_SYSTEMS_BLUEPRINT.md) · [Page-to-system map](PLATFORM_PAGE_SYSTEM_MAP.md) · [Route inventory](PLATFORM_PAGE_INVENTORY.md) · [Journey matrix](../implementation/END_TO_END_JOURNEY_MATRIX.md) · [Prisma model map](PRISMA_MODEL_USAGE_MAP.md)

## Independent implementation specification for every system

The 49 systems now have separate implementation contracts under [`docs/systems/`](../systems/README.md). Start with [`docs/systems/README.md`](../systems/README.md). Each file defines system boundaries, target pages and source presence, UI-to-API-to-Prisma flow, integration contracts, critical tests and closeout gates. This global document remains the cross-platform page/control and global-launch reference; it does not replace system-level specifications.

## 1. Is the 49-system scope sufficient?

The 49 systems are a strong business capability inventory, but **the number 49 alone is not proof of global-marketplace completeness**. Several global, financial, regulatory, operational and governance capabilities need to be explicit acceptance domains rather than being hidden inside broad labels. The following are mandatory capabilities for a serious international multi-vendor marketplace; implement them as modules under existing systems where boundaries are clear, or split them into separately tracked systems if their ownership, data lifecycle or risk justifies it:

1. **Merchant legal entity and KYB:** legal entity, beneficial ownership, representatives, business registry evidence, tax identity, document expiry, sanctions/adverse-media screening where legally required, review decisions and re-verification.
2. **Product compliance and safety:** restricted/prohibited goods, market eligibility, age-gated goods where lawful, certifications, recall/incident handling, seller/manufacturer traceability, required warnings and document expiry.
3. **International trade and landed cost:** origin country, HS/customs classification, export/import restrictions, duties, customs broker data, Incoterms where relevant, import VAT, landed-cost estimate and disclosure. Do not launch a market until legal/tax/shipping decisions are approved.
4. **Tax determination and evidence:** jurisdiction rules, seller nexus/registration where applicable, tax-inclusive/exclusive pricing, exemptions, invoice requirements, tax calculation evidence and filing exports. A simple percentage tax table is not a global tax engine.
5. **Payment orchestration and financial control:** payment methods by market/currency, authorization/capture/void, 3DS/SCA where required, refunds, partial refunds, chargebacks/disputes, provider webhooks, settlement, fees, reconciliation and idempotency.
6. **Seller settlement and treasury:** payable balance, reserves/holds, negative balance, payout schedule, bank account verification, payout failures, FX conversion disclosure, reconciliation and accounting ledger.
7. **Logistics and delivery promise:** carrier/service availability, dimensional/weight rules, zones, label/tracking, customs documents, split shipments, delivery exceptions, proof of delivery and returns routing.
8. **Privacy and data governance:** consent and preference history, data access/export/deletion workflows, retention schedules, legal holds, data residency assessment, processor/subprocessor register and breach response.
9. **Fraud, abuse and marketplace integrity:** account takeover, payment fraud, seller collusion, fake reviews, promo abuse, bot/rate abuse, suspicious orders, case management, evidence and appeal.
10. **Customer and seller lifecycle communications:** verified transactional email/SMS/push provider, templates/localization, consent, suppression, delivery/bounce logs and retry; in-app notifications alone are not complete communications.
11. **Platform reliability and incident operations:** service health, structured logs, traces, metrics, alerts, incident records, status communication, backup/restore evidence, disaster recovery objectives and runbooks.
12. **B2B/wholesale (optional business decision):** company buyer accounts, tax IDs, quote requests, negotiated price lists, purchase orders, credit terms and approval workflows. Do not build unless the business model requires it.
13. **Affiliate/referral/advertising (optional business decision):** attribution, campaign approvals, disclosure, click/conversion fraud, billing and payouts. Do not mix paid placement with organic search without labeling.
14. **Multi-region architecture and localization:** locale-aware content, currencies, units, address/phone formats, time zones, language fallback, translated policies, regional availability and market-specific feature controls.

Every optional capability must have an explicit decision: in scope now, later, or out of scope. A placeholder menu item is not implementation.

## 2. Platform role model and control boundaries

The platform must support a **root platform owner / super administrator** role, but “full control” must not mean an unlogged, unreviewable ability to bypass financial or security invariants.

### Platform owner / root administrator

Can configure global platform governance, create and delegate roles, activate approved markets, configure platform policy, appoint administrators, inspect cross-domain health and authorize exceptional actions. Root access requires strong MFA, short privileged sessions, re-authentication for critical actions, immutable audit, alerts, and preferably dual approval for high-risk operations. No person should be able to silently change the ledger or erase audit evidence.

### Domain administrators

Separate permissions for identity/users, sellers/KYB, catalog/compliance, orders, support, marketing/CMS, markets/localization, logistics, tax, finance, risk, integrations, security and operations. Admin role names do not automatically imply permission to all domains.

### Finance and treasury

Can inspect and operate approved financial workflows: payment investigations, refunds, disputes, ledger, reconciliation, reserves and payouts. High-risk money movement requires limits, idempotency, dual control and independent reconciliation. Support staff cannot issue refunds merely because they can view an order.

### Support and moderation

Can access the minimum customer/order information needed for assigned cases. Internal notes remain private; KYC documents, full payment credentials, secrets and unrelated customer records are not exposed.

### Seller owner and store staff

All access is store-scoped. The server resolves active store membership, role, permission and resource ownership for every read and write. Switching store context never grants access to another seller's records.

### Buyer

Can access only their own profile, addresses, carts, orders, messages, returns, reviews, payments/invoices and privacy requests.

**Enforcement rule:** hiding a button or menu item is not authorization. Every API/service operation checks authenticated actor, role, permission, resource ownership/scope, state transition, market eligibility and audit requirements on the server.

## 3. Public storefront — page-by-page contents

### 3.1 Global shell on every public page

- Header: logo/home, global search, categories/brands navigation, market/language/currency selector, account, favorites, cart, mobile navigation.
- Search supports suggestions, recent searches only with appropriate consent, clear query, keyboard navigation, accessible result count and safe URL state.
- Market selector explains availability, currency, language, delivery destination and any effect on cart/price; changing market revalidates cart and checkout.
- Footer: company/contact, help, policies, seller entry, accessibility, privacy/cookie controls, newsletter consent, and supported-market information.
- Shared states: loading, empty, unavailable market, forbidden, not found, rate limited, offline/retry, maintenance and recoverable error.

### 3.2 Home — `/`

- Market-aware hero and approved campaign banners from CMS.
- Category navigation/grid; featured, trending, new and recommended products only when backed by defined query/ranking logic.
- Brands, stores and seller discovery.
- Trust/delivery/payment information only for supported markets and configured providers.
- Search entry, recently viewed only with appropriate privacy behavior, editorial content and newsletter opt-in.
- Every product/store card links to a canonical detail page and uses live published data; no fake stock, ratings, discounts or sales.

### 3.3 Search and discovery — `/search`, `/products`, category/brand/store listings

- Query, autocomplete, spelling/synonym handling, relevance ranking and safe query persistence.
- Facets based on available product attributes: category, brand, price, seller/store, availability, rating, shipping, condition where supported.
- Sort: relevance, newest, price ascending/descending, popularity only with a defined trustworthy metric.
- Pagination/cursor, result count, active filter chips, clear filters, no-result suggestions and error/retry.
- Search analytics must respect privacy and must not leak private/seller-only products.
- Admin search controls belong in a restricted catalog/search console with change history and rollback.

### 3.4 Category, brand, store and seller public pages

- Canonical localized name/slug, description, SEO metadata and breadcrumb.
- Published eligible products only; market, stock, price, filters and pagination.
- Store page: verified identity indicators only when earned, policies, service areas, delivery/return terms, published reviews, Q&A/contact, products and store status.
- Seller identity and store identity remain distinct; one seller may own multiple stores.

### 3.5 Product detail — `/products/[slug]`

- Product title, media gallery/video where supported, description, specifications, variants, identifiers, brand and category.
- Market/currency-aware price, tax inclusion disclosure, stock/availability, shipping estimate only when calculated, seller/store identity and policies.
- Variant-specific availability and price; quantity limits; add-to-cart and favorite.
- Compliance warnings, age/restriction checks and market availability.
- Reviews and verified-purchase status, Q&A, report listing, store contact.
- Clear states for unavailable variant, out of stock, recalled/restricted, seller suspended, stale price and changed market.
- No direct client trust in price, discount, stock, seller ID or eligibility.

### 3.6 Cart — `/cart`

- Guest/customer cart ownership and safe merge after sign-in.
- Product/variant, store grouping, quantity, price snapshot/current price, stock, shipping eligibility and market.
- Update/remove/save-for-later, invalid/changed item warnings, coupon/gift card application where enabled.
- Reprice/revalidate before checkout; show subtotal and estimated charges without pretending they are final.
- Handle split shipments and multi-seller fulfillment clearly.

### 3.7 Checkout — `/checkout`

- Sign-in/guest continuation according to policy.
- Delivery address and contact; market/country eligibility.
- Shipment grouping, service choice, delivery promise and shipping cost from configured providers/rules.
- Tax/duty/import-fee treatment and disclosure appropriate to market.
- Coupon, store promotion, loyalty/gift card, wallet/credit only when configured.
- Final review with item, seller, currency, tax, shipping, discounts and grand total snapshots.
- Payment method/provider, required authentication (e.g. 3DS/SCA where applicable), idempotent submit, pending/failed/retry states.
- Server-created order and inventory reservation/commit follow defined transaction/state machine; success only after authoritative provider event or approved payment policy.
- Do not store raw card data. Do not create a paid order based only on a client redirect.

### 3.8 Public support/legal/system pages

- Help center, FAQ, contact, policies, shipping/returns, seller terms, privacy, cookies, accessibility, market-specific disclosures, status/maintenance and 403/404/error pages.
- Policy version and acceptance records are versioned and discoverable.
- Legal content must be reviewed for each launch jurisdiction; no generic placeholder is represented as legal advice.

## 4. Customer account — full menu and page contents

Account shell: overview, profile, addresses, orders, favorites, reviews, questions, messages, notifications, returns, support, payment/invoice history, loyalty (if enabled), privacy, security, sign out.

| Route | Required content and actions |
|---|---|
| `/account` | Account overview, recent orders, pending actions, returns/messages/notifications shortcuts, security alerts. |
| `/account/profile` | Profile data, verified contact details, language/locale and controlled account changes. |
| `/account/addresses` | Add/edit/delete, validation, default address, country/region/postal rules; protect addresses used in immutable order snapshots. |
| `/account/security` | Password change, MFA/passkeys when implemented, recovery methods, recent security activity. |
| `/account/sessions` | Active sessions/devices, revoke one/all other sessions, current session indication. |
| `/account/orders` | Search/filter/paginate order history, payment and fulfillment status. |
| `/account/orders/[orderId]` | Items, seller/vendor shipments, totals, invoices, tracking, eligible cancel/return/dispute actions, status timeline and support. |
| `/account/wishlist` | Saved items, availability/price change, remove and move-to-cart. |
| `/account/reviews` | Eligible purchases, write/edit/delete per policy, moderation status and seller response. |
| `/account/questions` | Questions, seller answers and report action. |
| `/account/messages` | Store conversations, participant identity, unread state and report/block controls. |
| `/account/notifications` | Inbox, categories, read state, preferences and channel consent. |
| `/account/returns` | Eligibility, reason, evidence upload, return label/instructions if configured, status and history. |
| `/account/support` | Tickets, attachments, customer-visible replies, escalation and status. |
| `/account/payments` | Provider tokenized methods only if supported, payment history and receipts; never raw PAN/CVV. |
| `/account/invoices` | Issued invoices/credit notes and downloadable records. |
| `/account/loyalty` | Points ledger, expiry, rewards and redemption rules only if active. |
| `/account/privacy` | Consent, marketing preferences, data export/access/deletion requests, request status and retention/legal-hold explanation. |
| `/logout` | Revoke/invalidate session, clear session cookie, prevent cached protected data from reappearing, redirect to safe public destination and show signed-out state. |

## 5. Seller center — full workspace

Seller shell must show selected store, market context, role, actionable alerts, support, notifications and sign out. Store switcher lists only stores the actor may access.

| Route / area | Required content and actions |
|---|---|
| `/sell`, `/seller/apply` | Seller proposition, requirements, market availability, legal entity details, KYB documents, terms/consent and save/resume. |
| `/seller/application` | Status, reviewer requests, missing/expired documents, resubmission, decision history; pending applicant has no active seller privileges. |
| `/seller` | Real GMV/net sales definition, orders requiring action, low stock, disputes/returns, listing health, payout status, store health and quick actions. |
| `/seller/store` | Store profile, logo/media, description, contacts, policies, locale, supported markets, public preview and verification status. |
| `/seller/products` | Search/filter by draft/pending/approved/rejected/archived, stock, category, bulk-safe operations and export. |
| `/seller/products/new`, edit | Product data, translations, variants, attributes, identifiers, media, compliance evidence, market pricing, shipping dimensions, preview and submission. |
| `/seller/inventory` | SKU/variant stock by warehouse, reserved/available quantity, movement history, adjustment with reason, low-stock threshold. |
| `/seller/warehouses` | Warehouse locations, operating rules, stock transfers, receiving and reconciliation. |
| `/seller/orders` | Store-only vendor orders, deadlines, payment/fulfillment status, filters, export and bulk actions with per-item result. |
| `/seller/orders/[id]` | Buyer delivery details limited to fulfillment need, line items, pick/pack, shipment, tracking, allowed status transitions and audit. |
| `/seller/shipping` | Supported carrier/service connection, zones, rate tables, handling times, cutoff, restrictions, labels/tracking and exceptions. |
| `/seller/returns` | Return request, evidence, policy, approve/reject/escalate, return receipt and condition; refund is a separate finance operation. |
| `/seller/reviews`, `/seller/questions` | Responses, moderation state, report escalation and store reputation. |
| `/seller/messages` | Customer conversations, attachments, response templates and abuse reporting. |
| `/seller/staff` | Invite/revoke staff, store-scoped roles, granular permissions, invitation status and access audit. |
| `/seller/marketing` | Eligible promotions, coupons, campaign schedule, budget/limits and performance with attribution definition. |
| `/seller/analytics` | Sales by time/product/market, conversion if instrumented, returns, fulfillment, inventory aging and exports. |
| `/seller/finance` | Gross/net balance, fees/commission breakdown, reserves/holds, adjustments, downloadable statements and reconciliation status. |
| `/seller/payouts` | Verified payout destination status, schedule, payable amount, payout history, failure reason and dispute/hold explanation. Seller cannot approve its own payout. |
| `/seller/invoices` | Issued seller invoices/credit notes and fee/tax documents. |
| `/seller/settings` | Store preferences, notification channels, localization, security, API credentials only if a secure integration program exists. |
| `/seller/logout` | End session safely; store context must not persist as authorization after sign-out. |

## 6. Platform administration — full control center

The admin console is a separate application shell with global search, market selector, alert center, task queues, help/runbooks, profile/security and sign out. It must not be one giant page: use domain workspaces and permission-filtered navigation.

### 6.1 Root dashboard — `/admin`

- Platform health: API/web/database/provider status, queue/job failures, error rate, latency and incidents.
- Business pulse: GMV, paid orders, cancellations, refunds, active buyers/sellers/stores, catalog/listing counts. Each metric shows definition, time range, timezone, currency and source freshness.
- Risk/operations: payment failures, chargebacks, suspicious orders, overdue seller applications, product compliance queues, shipment exceptions, support SLA, low stock where relevant.
- Finance snapshot: gross collected, refunds, fees, seller payable, payout status, settlement/reconciliation variance; ledger-derived and permission-gated.
- Work queue: assigned tasks and escalations; alerts deep-link to authorized detail pages.
- Market switcher and global/market-specific filters.
- Never show fabricated values or expose finance/security data to roles without permission.

### 6.2 Admin global search and command center

- Search users, sellers, stores, products, orders, tickets, payouts, invoices and audit events with type filters.
- Search result masking and access checks; sensitive records require explicit permission and reason.
- Recent records, saved filters, operational queues, assignment and bulk actions with dry-run/confirmation where destructive.
- No global search result may bypass resource-level authorization.

### 6.3 Identity and access administration

Routes: `/admin/users`, `/admin/users/[id]`, `/admin/roles`, `/admin/permissions`, `/admin/admins`, `/admin/sessions`.

- User lookup, profile/status, verification, consent, login/security history, account restriction/restore, support notes with restricted visibility.
- Admin invitation, role assignment, least privilege, time-bound elevation, revoke access and session revocation.
- Role/permission matrix, scope constraints, preview of effective permissions and audit.
- Root administrator creation/recovery requires stronger controls and cannot be silently self-approved.
- Do not expose passwords, tokens, OAuth secrets or full payment credentials.

### 6.4 Seller, store and KYB administration

Routes: `/admin/sellers`, `/admin/sellers/[id]`, `/admin/stores`, `/admin/stores/[id]`, `/admin/kyb`.

- Applications queue, risk score only if explainable/validated, legal entity/beneficial ownership, documents and expiry.
- Review checklist, request-more-information, approve/reject/suspend/reinstate with reason and history.
- Store market eligibility, policies, public preview, ownership/staff and health.
- Sanctions/verification providers only where configured and lawful; keep evidence and reviewer access audited.

### 6.5 Catalog, taxonomy and product compliance

Routes: `/admin/catalog`, `/admin/products`, `/admin/products/[id]`, `/admin/categories`, `/admin/brands`, `/admin/attributes`, `/admin/compliance`, `/admin/recalls`.

- Product review queue, bulk import validation, duplicate detection, category/brand/attribute governance.
- Restricted goods by market, certifications, safety warnings, recalls, listing takedown and appeal.
- Media/content moderation, translation quality/status, version history and audit.
- Search relevance/synonyms/redirects and indexing status.
- Changes invalidate/rebuild derived search/cache/SEO data safely.

### 6.6 Market, currency, locale and localization administration

Routes: `/admin/markets`, `/admin/countries`, `/admin/currencies`, `/admin/exchange-rates`, `/admin/locales`, `/admin/translations`.

- Market lifecycle: draft, review, active, suspended; activation checklist for legal, tax, payment, shipping, support and seller coverage.
- Currency precision/minor units, FX source, effective time, spread/rounding policy and historical rate snapshots.
- Country/state/city/postal/address reference data; language, units, time zones and fallback.
- Translation workflow, missing-content reports and versioned market policies.
- Never activate a market or publish FX/tax values without approved sources and responsible owner.

### 6.7 Order operations

Routes: `/admin/orders`, `/admin/orders/[id]`, `/admin/fulfillment`, `/admin/exceptions`.

- Parent order and vendor-order relationship, immutable purchase snapshots, payment, stock reservation, shipments, delivery and event timeline.
- Investigate, annotate, escalate and perform explicitly allowed state transitions with reason and audit.
- Cross-store view is admin-only; seller sees only its vendor order.
- No silent edits to totals, order items, currency or historical address.

### 6.8 Payments, refunds, disputes and fraud

Routes: `/admin/payments`, `/admin/payments/[id]`, `/admin/refunds`, `/admin/disputes`, `/admin/risk`, `/admin/risk/cases/[id]`.

- Provider and intent state, authorization/capture/void, webhook signature/deduplication, reconciliation and provider event evidence.
- Full/partial refunds, eligibility, limits, approvals, provider result, ledger posting and customer communication.
- Chargeback deadlines, evidence bundle, response submission and outcome.
- Fraud case queues, rules/threshold version, decision reason, manual review, appeal and false-positive monitoring.
- Payment support staff can inspect limited status; only finance roles can initiate permitted money movement.

### 6.9 Finance, ledger, commissions, settlement and payouts

Routes: `/admin/finance`, `/admin/finance/ledger`, `/admin/finance/journals`, `/admin/commissions`, `/admin/settlements`, `/admin/reconciliation`, `/admin/payouts`, `/admin/payouts/[id]`.

- Double-entry journals, chart of accounts, immutable posted entries, reversals not destructive edits.
- Commission rule versioning/effective dates, seller payable computation, fees, reserves, refunds and adjustments.
- Provider settlement imports, matching, unmatched transactions and variance resolution.
- Payout destination verification, maker-checker approval, batch controls, failure/retry and bank/provider references.
- Period close, exports, tax reports and reconciliation sign-off.
- Every financial screen displays currency, timezone, accounting period, source and reconciliation status.

### 6.10 Shipping, customs, tax and regulatory administration

Routes: `/admin/shipping`, `/admin/carriers`, `/admin/customs`, `/admin/tax`, `/admin/compliance`.

- Service/zone/rate/weight-dimension rules, coverage, delivery promises and carrier health.
- Customs classification, origin, documentation, duty/fee logic and prohibited export/import checks.
- Tax registrations/rules, inclusive/exclusive prices, exemption evidence, invoice rules and effective dates.
- Returns logistics, lost/damaged parcels, delivery proof and claims.
- Market launch checklist blocks unsupported tax/shipping promises.

### 6.11 Trust, support and communication administration

Routes: `/admin/reviews`, `/admin/questions`, `/admin/support`, `/admin/support/[ticketId]`, `/admin/communications`, `/admin/templates`.

- Moderation queues, policy reason, evidence, appeal and publication status.
- Support assignment, SLA, escalation, customer-visible response vs. internal note separation.
- Email/SMS/push provider health, template versions/translations, delivery/bounce/suppression, retry and consent checks.
- Never expose internal notes or sensitive documents to the customer/seller.

### 6.12 Promotions, CMS, SEO and growth administration

Routes: `/admin/promotions`, `/admin/coupons`, `/admin/loyalty`, `/admin/campaigns`, `/admin/content`, `/admin/banners`, `/admin/pages`, `/admin/seo`, `/admin/newsletter`.

- Global vs. seller-funded campaign ownership, eligibility, budget, limits, stacking, abuse and financial liability.
- Draft/review/schedule/publish/unpublish content with preview, locale, market and revision history.
- SEO metadata, canonical/redirect rules, sitemap/indexing health and structured-data validation.
- Newsletter consent, segmentation rules, suppression/unsubscribe and campaign results.
- Clearly label sponsored placement; do not misrepresent paid ranking as organic relevance.

### 6.13 Integrations, APIs, webhooks and developer controls

Routes: `/admin/integrations`, `/admin/integrations/[id]`, `/admin/api-clients`, `/admin/webhooks`, `/admin/webhook-events`.

- Provider registry, environment, capability/market mapping, health and test/live status.
- Credentials stored in secret manager; UI shows masked metadata only, rotate/revoke workflow.
- API client scopes, rate limits, key rotation, callback allowlists and audit.
- Webhook signing, retries, idempotency, delivery history, dead-letter replay and payload redaction.
- Never permit arbitrary callback URLs or reveal secrets after creation.

### 6.14 Jobs, observability, incidents and platform settings

Routes: `/admin/operations/jobs`, `/admin/operations/events`, `/admin/operations/health`, `/admin/operations/incidents`, `/admin/backups`, `/admin/settings`, `/admin/feature-flags`.

- Job/event status, retry policy, deduplication, dead-letter queues and safe replay.
- Service health, logs/traces/metrics links, alerts and incident timelines.
- Backup status, restore test evidence, retention and disaster recovery objectives.
- Feature flags with owner, scope, expiry, staged rollout and kill switch.
- Environment configuration separated from secrets; dangerous settings require re-authentication and approval.

### 6.15 Security, privacy, audit and legal governance

Routes: `/admin/security`, `/admin/audit-log`, `/admin/privacy-requests`, `/admin/retention`, `/admin/legal`, `/admin/risk`.

- Immutable audit search/export with actor, action, target, reason, before/after safe diff, request/correlation ID and timestamp.
- Security incidents, suspicious sessions, privileged access reviews, key rotation and vulnerability status.
- Data subject requests, consent, retention/deletion jobs, legal holds and processor register.
- Policy/version publication, legal approvals, jurisdiction and effective dates.
- Audit deletion/edit is prohibited for normal admins; corrections are appended as new events.

## 7. Restricted operations workspace

Keep high-risk operational tooling separate from routine admin menus. Access is granted by explicit roles and may require just-in-time elevation:
- Finance and treasury operations.
- Security and incident response.
- Infrastructure, jobs, event replay and deployment health.
- Data export, privacy deletion and retention execution.
- Fraud/risk investigations and law-enforcement/legal requests.
- Emergency controls and market kill switches.

Root admin can govern access and see status, but high-risk actions still obey dual-control, approval, audit and immutable financial/security invariants.

## 8. Separate property and booking domain

Keep `/properties`, `/properties/[slug]`, `/property/submit`, `/account/property-requests`, owner/agent workspaces and property administration separate from product commerce. Define separate listing, availability, booking-request, contract, deposit/payment, cancellation, refund, owner payout, dispute and compliance state machines. Reuse identity, messaging, notification, audit and platform operations only through explicit shared contracts.

## 9. Sign-in, role selection, switching and sign-out journey

1. User opens login/register; UI explains buyer vs. seller intent without silently granting a role.
2. Registration validates credentials, terms/privacy version, age/jurisdiction requirements where applicable and email verification.
3. Google/OAuth callback validates state, nonce, PKCE and issuer/audience; link accounts only under safe ownership proof.
4. Session is created server-side with secure cookie, rotation/expiry and device/session metadata.
5. Server loads effective roles and scopes. Buyer enters account/storefront; seller applicant sees application status; approved seller enters seller center; staff enters only authorized store; admin enters admin console only after MFA/privileged checks.
6. Store/market switch updates context, then server revalidates access and re-prices/revalidates affected resources; client selection is never authorization.
7. Sensitive actions require recent authentication, reason, and approval if configured.
8. Sign-out revokes server session, clears cookies, invalidates client cache and protected routes, removes local sensitive state, and redirects to a safe public page. Other sessions remain active unless user chooses revoke-all.
9. Session expiry/revocation returns to login with safe return path; never reveal whether another account exists.

## 10. Page and action contract — mandatory for every visible control

Every route and control must have a registry record containing:
- Stable route ID, path, audience, owning system/domain, layout shell and navigation entry.
- Access class and server policy (role, permission, resource ownership, store/market scope).
- Page source/component and API method/path.
- Input/output Zod schemas, error codes and validation messages.
- Domain service/use case and repository; no direct Prisma access in UI.
- Prisma models and migration or explicit no-schema-change rationale.
- Transaction boundary, idempotency key, concurrency/version check and audit event where applicable.
- Loading, disabled, validation, success, empty, forbidden, not-found, conflict, rate-limit, offline and server-error states.
- Focused tests for the meaningful business rule and critical end-to-end browser/API/database journey.
- Exact branch/commit, CI result, database migration evidence and manual/provider configuration limitations.

For money, inventory, order state, seller ownership, KYC, privacy, security and admin permissions, add negative tests for unauthorized, cross-tenant, duplicate, stale/concurrent and retry scenarios.

## 11. Global release gates

A market cannot be marked launch-ready until all applicable gates pass:
1. Legal entity, terms, privacy, consumer protection, returns and product compliance reviewed for jurisdiction.
2. Currency, FX source, tax/VAT, invoice and customs treatment approved.
3. Payment provider, settlement, refunds, disputes, SCA/3DS and reconciliation verified in sandbox and production readiness.
4. Shipping/carriers, delivery promises, tracking, returns routing and customs documents verified.
5. Seller KYB, payout destination, sanctions/risk process and customer support coverage ready.
6. Localization, addresses, phone formats, units, translated customer communications and timezone behavior tested.
7. Privacy/security, access control, incident response, backups, restore, monitoring and capacity reviewed.
8. Buyer, seller, support, finance and admin critical journeys passed on exact release commit.

## 12. Implementation sequencing and completion discipline

Build vertical slices, not a collection of disconnected screens:
1. Foundation, identity, session, RBAC, audit and shells.
2. Market/reference data, seller KYB/store, taxonomy/catalog/compliance, inventory and public discovery.
3. Search relevance, facets, indexing and category/store search.
4. Cart, checkout quote, payment orchestration, order/vendor-order and confirmation.
5. Seller fulfillment, carrier/tracking, delivery, returns, refunds and disputes.
6. Ledger, commissions, settlement, reconciliation, payouts and invoices.
7. Support, messaging, notifications, reviews, Q&A, privacy and lifecycle communications.
8. Promotions, CMS, SEO, analytics and integrations.
9. Global tax/customs, risk, observability, resilience, multi-region readiness.
10. Property domain as separately approved scope.
11. Per-market release certification and ongoing operations.

Status must be explicit: **Target → Present → Wired → Verified → Launch-ready**. These are distinct states. A route existing is Present; calling an API is Wired; a verified user journey with authorization and persistence is Verified; a market with all operational/legal/provider gates is Launch-ready.

## 13. Decisions that must be made before claiming "global"

The architecture can be global-ready, but launch cannot be assumed without explicit business decisions:
- Initial launch countries/markets and legal entity.
- Supported currencies and FX source/rate policy.
- Payment providers and settlement currencies.
- Shipping/carrier coverage and responsibility for customs/import duties.
- Tax registration/calculation/invoicing model.
- Product categories and restricted-goods policy.
- Seller onboarding/KYB standards and payout countries.
- Languages, support hours/channels and service-level commitments.
- Consumer cancellation/return policy per market.
- Data residency, privacy retention and subprocessors.
- Whether B2B, subscriptions, advertising/affiliate and property are in initial scope.

**Acceptance statement:** This document defines what the complete target platform should contain. It does not certify the current codebase, schema, integrations, market readiness or any system as complete. All route and journey claims must be reconciled against actual source and exact-commit evidence.
