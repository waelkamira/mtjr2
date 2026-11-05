# Phase 11 — Production operations, reliability and continuous scale

**Status:** New phase — specification only; no operational completion is claimed.  
**Prerequisites:** Phase 10 controlled launch passed for at least one owner-approved market.  
**Architecture:** Reuse the existing domain services and event/outbox contracts; do not create duplicate business domains or a second source of truth.

## Objective

Operate the launched marketplace safely over time: detect incidents before customers report them, recover from failures, protect money and inventory under retries/concurrency, measure service health, and expand capacity/markets only when evidence supports it.

Phase 11 is not permission to deploy, change production secrets, migrate a production database, or activate new markets. Those actions require explicit owner approval and the applicable operational change process.

## 11.1 Operational ownership and service objectives

- Define an accountable owner and escalation contact for each production-critical domain: identity, catalog/search, cart/checkout, orders, payments/ledger, inventory, notifications, support, integrations and data platform.
- Define service-level indicators (SLIs) and service-level objectives (SLOs) for availability, latency, error rate and freshness. Set numerical targets only after baseline traffic and business criticality are reviewed.
- Establish severity levels, incident commander, communication channel, customer-impact assessment and escalation policy.
- Publish a status communication procedure and post-incident review template.
- Keep operational runbooks versioned in the repository.

**Acceptance:** every critical service has an owner, dashboard/alert mapping, SLO definition, and a tested escalation route.

## 11.2 Observability and alerting

- Emit structured, redacted logs with request/correlation IDs; never log passwords, raw session/reset tokens, payment credentials, secrets, full identity documents or sensitive personal data.
- Track API availability, p50/p95/p99 latency, 4xx/5xx rates, database pool saturation, slow queries, queue age/depth, worker failures, webhook lag, notification delivery and payment reconciliation lag.
- Add alerts with actionable runbook links and deduplication; avoid alerting on every transient retry.
- Monitor business invariants: duplicate order attempts, reservation expiry, negative/over-reserved inventory, stuck payments, unmatched settlements, payout failures and outbox backlog.
- Establish retention, access control and sampling policies for telemetry.

**Acceptance:** induce a controlled non-production failure and demonstrate detection, useful trace/log correlation, alert delivery and documented recovery.

## 11.3 Background jobs, outbox and webhook operations

- Inventory every scheduled worker, queue consumer, webhook receiver and outbox publisher, including owner, cadence, retry policy, idempotency key, timeout and dead-letter/recovery path.
- Monitor pending age, attempt count, lock age, poison messages, duplicate delivery and dead-letter volume.
- Ensure workers are safe under at-least-once delivery; use bounded retries, jitter/backoff, lease expiry and explicit terminal states.
- Provide protected replay/reconciliation tools with authorization, audit events and dry-run where money or customer communication is affected.
- Verify that disabled/misconfigured external providers fail closed and surface actionable operational status.

**Acceptance:** duplicate event delivery creates no duplicate financial/customer side effect; a failed worker recovers after lease expiry; poison messages can be inspected and safely resolved.

## 11.4 Database reliability, backup and disaster recovery

- Define RPO/RTO with the owner and database provider; do not invent targets.
- Automate encrypted backups and monitor backup freshness and completion.
- Run scheduled restore rehearsals into an isolated environment; validate schema, row counts/invariants, application compatibility and documented recovery steps.
- Review connection pooling, indexes, slow queries, migration lock/rollback strategy and storage growth.
- Use forward-safe migrations; never edit an already-applied migration. Production migration requires an approved change window and backup evidence.
- Document data retention, deletion, legal hold and restore implications.

**Acceptance:** a clean restore rehearsal meets approved RPO/RTO and produces an evidence record without touching the owner's live database during development.

## 11.5 Capacity and performance management

- Establish representative load profiles from real or explicitly approved synthetic workloads; never generate production load without approval.
- Measure browse/search, product detail, cart, quote, order placement, login, seller/admin lists, notification worker and webhook paths separately.
- Set budgets for response latency, error rate, database connections, memory, CPU and queue backlog.
- Optimize based on measured bottlenecks: pagination, indexes, caching, query shape, image delivery and bounded concurrency.
- Test graceful degradation for search/provider/worker outages and protect checkout/payment invariants.
- Plan regional expansion only after data residency, latency, failover and consistency requirements are reviewed.

**Acceptance:** documented load test demonstrates agreed capacity and graceful degradation without duplicate orders, lost reservations or money/inventory invariant violations.

## 11.6 Security operations and privacy governance

- Maintain dependency/security update cadence, secret rotation procedure, least-privilege service credentials and access review.
- Monitor authentication abuse, account takeover indicators, privileged role changes, suspicious seller/order/payment behavior and webhook signature failures.
- Require MFA/re-authentication and immutable audit for privileged operations; dual approval for high-risk financial/security actions.
- Maintain vulnerability intake, incident response, breach notification assessment, data-subject request workflow and retention schedule.
- Verify that log/analytics/backup systems preserve privacy constraints and do not expose secrets or sensitive records.

**Acceptance:** tabletop exercises cover account compromise, privileged credential leak, suspected data breach and payment/webhook abuse; corrective actions are tracked.

## 11.7 Market expansion and change management

- Treat each market activation as a controlled release with approved legal entity, seller eligibility, product restrictions, tax, customs, payment, payout, logistics, language, currency and customer policy.
- Use feature flags/market availability controls with server-side enforcement; hiding a UI entry point is not a market restriction.
- Require migration plan, backup/restore evidence, rollback strategy, owner approval and post-change monitoring for high-risk changes.
- Maintain an inventory of external providers, subprocessors, contracts, credential owners, data flows and outage fallback behavior.

**Acceptance:** a new market is activated only after a signed-off checklist and a reversible rollout; unsupported combinations are rejected server-side.

## 11.8 Cost, capacity and operational reporting

- Track infrastructure, database, storage, email, search, observability, payment and carrier costs against traffic and business volume.
- Define budget alerts and cost anomaly ownership; never optimize cost by weakening financial/security controls.
- Provide operational reports for order lifecycle, payment reconciliation, payout aging, inventory integrity, support SLA, notification delivery, worker health and incident trends.
- Separate operational metrics from product analytics and apply retention/access controls.

**Acceptance:** reports reconcile to canonical source records and every alert/report has an owner and action path.

## 11.9 Minimal verification set

Do not create an endless test matrix. For each meaningful operational change, run only the relevant focused checks plus the normal CI gate:

1. Prisma validate/generate and migration replay on disposable PostgreSQL when schema changes.
2. Typecheck, lint, focused unit tests, and production build.
3. One integration test for the changed worker/webhook/transaction invariant.
4. One controlled failure/retry/recovery rehearsal for the affected operational path.
5. One dashboard/alert/runbook evidence check.

## 11.10 Required operational artifacts

Create or maintain these files as each capability is implemented:

- `docs/operations/SERVICE_OWNERSHIP_AND_SLOS.md`
- `docs/operations/INCIDENT_RESPONSE.md`
- `docs/operations/BACKUP_AND_RESTORE.md`
- `docs/operations/WORKER_AND_OUTBOX_RUNBOOK.md`
- `docs/operations/SECURITY_OPERATIONS.md`
- `docs/operations/MARKET_ACTIVATION_CHECKLIST.md`
- `docs/operations/LOAD_AND_CAPACITY_BASELINE.md`

Do not create empty placeholders merely to make the checklist appear complete. Add each artifact with a real owner, procedure and evidence.

## Exit criteria

Phase 11 can be marked **Operationally verified** only when:

- Phase 10 controlled launch evidence exists for the named market and release.
- Every critical domain has an accountable owner and approved SLO/alert policy.
- Incident, backup/restore, worker/outbox, security and market-activation runbooks are actionable and rehearsed.
- Restore, retry/replay, failover/degradation and rollback drills pass in isolated/staging environments.
- Capacity and cost baselines are measured and reviewed.
- No unresolved P0/P1 reliability, privacy, security, money or inventory invariant is open.
- The owner accepts the operational handover.

Until then, Phase 11 remains **Target / specification only**.
