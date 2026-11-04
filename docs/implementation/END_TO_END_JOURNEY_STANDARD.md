# End-to-End Journey Delivery and Verification Standard

**Applies to:** all 49 platform systems, every page/route, button, link, form, menu action, API, background action, and persisted business workflow.  
**Canonical plan:** `docs/architecture/COMPLETE_PLATFORM_SYSTEMS_BLUEPRINT.md`  
**All-49 action matrix:** `docs/implementation/END_TO_END_JOURNEY_MATRIX.md`  
**Route inventory:** `docs/implementation/PAGE_ROUTE_REGISTRY.md`  
**Page target inventory:** `docs/architecture/PLATFORM_PAGE_INVENTORY.md`

## Non-negotiable rule

Build and review features as user journeys, not isolated components. This is a hard release gate for every one of the 49 systems, not an optional testing suggestion. Do not proceed to broaden a system while its currently exposed critical actions have known dead ends or unverified business writes; first fix, safely disable, or explicitly scope out those actions. Every visible action must lead to a defined, permission-checked outcome or be explicitly disabled/labelled as unavailable. Do not ship inert buttons, fake success messages, client-only business writes, fabricated metrics, or UI controls whose backend is not implemented.

A route, component, API handler, Prisma model, migration, or passing unit test alone does not prove the journey works.

## Required trace for every action

For each button/link/form/menu item/API-triggered action, create a separate action trace in `END_TO_END_JOURNEY_MATRIX.md` (or a linked system-specific trace) and record the following. Route-level status in the registry does not substitute for action-level evidence:

1. **Entry point:** exact route, component, action label, audience and required state.
2. **Preconditions:** authentication, verified email, role, exact resource scope, current business status, market/policy/provider requirements.
3. **User interaction:** input fields, validation messages, disabled/loading state, double-submit behavior, navigation/confirmation behavior.
4. **Frontend wiring:** the actual click/submit handler, request method/URL, payload shape, response handling, and loading/success/empty/error/forbidden states.
5. **API boundary:** route handler, input schema, session resolution, CSRF/origin protections where relevant, rate limit/abuse control, safe error contract.
6. **Domain rules:** service/use case that enforces business rules independently of UI; no business logic hidden only in React.
7. **Authorization:** ownership resolved server-side; delegated access must match the exact resource scope; reject cross-user, cross-store, cross-tenant, and privilege-escalation attempts.
8. **Persistence:** repository and canonical Prisma entities/relations, uniqueness and database constraints, transaction boundary, concurrency behavior, idempotency for retryable writes, and audit/event/notification requirements.
9. **Schema decision:** inspect `prisma/schema.prisma` and the model-usage map first. Reuse existing models if they represent the domain. Add/update a model only for a demonstrated persistence gap; include an additive migration and backfill/compatibility plan when needed. Never create a table solely because a page exists.
10. **Outcome:** exact persisted state transition, returned data, destination URL, and what the user sees after refresh/retry.
11. **Verification:** focused tests for the critical business/security invariant; Prisma validate/generate and type/build/lint gates as applicable; disposable PostgreSQL migration/integration for schema or transactional changes; browser/HTTP journey check when environment is configured.
12. **Evidence:** implementation commit/PR, route/API/model/migration references, test or CI run URL and result, unresolved gaps, and registry/build-log updates.

## Required journey state coverage

For every form and mutating action, explicitly consider:

- unauthenticated and expired-session states;
- unauthorized role, wrong owner/scope, and inactive/suspended account/store;
- valid submission and persisted success;
- missing/malformed/out-of-range input;
- duplicate submission, network retry, and idempotent replay;
- conflicting concurrent updates or stale state;
- missing/empty data and unavailable market/provider/policy;
- validation, server, network and not-found errors;
- loading/disabled state and prevention of accidental double action;
- reload/back/forward behavior and consistency with persisted server state.

Only states relevant to that action need executable tests; the checklist is a design/review prompt, not permission to create hundreds of redundant tests. Use the existing focused test suites and CI workflows. Add tests for distinct invariants, security boundaries, data integrity, or regressions—not every helper branch.

## Example vertical journey: apply to become a seller

Follow the actual implementation and record evidence for each step; do not mark a step complete merely because the target is documented.

1. **Discovery:** a public seller CTA navigates to the real seller information/application entry route. If onboarding is unavailable, the CTA is not presented as functional.
2. **Identity gate:** a guest is sent to sign-in/registration with a safe return path; return URLs are validated against open redirects. A signed-in but unverified user sees the verification/resend path rather than a fake submission.
3. **Application form:** the page explains requirements and collects only fields supported by the approved seller policy and current schema. Client and server validation agree; sensitive documents are not placed in ordinary text fields.
4. **Submit:** the form disables while pending and sends the defined payload to the seller application API. The server derives the applicant identity from the session, checks email verification and account state, validates payload and rate limits, and rejects forged applicant IDs.
5. **Domain/persistence:** the seller application service checks existing applications and current seller status; retry behavior is idempotent. A transaction persists the application/status and audit event using existing canonical Seller/application records. A new Prisma model is added only if the reviewed schema cannot represent the required application lifecycle.
6. **Response:** the UI distinguishes success, already-pending, already-approved, rejected/resubmission-allowed, validation failure, unauthorized, and retryable server failure. No success screen is shown before the server confirms persistence.
7. **Review:** the authorized admin queue reads the same persisted application, enforces seller-review permission, and approve/reject actions require valid state transitions; rejection requires a reason if policy requires it. Writes are audited and safe against duplicate/stale decisions.
8. **After approval:** the applicant sees the persisted status and the allowed next action. Store creation is server-authorized and begins in the correct draft state; inspect whether retries can create duplicate stores and add idempotency or a database-enforced business uniqueness rule where the workflow requires it. Market links and staff grants use exact store scope.
9. **Journey verification:** test guest redirect, verified and unverified user, valid application, duplicate/retry, wrong user/scope, admin approve/reject, stale transition, and approved seller store creation. Verify schema migration replay in disposable PostgreSQL if persistence changed, then record the actual CI/HTTP evidence.
10. **Registry:** list all touched pages, buttons, APIs, services, Prisma models/migrations and states; mark each route/action Verified only after evidence exists. Record known exclusions such as KYC document upload or payout activation separately instead of implying they are included.

## No-incomplete-controls release rule

Before a route/system slice is called ready, inspect every visible interactive control on every touched page, including header/footer navigation, cards, icon-only buttons, filters, pagination, dialogs, empty-state CTAs, seller/admin tables, bulk actions and mobile layouts. For each control, prove the destination or handler exists and the final action works. Remove or disable unsupported controls and label deferred capabilities honestly. If a workflow depends on a later system/provider/policy decision, stop before the irreversible action and show the real prerequisite; never simulate success.

A route may remain in the codebase as a partial/internal implementation, but it must not be presented to users as a finished capability. Every known incomplete action must be listed with an owner and a blocking/defer decision. This is a release-readiness gate, not a demand for hundreds of shallow tests: test distinct business, security, concurrency and data-integrity invariants.

## Completion levels

- **Wired:** the UI action calls the intended endpoint, but backend behavior or evidence may be incomplete.
- **Implemented:** API, validation, authorization, domain rules and persistence are present; verification is still pending.
- **Verified:** the critical journey has evidence for successful and relevant failure/security states, and required CI/database checks passed for the exact commit.
- **Complete:** all required journey steps for the system's agreed scope are verified; unresolved provider, policy, security or operational dependencies are explicitly separated and do not contradict the claimed scope.

Never infer verification from an earlier commit, a different branch, a cancelled run, or a route's mere presence.

## Schema and migration decision gate

Before each Prisma change, write down: (a) the missing business fact/state/relation, (b) existing models considered and why they are insufficient, (c) fields/relations/constraints/indexes needed, (d) read/write services and ownership, (e) migration/backfill/rollback implications, and (f) verification evidence. Prefer additive, forward-safe migrations. Do not apply migrations to the owner's database or production without explicit authorization.

## Delivery record

Update these artifacts in the same implementation slice:
- `PAGE_ROUTE_REGISTRY.md`: actual route/action status, owning systems, endpoint/service, Prisma mapping and evidence/gap.
- `BUILD_LOG.md`: commit, files, schema/migration decision, focused checks and exact result.
- `COMPLETE_PLATFORM_SYSTEMS_BLUEPRINT.md`: system scope/dependencies/acceptance criteria when plan-level gaps or errors are found.
- `docs/PROJECT_AUDIT.md` or the relevant phase plan: cross-cutting risks and remaining work.
