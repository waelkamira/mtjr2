# Identity and Access Route Matrix

**Canonical source:** `src/server/identity/current-session.ts`, `permission-guard.ts`, `permission-repository.ts`, and `authorization.ts`.  
**Super Admin source:** `requirePlatformManagement()` plus the dedicated `super-admin-page-guard.ts`.  
**Status:** source audit on `rebuild/identity-iam`; browser/provider/deployment verification remains open.

## Security invariants

1. The only authorization subject is the user resolved from the verified, HttpOnly session cookie. Never accept a user ID, role, permission, store owner, or grant from the browser as proof.
2. Authentication is not authorization. Each protected server service checks the relevant permission and, for seller/staff operations, the exact resource/store scope.
3. Page-level visibility is a usability feature. Every API and server-side service independently enforces its permission, account state, ownership, and scope.
4. All state-changing JSON routes must call `validateIdentityMutationRequest(request)` before reading the body or invoking a service. The guard requires the configured exact Origin, rejects cross-site Fetch Metadata, and requires JSON.
5. Super Admin is a protected platform capability, not a role name that can be delegated. Ordinary role assignment and revocation reject both `SUPER_ADMIN` and any custom role containing `platform:manage`.
6. Platform-wide operations require an active cookie-backed session, `platform:manage`, verified email, enabled TOTP MFA, and a successful step-up whose verification timestamp and expiry form a valid ten-minute window.
7. Privilege grants use a separate request/approval workflow. Requester and target cannot approve; approval is audited and serialized against concurrent requests.
8. UI components never receive MFA encryption keys, session token digests, recovery-code hashes, or authorization grants.

## Route groups and access requirements

| Route group | Intended audience | Enforcement point | Rule |
|---|---|---|---|
| Public storefront: `/`, `/products/**`, `/categories/**`, `/brands/**`, `/stores/**`, search | Everyone | Public domain services | Only public/active/approved marketplace data is returned. No login required. |
| Authentication: `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password` | Guests | Auth route handlers and identity services | Validate input, Origin/JSON, rate limits, token digests, account state and safe return paths. Public registration remains environment-gated. |
| OAuth: Google start/callback | Guests / linked users | OAuth state/PKCE callback service | Verify state, PKCE, issuer, audience, verified email and intent. No silent email-based account linking. Provider credentials and callback registration remain operational requirements. |
| Customer account: `/account/**`, `/notifications` | Authenticated customer | `src/app/account/layout.tsx` plus each owning API/service | Layout requires a valid session. APIs still enforce ownership and return only the current user's data. |
| Account security: `/account/security`, `/account/sessions` | Authenticated account owner | Current-session resolver; session/MFA APIs | Own sessions only; same-origin revocation; account-wide logout; password reauthentication for MFA enrollment/disable; MFA proof for recovery-code rotation and disable. |
| Seller workspace: `/seller/**` | Authenticated seller/applicant/staff | Seller domain services and scoped permission repository | Verify seller status and exact store membership/permission for every operation. A client-side seller route is not an authorization boundary. |
| Admin moderation/operations: `/admin/**` and `/api/admin/**` | Authorized staff/admin | Owning server services | Enforce operation-specific permissions (e.g. user management, returns management, support management) and resource scope. Never infer access from a display role or route name. |
| Super Admin: `/admin/control-panel/**` | Platform administrators only | Server page guard and each platform service/API | Require platform permission + verified email + enrolled MFA + recent step-up. Unauthorized page access is hidden; APIs return explicit 401/403/428 errors. |

## Super Admin protected surfaces

| Surface | Page/API | Required server rule |
|---|---|---|
| Control center | `/admin/control-panel` | `requireSuperAdminPage()` → `requirePlatformManagement()` |
| Access catalogue | `/admin/control-panel/access-catalog`, `GET /api/admin/control-panel/access-catalog` | Same gate; read-only role/permission catalogue; no role editing through this surface |
| Privilege requests | `/admin/control-panel/privilege-requests`, `GET/POST /api/admin/control-panel/privilege-requests` | Same gate; validated JSON mutation; target must be active and email-verified; no duplicate pending request |
| Privilege decision | `PATCH /api/admin/control-panel/privilege-requests/[requestId]` | Same gate; validated JSON mutation; requester/target cannot review; transaction locks target; decision and grant audited |
| Platform audit log | `/admin/control-panel/audit-log`, `GET /api/admin/control-panel/audit-log` | Same gate; bounded filters/pagination; metadata sanitization; private no-store response |
| First-admin bootstrap | `scripts/bootstrap-super-admin.cjs` | Explicit opt-in and confirmation, exact expected PostgreSQL host/database, active verified existing account, no existing active platform grant, serializable transaction, audit event. Never exposed as a public API. |

## Account security and session controls

- Session tokens are high-entropy opaque values; only SHA-256 token digests are persisted.
- Session resolution rechecks expiry, revocation and active account state; password changes revoke other sessions.
- `GET /api/account/sessions` lists only the authenticated user's active sessions; `DELETE /api/account/sessions` revokes only a session owned by that user.
- `POST /api/auth/logout` revokes the current session; `POST /api/auth/logout-all` revokes all sessions for the cookie-authenticated user and clears the cookie.
- MFA secrets are AES-256-GCM encrypted at rest with a 32-byte `MFA_ENCRYPTION_KEY`; only encrypted ciphertext/IV/tag are stored.
- TOTP uses a 30-second step and rejects replay using the persisted last-used step. Recovery codes are random, stored as hashes, single-use, and displayed once.
- MFA enrollment and verification endpoints have a separate persistent HMAC-keyed attempt budget. Enrollment and disable require the current password. Platform-wide privilege holders cannot disable MFA.
- Step-up is session-bound and expires after ten minutes. Platform authorization checks both the verification timestamp and expiry, not only a client flag.

## Admin API mutation audit

The source audit covered all 23 `src/app/api/admin/**/route.ts` handlers present on this branch. State-changing endpoints were checked for same-origin/Fetch Metadata/JSON validation before body parsing. One missing guard was found in `PATCH /api/admin/returns/[returnId]` and added on this branch. The remaining mutation routes already use the shared request-security guard. The service layer remains the actual permission boundary.

## Component protection rules

- Navigation links, disabled buttons, hidden panels, client context, and role badges are never sufficient protection.
- Client components may call protected APIs but must treat 401/403/428 responses as authoritative and show recovery/reauthentication guidance.
- Server components may call guarded server services directly; do not pass raw session tokens or secret material into client props.
- Shared product/store components stay public unless they contain account-specific actions. For account-specific actions, the API/service enforces the owner and permission.
- Admin and Super Admin components may render their shell, but no protected data or mutation is returned without the corresponding server gate.

## Verified source fixes on this branch

- Protected arbitrary roles containing `platform:manage` from ordinary assignment and revocation.
- Added independent two-person platform privilege approvals and a guarded first-admin bootstrap.
- Added Super Admin page/API gates requiring verified email, enrolled MFA and a strict ten-minute step-up window.
- Added encrypted TOTP enrollment, one-time recovery codes, replay prevention, attempt throttling, reauthentication and audited lifecycle events.
- Added account-wide logout and its UI action.
- Corrected login failures so unknown emails, wrong passwords, and inactive/unverified accounts receive the same generic response.
- Added the missing same-origin guard to the admin return-decision PATCH route.

## Remaining release gates — do not mark Phase 2 complete yet

- Exact-head General CI and PostgreSQL integration must both pass after the final source/documentation commit. Older passing runs do not prove the latest head.
- Run the complete browser/HTTP journey against a controlled environment: register → deliver/verify email → login → authenticated `/api/auth/me` → MFA enrollment/step-up → Super Admin denial/allow matrix → logout/logout-all → anonymous denial.
- Configure and smoke-test Resend with a verified sender.
- Configure the actual trusted proxy header, prove the edge overwrites it, and block direct-origin bypass. Keep IP-dependent routes fail-closed until then.
- Exercise Google OAuth with real test credentials and registered callback URL.
- Review production cookie/origin behavior and bootstrap only against the explicitly confirmed intended database.
- The session inventory currently uses user-agent and timestamps; it is not a hardware-backed device identity or anomaly-detection system.
- Passkeys, phone verification, hardware security keys, and automated suspicious-session detection are not implemented; do not represent them as available.

No Vercel deployment, production database operation, or production secret change was performed as part of this branch work.
