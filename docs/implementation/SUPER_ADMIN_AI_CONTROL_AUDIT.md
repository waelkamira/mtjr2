# Super Admin and AI operations — source audit

**Audit date:** 2026-11-06  
**Audited ref:** `main` at `aa2de981619de9f7c8bf10e7941f80cde5f998d2`  
**Purpose:** establish the existing identity, authorization, administration, audit, and AI boundaries before adding a Super Admin command center or AI controls. This is a source audit, not a claim of deployed/runtime verification.

## 1. Current repository state

- CI run [42240390315](https://github.com/waelkamira/mtjr2/actions/runs/42240390315) completed with **success** on the audited merge commit. Prisma validate/generate, typecheck, lint, tests, and production build all passed.
- The reviewed AI assistant is merged. Its runtime remains disabled by default and requires a server-only `GROQ_API_KEY`; no live provider smoke test or production enablement is claimed.
- No `src/app/admin/page.tsx`, `src/app/admin/layout.tsx`, `/admin/dashboard`, or `/admin/control-panel` exists on this audited tree. Existing admin pages are domain-specific routes (support, returns, product/review moderation, tax rates, etc.).
- The route registry is explicitly an initial required-page inventory, not a verified complete route audit. System 24 explicitly records the command-center routes as missing and warns against inventing a route before registry review.

## 2. Identity and authorization — existing source of truth

Reuse these existing components; do not introduce a parallel RBAC system:

- `prisma/schema.prisma`: `Role`, `Permission`, `RolePermission`, `UserRoleAssignment`, `UserSession`, and `AuditLog`.
- `src/server/identity/current-session.ts`: resolves the HttpOnly cookie against the session store; `requireCurrentSession` fails closed.
- `src/server/identity/permission-repository.ts`: loads active, unexpired grants from PostgreSQL.
- `src/server/identity/authorization.ts`: pure global/exact-scope permission evaluation; expired grants and missing scope fail closed.
- `src/server/identity/permission-guard.ts`: `requirePermission` composes verified session + server-loaded grants.
- `src/server/identity/role-assignment.ts`: role changes are transactional and audited; prevents delegating permissions the actor does not hold and rejects ordinary assignment of `SUPER_ADMIN`.

### Super Admin boundary

- `prisma/seed.cjs` defines `SUPER_ADMIN` as a system role and maps it to the full seeded permission set.
- `ADMIN` has operational permissions such as `users:manage`, `roles:assign`, and `audit:read`, but does **not** receive `platform:manage`.
- `SUPER_ADMIN` is not assigned to any user by seed. The seed explicitly creates role/permission definitions only.
- `platform:manage` is the existing platform-wide permission and is assigned to the Super Admin role through the seeded permission map. It is already used by the seller approval service.
- Normal role assignment rejects `SUPER_ADMIN`; therefore the repository currently has no documented, audited owner bootstrap/recovery procedure for granting the first Super Admin. This is a P0 operational gap. Do not bypass it with a normal user-facing role assignment endpoint.

**Decision:** command-center pages and APIs must use `requirePermission({ permissionKey: "platform:manage" })`, not a client role label and not the broader `users:manage`. Domain-admin pages continue using their domain permissions.

## 3. Existing admin route/API pattern

- Existing UI routes are thin App Router wrappers over `src/features/admin/*`.
- Admin APIs call domain services. The services enforce server-side permissions; e.g. support queue operations use `support:manage`, product moderation uses `users:manage`, and seller approval uses `platform:manage`.
- Identity mutation endpoints also apply `validateIdentityMutationRequest` before parsing or executing writes.
- The public navigation is not an admin navigation. No shared admin shell/sidebar or Super Admin landing route exists.
- Some existing admin pages render a client component before the first protected API response. The data/API remains protected, but a central command center should additionally protect its server-rendered page and every API boundary to avoid leaking admin-only shell/data.

## 4. Audit and persistence

- `AuditLog` already supports actor, action, resource, resource ID, scope, metadata, IP, user agent, and occurrence time. Reuse it for privileged control changes and audited access to sensitive conversation content.
- There is no generic `SystemSetting` or `PlatformSetting` model in the current schema.
- No durable AI conversation, AI usage/metrics, AI feedback, or AI control-setting model is present in the inspected schema/source.
- Do not claim AI analytics, conversation history, feedback, or persisted admin configuration exists. Do not store the Groq secret in Prisma or return it to the UI.

## 5. AI assistant current operational boundary

- `AI_ASSISTANT_ENABLED` defaults to false; `GROQ_MODEL` defaults to `openai/gpt-oss-20b`.
- `GROQ_API_KEY` is server-only. The UI may report only whether a key is configured (boolean), never its value, prefix, length, or a reversible representation.
- The current rate limiter is in-process best-effort, not distributed. Without a verified trusted proxy header, the shared fallback bucket is restrictive and unsuitable for normal multi-user production traffic.
- The current implementation does not persist chat history, provide admin controls, approved knowledge sources, feedback/analytics, or distributed rate limiting.

## 6. Implementation sequence

1. **P0 — Super Admin bootstrap/recovery:** document and implement a one-time, auditable, operator-controlled bootstrap path that cannot be invoked by an ordinary web user, cannot be used to delegate Super Admin, and does not put credentials or secrets in source. Add tests and an operational runbook before relying on the command center.
2. **P0 — Command center shell:** create the canonical `/admin/control-panel` (or the final route selected in the route registry) with a server-side `platform:manage` gate, shared admin navigation, and a no-store API boundary. Do not duplicate domain workflows.
3. **P1 — AI operations page:** add a Super Admin-only page/API. Initially expose safe operational status (feature enabled, provider key configured boolean, configured model, limits, readiness warnings). Preserve the environment master switch as a hard kill switch.
4. **P1 — Runtime controls and observability:** only after selecting persistence semantics, add the smallest additive DB-backed AI runtime config (enabled flag and bounded settings), audit every change, and ensure env-disabled always overrides DB-enabled. Add aggregate usage/error events with retention and privacy constraints.
5. **P1 — Shared rate limiting:** use a shared store and verified edge identity; never trust arbitrary forwarding headers.
6. **P2 — Conversation access, approved knowledge, and feedback:** separate permissions, audit every sensitive read, redact/minimize data, and implement retention/deletion before exposing customer conversations to admins.
7. **Verification:** unit + PostgreSQL integration + browser E2E for non-Super-Admin denial, ADMIN denial, SUPER_ADMIN access, no secret disclosure, env kill switch, DB config audit, and cross-user conversation isolation. Update route registry, model usage map, system specs, and build log.

## 7. Explicit non-actions

- No Vercel deployment, environment access, or configuration change.
- No Groq key retrieval, display, commit, or secret write.
- No database migration or production data change in this audit.
- No claim that the assistant is live or that a Super Admin dashboard already exists.

**Audit conclusion:** the identity primitives are present and the CI baseline is green, but a Super Admin command center and AI operations controls are not yet implemented. The first implementation blocker is a safe first-Super-Admin bootstrap/recovery process; the existing role-assignment endpoint intentionally cannot grant that role.
