# Phase 7 — Trust, engagement and communications execution plan

**Systems:** 06–11, 21, 33, 37–39, 45, 48.  
**Status:** Several vertical slices exist; complete cross-role and provider journeys remain open.

## Objective
Build trusted customer/seller relationships and reliable communication without leaking private data, fabricating engagement or bypassing moderation and refund controls.

## Work packages
1. Reviews/reputation: verified-purchase eligibility, one-review policy, moderation, seller response, report/appeal and public visibility rules.
2. Product Q&A: customer question, seller/staff answer with exact store scope, edit history, report, moderation and notification.
3. Messaging/support: participant-only conversations, customer tickets, staff assignment, public replies versus internal notes, attachments and retention.
4. Returns: eligibility from delivered vendor-order items, per-vendor requests, evidence, seller/admin review and customer status. Refund money movement is delegated to Phase 6.
5. Notifications: in-app preference, email consent, outbox, deduplication, retries, delivery state and user-scoped history.
6. Loyalty/promotions: eligibility, budget/limits, stacking, expiry, abuse protection and immutable applied discount snapshots; do not duplicate checkout price calculation.
7. CMS/support content: versioned content, publishing permissions, localization and legal review.
8. Lifecycle email/newsletter: opt-in, consent proof, unsubscribe/suppression, bounce/complaint handling and provider delivery evidence.
9. Event processing: typed event contracts, outbox ownership, retry/replay and dead-letter review.

## P0 acceptance
- Cross-customer and cross-store access is denied on every conversation/ticket/review action.
- Internal notes and private moderation evidence never appear in public/customer DTOs.
- Duplicate events do not send duplicate side effects; withdrawal of email consent prevents pending delivery.
- Return approval never implies refund completion; refund outcome is read from Phase 6.
- Reviews require eligible purchases and only published/moderated content appears publicly.
- Provider absence fails closed with clear user/admin status.

## Exit criteria
Each workflow has a real route/API/service/persistence trace and focused PostgreSQL tests. Provider delivery, attachment malware scanning and SLA workers are marked Conditional until externally configured and smoke-tested. No fake messages, reviews, tracking or refund outcomes.
