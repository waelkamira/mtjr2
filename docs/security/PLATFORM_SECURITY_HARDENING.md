# Platform security hardening baseline

## Security objective

Protect customer, seller, staff and platform data; prevent unauthorized reads and writes; limit the blast radius of compromised accounts, endpoints and integrations; and preserve evidence for incident response.

Absolute prevention cannot be guaranteed. The target is defense in depth, least privilege, deny-by-default access, safe failure and rapid containment.

## Implemented baseline in this change

- Global browser security headers in `next.config.ts`: HSTS, frame denial, MIME sniffing protection, strict referrer policy, restrictive browser feature permissions, and CSP directives denying framing, plugins and untrusted base URLs.
- Next.js powered-by disclosure remains disabled.
- The app already has server-side, HttpOnly cookie-backed sessions; session resolution from PostgreSQL; permission checks; scoped authorization primitives; MFA support and step-up timestamps; persistent login/registration/reset/verification throttles; same-origin mutation guards; and audit-log models. These are foundations, not proof that every route is correctly protected.
- Existing API inventory scripts classify mutation request boundaries and authorization boundaries. Their output is static evidence only and must not be interpreted as proof of tenant isolation or exploit resistance.

## Security fixes applied during route review

- Seller product-media upload now rejects invalid or oversized declared `Content-Length` values before parsing multipart form data. The hosting ingress must still enforce a hard request-body limit for chunked requests where `Content-Length` is absent.
- Shared JSON and multipart mutation guards now reject malformed or oversized declared `Content-Length` values (1 MiB for JSON mutations; 10 MiB plus multipart overhead for uploads) before handlers parse request bodies. These header checks do not cap chunked bodies; ingress/runtime body limits remain mandatory.
- Temporary seller image deletion now uses its own persistent per-user action budget and rejects oversized JSON requests before parsing.
- Payment webhooks now read the request stream with a strict 1 MiB maximum, reject oversized declared lengths, and pass the bounded raw bytes to the provider signature verifier. This prevents unbounded webhook-body buffering and avoids reading the same body twice.
- These are targeted application-layer controls; they do not replace ingress limits, malware scanning, or full route-by-route authorization review.

## Mandatory security layers and completion gates

### 1. Edge and transport
- Enforce HTTPS at the public ingress; redirect HTTP to HTTPS and enable HSTS only on a verified HTTPS domain.
- Put a managed WAF/CDN in front of the origin; enable DDoS protection, bot controls and rate limits for login, registration, search, checkout, uploads and AI endpoints.
- Restrict direct origin access so attackers cannot bypass edge controls.
- Keep the trusted-proxy IP header unset unless the origin is reachable only through that trusted proxy. Never trust arbitrary `X-Forwarded-For` values.

### 2. Identity and sessions
- Use high-entropy secrets from a secret manager; rotate credentials and invalidate sessions after compromise.
- Keep session tokens HttpOnly, Secure in production, SameSite and server-revocable; rotate after login, privilege changes and MFA step-up.
- Require MFA for all privileged staff/admin accounts; require fresh step-up verification for payout, payment, credential, role and security-setting changes.
- Add credential-stuffing detection, breached-password screening, recovery abuse controls and alerting.
- Ensure account suspension and role revocation take effect on existing sessions immediately.

### 3. Authorization and tenant isolation
- Deny by default. Resolve actor identity only from a verified server session.
- Re-check permissions and resource ownership in every service/API operation; never trust client-supplied userId, sellerId, storeId, role, price, amount or status.
- Verify store membership and resource scope for every seller/staff operation; test cross-store IDOR/BOLA attempts.
- Protect super-admin actions with least privilege, explicit approvals/step-up and immutable audit evidence.
- Keep authorization decisions server-side; UI hiding is never a security boundary.

### 4. API, browser and application
- Require origin/CSRF checks on every cookie-authenticated state-changing route, including multipart and non-JSON requests; allow only documented public exceptions.
- Validate strict schemas, reject unknown fields on mutations, bound request body sizes and pagination, and return generic non-sensitive errors.
- Apply distributed rate limits at the edge and application layer. Database-backed counters are not a substitute for edge controls against volumetric traffic.
- Deploy a nonce-based strict CSP after inventorying Next.js inline scripts, analytics, payment redirects, OAuth and media providers. Current CSP intentionally adds only directives that can be applied without breaking existing script execution.
- Prevent XSS with contextual output encoding and safe rich-text handling; prevent SSRF with outbound host allowlists and private/link-local IP blocking.

### 5. Database and sensitive data
- Keep PostgreSQL private; use TLS, least-privilege database roles, encrypted backups and tested point-in-time recovery.
- Never expose Prisma or database credentials to the browser. Avoid raw SQL unless parameterized.
- Encrypt MFA secrets and sensitive identity documents at rest; minimize stored personal data and apply retention/deletion policies.
- Use transactions, idempotency and immutable accounting records for orders, inventory, payments, refunds and settlement.
- Separate production, staging and development credentials and databases.

### 6. Uploads and integrations
- Enforce upload byte limits before parsing, MIME and magic-byte checks, image decoding/re-encoding, randomized object keys, and quarantine/scanning before publication.
- Keep provider credentials server-only; use least-privilege keys, signed deletion tokens, ownership checks and provider webhook signature verification.
- Restrict remote media URLs to approved hosts; block internal metadata/private network destinations.
- Treat AI prompts, uploaded files and external provider responses as untrusted input; never allow the AI assistant to execute privileged actions without explicit server authorization.

### 7. Monitoring, recovery and response
- Log authentication failures, MFA changes, privilege grants, exports, payment/refund actions, upload abuse, webhook failures and suspicious cross-tenant access.
- Never log passwords, session tokens, reset tokens, MFA secrets, full payment credentials or identity-document contents.
- Alert on spikes, repeated authorization failures, unusual exports, privilege changes and abnormal financial activity.
- Maintain incident playbooks for session revocation, secret rotation, account suspension, provider key revocation, database restore and customer notification.

### 8. Supply chain and engineering
- Pin dependencies with a lockfile; use automated dependency updates and vulnerability review.
- Enable GitHub secret scanning and push protection, dependency review, CodeQL/SAST and protected branch reviews in repository settings.
- Review all new API routes against both route inventories; every public route must have a documented reason and narrow data contract.
- Add security-focused tests for IDOR/BOLA, CSRF, privilege escalation, mass assignment, replay, race conditions, upload abuse, webhook forgery and financial idempotency.

## Known gaps requiring dedicated implementation or operator configuration

- Edge WAF, DDoS/bot mitigation and origin lockdown are infrastructure controls and are not activated by application code alone. Configure them at the chosen hosting/DNS provider; Vercel is not assumed.
- A nonce-based full CSP requires a separate compatibility pass across Next.js rendering and third-party scripts.
- Static API audit scripts do not prove authorization correctness. Manually resolve every REVIEW_REQUIRED route and exercise cross-user/cross-store access.
- Confirm production HTTPS, HSTS domain scope, trusted proxy configuration, database network restrictions, backup encryption/PITR and secret rotation.
- Confirm upload size enforcement happens before request body buffering for each hosting runtime and that every provider has deletion/scanning credentials.
- Add external security review/penetration test before production launch.

## Verification boundary

This commit adds the browser security-header baseline and documents the complete hardening gates. No tests, builds, dependency audits, penetration tests, provider configuration changes, or production infrastructure changes were run or claimed.
