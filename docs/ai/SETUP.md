# Matjar AI Assistant — setup and operation

## Local setup

1. Create a local `.env.local` file from `.env.example`.
2. Add the Groq API key generated in the Groq Console to `GROQ_API_KEY`.
3. Keep the account on Groq's Free plan. Do not add a payment method or upgrade to Developer if the requirement is zero API spend.
4. Keep `GROQ_MODEL=openai/gpt-oss-20b`.
5. Run `npx prisma migrate deploy` so the singleton AI settings row and the Super Admin control policy are available.
6. Keep `AI_ASSISTANT_ENABLED=false` until the Groq key and model access are verified. This environment variable is a hard kill switch; the database setting cannot override it.
7. Configure `TRUSTED_PROXY_IP_HEADER` only when the edge guarantees it overwrites the selected header; supported values are `cf-connecting-ip` and `x-vercel-forwarded-for`. Never trust a client-controlled forwarding header.
8. Bootstrap the first Super Admin only through the one-time procedure in `docs/operations/SUPER_ADMIN_BOOTSTRAP.md`, then complete MFA.
9. After the key and environment switch are configured, open `/admin/control-panel/ai-assistant` and enable the assistant. The page never displays the secret; every setting change is audited.
10. Start the application with `npm run dev` and test product search, product details, guest order lookup, and signed-in order lookup.

Example local-only configuration:

```env
GROQ_API_KEY=your_private_key
GROQ_MODEL=openai/gpt-oss-20b
AI_ASSISTANT_ENABLED=true
```

Never commit `.env.local`, expose the key in a `NEXT_PUBLIC_*` variable, paste the key into chat, or include it in screenshots/logs.

## Current capabilities

- Public product search from Matjar's active/approved catalog.
- Public product detail lookup by slug or product ID.
- Current stock filtering when explicitly requested; normal catalog search does not imply in-stock status.
- Signed-in customer's recent order and return summaries, resolved from the server session and rendered directly by Matjar. Private order/return details are not sent to Groq.
- Direct handoff link to the existing `/account/support` route.
- Arabic-first responses, with English support based on browser language.
- No autonomous write operations and no paid provider fallback.

## Free-tier safeguards and limitations

Groq free-plan quotas are limited and are subject to change. The application reports quota exhaustion and does not switch to another paid model. The Super Admin page `/admin/control-panel/ai-assistant` controls the database-backed enabled flag and bounded completion-token limit. The model is currently fixed to `openai/gpt-oss-20b`. The provider key is represented only as a configured/not-configured boolean and is never returned to the browser. Both the database flag and the environment master switch must be on. The in-process request throttle is only a best-effort guard and is not distributed across server instances. If no trusted proxy header is configured or present, all requests share a restrictive fallback bucket (3 requests/minute); this avoids trusting spoofable client headers but is unsuitable for normal multi-user production traffic. Production use requires a verified edge header, shared rate limiting, and usage monitoring.

The model catalog page may display Developer-plan token prices even though Free-plan use is quota-limited. The owner must verify the current account tier and model access in Groq Console. Do not upgrade the account if zero API charges are required.

## Privacy

Chat text is sent to Groq for generation. Customer order data is fetched by Matjar using the verified session and rendered in the browser; order details are not included in the Groq tool result. Never send secrets, credentials, payment data, addresses, internal notes, or identity documents to the model.

Review Groq's current data-processing terms and the marketplace privacy notice before enabling the feature for customers in regulated jurisdictions.

## Not yet included

- Approved FAQ/shipping/returns/payment/contact knowledge source.
- Creating support tickets directly from chat (use the existing support workflow).
- Durable chat history, feedback and AI usage analytics.
- Shared/distributed rate limiting and browser end-to-end tests.
- Environment-specific production secret provisioning and a live Groq smoke test.
