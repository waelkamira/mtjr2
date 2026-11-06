# Matjar AI Assistant — implementation plan

**Status:** AI-1 provider foundation implemented on `feat/matjar-ai-provider-foundation`; automated verification is pending. No chat endpoint, UI, catalog tools, customer tools, or Super Admin controls are implemented yet.
**Provider:** GroqCloud API, using its free tier within the account's published rate limits.
**Primary model candidate:** `openai/gpt-oss-20b` (tool calling supported). Keep the model configurable because provider model availability and free-tier limits can change.
**Cost constraint:** No paid model/API plan and no paid vector database. The application must fail gracefully when the free quota is exhausted; it must never silently switch to a paid provider.

## Goals

Build an Arabic-first, multilingual shopping and customer-support assistant inside the existing Matjar marketplace. It must answer from current platform data and approved knowledge, not invent product availability, prices, policies, order states, or contact details.

The assistant should support:
- Public product discovery, filters, comparison, variants, current market pricing, and stock availability.
- Store/category/brand discovery and links to the actual product/store pages.
- Public help content: shipping, payment, returns, privacy, terms, contact methods, and how-to guidance.
- Authenticated customer-specific order, payment, return, and support-ticket lookups, restricted to the current user's own records.
- Creating a support ticket or handing a conversation to a human only through existing authorized domain services.
- Arabic and English initially; response language should follow the customer's message.

Out of scope for the first release:
- Direct database access from the model.
- Autonomous refunds, payment capture, order cancellation, inventory adjustment, price changes, or permission changes.
- Giving sellers or staff access to another seller's private data.
- Training/fine-tuning a model on customer data.
- Sending secrets, credentials, payment-card data, or unnecessary personal data to the model provider.

## Architecture

```
Storefront chat UI
  -> authenticated same-origin Next.js API route
    -> input validation, origin/rate-limit checks, session resolution
      -> AI application service / provider-neutral adapter
        -> Groq Chat Completions API (server-side key only)
        -> allowlisted Matjar tools
          -> existing catalog/order/support domain services
            -> repositories -> Prisma -> PostgreSQL
      -> persist conversation and sanitized tool/audit events
  -> stream/render assistant response and trusted product links
```

The AI layer must follow the repository's existing application layering. It must call existing services/repositories rather than creating parallel business logic. The model may propose tool calls, but the server validates every argument and independently enforces ownership, permissions, market scope, publication state, and limits before executing a tool.

## Provider and model configuration

- Use Groq's OpenAI-compatible endpoint: `https://api.groq.com/openai/v1/chat/completions`.
- Keep `GROQ_API_KEY` server-only. Never use a `NEXT_PUBLIC_` variable, return it to the browser, log it, or commit it.
- Configure `GROQ_MODEL` server-side; initial candidate: `openai/gpt-oss-20b`.
- Set explicit timeouts, bounded output tokens, conservative tool-call limits, and a small bounded conversation context.
- Handle provider 401/403, 429, timeout, unavailable model, malformed tool calls, and 5xx responses with safe user-facing messages.
- Do not implement an automatic paid fallback. When quota is exhausted, show a temporary-unavailable message and allow normal storefront/support flows to continue.
- Re-check Groq's current model availability, account limits, and free-plan terms before production use. Free usage is quota-limited and is not a production availability guarantee.

## Initial allowlisted tools

Implement tools incrementally and expose only those whose domain service and tests already exist:

1. `search_products`: validated text/category/brand/price/market filters; return only discoverable, approved, active products and current market prices.
2. `get_product_details`: public product details, published media, variants, availability and canonical URL.
3. `compare_products`: compare a small bounded set of discoverable products using normalized fields.
4. `search_help_content`: retrieve approved policies/FAQ/contact information from a controlled knowledge source.
5. `get_my_orders`: authenticated user's own orders only; never accept a customer/user ID supplied by the model.
6. `get_my_order_status`: verify order ownership before returning a minimal status/shipping summary.
7. `get_my_returns`: authenticated user's own return requests only.
8. `create_support_ticket`: only after explicit user confirmation, through the existing support service; validate and rate-limit.
9. `handoff_to_support`: create a handoff/support event through existing services, not an invented promise.

Do not expose tools for payments/refunds, cancellations, stock changes, account administration, staff management, or arbitrary SQL in the first release.

## Data and privacy boundaries

- Public requests can access only public catalog and approved help content.
- Resolve customer identity from the existing server session; never trust a user ID, role, store ID, or order ID supplied by the model or browser without server-side ownership checks.
- Send the provider only the minimum prompt, relevant catalog facts, and sanitized conversation context needed for the current turn.
- Do not send password hashes, session tokens, API keys, payment instrument details, identity documents, private seller records, or internal notes.
- Do not expose internal support notes or staff-only conversation messages.
- Treat product descriptions, reviews, FAQ text, and user messages as untrusted data; prompt injection inside retrieved content must not override system policy or tool authorization.
- Persist only necessary conversation data with retention/deletion policy to be defined before public launch. Redact secrets and sensitive values from logs.
- Add abuse controls: per-IP and per-user rate limits, message size limits, request timeout, tool-call cap, and safe handling of repeated/automated requests.

## Conversation UI

- Floating assistant entry point on storefront pages and a dedicated full-page conversation route.
- Streaming responses where supported, accessible keyboard controls, mobile layout, clear loading/error/retry states.
- Render product results as real Matjar product cards with canonical links; do not accept arbitrary HTML or model-supplied executable URLs.
- Provide clear actions for new conversation, copy response, and contact support.
- Explain that AI responses can be imperfect and show a human-support path.

## Super Admin controls and observability

Add an AI section to the existing Super Admin navigation only after inspecting its actual route/permission conventions:
- Overview: request counts, tool-call counts, error/quota events, and feedback.
- Conversations: restricted, audited access with privacy controls.
- Provider settings: model ID, enable/disable switch, safe limits. Never display the API secret after saving.
- Knowledge sources: approved FAQ/policy source status and re-index/reload actions if a retrieval index is later justified.
- Tool permissions: server-owned allowlist, not model-editable permissions.
- Feedback/evaluation: thumbs feedback, grounded-answer checks, refusal/ownership tests.
- Usage and security audit: aggregate usage, 429/quota errors, abuse signals, and administrative access log.

No admin screen may reveal the secret itself. Secret configuration remains an environment/deployment secret.

## Persistence decision

Do not add Prisma models before inspecting the existing conversation, support, audit, and messaging models/services. First determine whether existing conversation persistence can safely support AI sessions. Add the smallest additive schema only if required for AI-specific session ownership, message metadata, retention, or feedback. Every migration must have a documented reason, migration replay, and PostgreSQL integration coverage.

## Delivery phases and acceptance gates

### AI-0 — repository discovery
- Inspect current App Router routes, API conventions, session/authorization helpers, catalog services, product DTOs, order/return/support services, audit patterns, Super Admin route/permission registry, tests, and migrations.
- Produce a file-by-file integration map. Identify reusable services and missing workflows.
- No schema or code changes until ownership boundaries are clear.

### AI-1 — provider foundation
- Add a provider-neutral server-only Groq adapter and validated environment configuration.
- Add mocked provider tests; never require a live API key in CI.
- Verify secret redaction, timeout, 429/quota behavior, model configuration, and no paid fallback.

### AI-2 — public product assistant
- Implement the chat endpoint and only the public catalog tools.
- Add product cards, links, streaming/error states, input/rate limits.
- Test that unpublished, inactive, out-of-market, and unauthorized products never appear.

### AI-3 — approved knowledge and contact
- Connect approved FAQ/policy/contact content.
- Add source-grounding behavior: if no approved source answers the question, say so and offer support.
- Do not invent policies or contact information.

### AI-4 — authenticated customer support
- Add session-bound order/return lookups and support handoff.
- Test cross-user IDOR attempts, guest access, suspended accounts, and role boundaries.
- Require explicit confirmation before creating a support ticket.

### AI-5 — Super Admin and operations
- Add permission-protected controls, aggregate usage/error metrics, feedback, audit, and retention controls.
- Verify that secret values cannot be read back or leaked.

### AI-6 — release verification
- Run Prisma validation/generation if schema changed, unit tests, lint, typecheck, production build, and disposable PostgreSQL integration.
- Run end-to-end journeys for public discovery, Arabic conversation, quota exhaustion, authenticated order lookup, cross-user denial, support ticket confirmation, and admin permissions.
- Record exact commit and CI evidence. Do not claim production-ready until all P0 gates pass.

## Required environment variables

```env
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b
AI_ASSISTANT_ENABLED=false
```

Environment variable names and validation must be reconciled with the existing environment schema before implementation. The assistant stays disabled by default until all required secrets and acceptance checks are present.

## Current progress log

- 2026-11-06: Owner created a GroqCloud account and API key. The key has not been shared in chat and must remain private.
- 2026-11-06: This implementation contract was added to the canonical repository documentation. No API key was committed, no hosting environment was accessed, and no database was changed.
- 2026-11-06: Added server-only Groq Chat Completions adapter with a configurable model, explicit 20-second timeout, bounded message/output sizes, safe 401/403/429/5xx handling, and no paid-provider fallback. Added `GROQ_API_KEY`, `GROQ_MODEL`, and fail-closed `AI_ASSISTANT_ENABLED` environment validation. The assistant remains disabled unless the owner explicitly enables it and supplies the server-side key. Added unit coverage for disabled-by-default behavior, missing credentials, secret handling, quota exhaustion, and context bounds. Changes are on `feat/matjar-ai-provider-foundation`; CI has not yet been observed.
