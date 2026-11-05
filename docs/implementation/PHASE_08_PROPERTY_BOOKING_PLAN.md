# Phase 8 — Separate property and booking domain execution plan

**System:** 49.  
**Status:** Separate-domain specification; do not infer completion from shared marketplace infrastructure.

## Objective
Deliver property listing and booking workflows without coupling property state, money rules or lifecycle to product commerce.

## Domain boundary
- Own property listings, property attributes/media, availability, inquiries, viewing appointments, booking requests, booking lifecycle and property-specific policies in a distinct domain/service namespace.
- Reuse only proven shared capabilities through explicit contracts: identity/session, permissions, media storage, notifications, audit, payment adapter and localization.
- Do not reuse Product, Cart, VendorOrder, inventory reservation or product-review semantics as property equivalents.
- Define a distinct owner/agent/property permission model; never assume a seller STORE grant authorizes a property resource.

## Work packages
1. Property owner/agent onboarding and verification requirements.
2. Listing create/edit/submit/moderate/publish/archive lifecycle.
3. Search/filter/map/location and localized property detail.
4. Inquiry and viewing appointment lifecycle with participant privacy.
5. Availability and booking request/accept/decline/expire/cancel state machine.
6. Deposit/rent/payment/refund integration through the shared financial adapter but separate property ledger references and business policies.
7. Documents, evidence, audit, dispute and retention rules.
8. Admin moderation and operational reporting.

## P0 acceptance
- Property resource access is owner/agent scoped; cross-owner access is denied.
- Concurrent booking requests cannot reserve the same unavailable slot.
- Expired/cancelled requests cannot be accepted or charged.
- Duplicate provider events cannot duplicate deposits/refunds.
- Product commerce APIs and property APIs cannot mutate each other's domain state.

## Exit criteria
Property-specific Prisma ownership, APIs, route registry, UI states, policy documents and focused PostgreSQL integration pass. Legal rules, deposits, payment provider and market availability require explicit approval. Keep this phase independently releasable.
