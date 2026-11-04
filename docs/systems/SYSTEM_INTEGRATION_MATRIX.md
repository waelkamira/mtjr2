# System Integration Matrix — 49 Systems

**Rule:** This is the explicit dependency contract companion to each independent system specification. An upstream dependency is not a reason to duplicate its functionality. A downstream system consumes the owning system's service/API/event contract. The edges below are architectural dependencies to validate against implementation, not claims that the integration already exists.

## How to interpret
- **Upstream**: required inputs/capabilities this system consumes.
- **Downstream**: systems that consume its output or state.
- **Critical integration test**: prove one real end-to-end contract per direct edge group; for high-risk domains also test duplicate delivery, failure recovery and tenant isolation.
- All IDs refer to the numbered systems in the canonical 49-system blueprint.

## 10 — Notifications

- **Upstream:** **01 Identity**; **09 Messaging and support**; **45 Jobs/outbox**; **48 Newsletter/lifecycle email**
- **Downstream:** **05 Orders**; **08 Product Q&A**; **09 Messaging and support**; **11 Customer returns**; **12 Seller onboarding/KYB**; **15 Seller order management**; **26 Seller administration**; **38 Central support**; **45 Jobs/outbox**; **48 Newsletter/lifecycle email**; **49 Property/booking**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 11 — Customer returns

- **Upstream:** **01 Identity**; **05 Orders**; **10 Notifications**; **15 Seller order management**; **18 Seller shipping**
- **Downstream:** **29 Payment administration**; **31 Accounting ledger**; **32 Payout administration**; **33 Returns/refunds/disputes administration**; **38 Central support**; **42 Invoicing/credit notes**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 12 — Seller onboarding/KYB

- **Upstream:** **01 Identity**; **23 Store management**; **40 Platform governance**; **41 Markets/FX/localization**; **46 Security/audit/risk**
- **Downstream:** **13 Seller dashboard**; **14 Seller product management**; **15 Seller order management**; **16 Inventory/warehouses**; **18 Seller shipping**; **19 Seller finance**; **22 Seller staff permissions**; **23 Store management**; **26 Seller administration**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 13 — Seller dashboard

- **Upstream:** **01 Identity**; **14 Seller product management**; **15 Seller order management**; **16 Inventory/warehouses**; **19 Seller finance**; **20 Seller marketing**; **21 Seller reputation**; **22 Seller staff permissions**; **23 Store management**; **43 Analytics/reporting**
- **Downstream:** **24 Admin command center**; **43 Analytics/reporting**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 14 — Seller product management

- **Upstream:** **01 Identity**; **02 Product catalog**; **12 Seller onboarding/KYB**; **16 Inventory/warehouses**; **23 Store management**; **27 Catalog administration**; **41 Markets/FX/localization**
- **Downstream:** **02 Product catalog**; **03 Search**; **04 Cart and checkout**; **06 Reviews**; **07 Wishlist**; **08 Product Q&A**; **13 Seller dashboard**; **15 Seller order management**; **16 Inventory/warehouses**; **20 Seller marketing**; **21 Seller reputation**; **27 Catalog administration**; **47 SEO/public discovery**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 15 — Seller order management

- **Upstream:** **01 Identity**; **04 Cart and checkout**; **05 Orders**; **10 Notifications**; **11 Customer returns**; **16 Inventory/warehouses**; **18 Seller shipping**
- **Downstream:** **19 Seller finance**; **28 Central order operations**; **29 Payment administration**; **31 Accounting ledger**; **32 Payout administration**; **33 Returns/refunds/disputes administration**; **38 Central support**; **42 Invoicing/credit notes**; **43 Analytics/reporting**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 16 — Inventory/warehouses

- **Upstream:** **01 Identity**; **14 Seller product management**; **15 Seller order management**; **17 Procurement**; **18 Seller shipping**; **23 Store management**
- **Downstream:** **04 Cart and checkout**; **05 Orders**; **13 Seller dashboard**; **15 Seller order management**; **17 Procurement**; **18 Seller shipping**; **19 Seller finance**; **43 Analytics/reporting**; **45 Jobs/outbox**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 17 — Procurement

- **Upstream:** **01 Identity**; **16 Inventory/warehouses**; **23 Store management**; **41 Markets/FX/localization**
- **Downstream:** **13 Seller dashboard**; **16 Inventory/warehouses**; **18 Seller shipping**; **19 Seller finance**; **43 Analytics/reporting**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 18 — Seller shipping

- **Upstream:** **01 Identity**; **15 Seller order management**; **16 Inventory/warehouses**; **34 Shipping administration**; **35 Tax/compliance**; **41 Markets/FX/localization**; **44 External integrations**; **45 Jobs/outbox**
- **Downstream:** **04 Cart and checkout**; **05 Orders**; **11 Customer returns**; **15 Seller order management**; **28 Central order operations**; **29 Payment administration**; **33 Returns/refunds/disputes administration**; **42 Invoicing/credit notes**; **43 Analytics/reporting**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 19 — Seller finance

- **Upstream:** **01 Identity**; **05 Orders**; **29 Payment administration**; **30 Commission management**; **31 Accounting ledger**; **32 Payout administration**; **35 Tax/compliance**; **41 Markets/FX/localization**; **42 Invoicing/credit notes**
- **Downstream:** **13 Seller dashboard**; **24 Admin command center**; **31 Accounting ledger**; **32 Payout administration**; **42 Invoicing/credit notes**; **43 Analytics/reporting**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 20 — Seller marketing

- **Upstream:** **01 Identity**; **02 Product catalog**; **03 Search**; **36 Promotions/loyalty**; **39 CMS/content**; **41 Markets/FX/localization**; **48 Newsletter/lifecycle email**
- **Downstream:** **04 Cart and checkout**; **07 Wishlist**; **13 Seller dashboard**; **43 Analytics/reporting**; **48 Newsletter/lifecycle email**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 21 — Seller reputation

- **Upstream:** **01 Identity**; **02 Product catalog**; **06 Reviews**; **08 Product Q&A**; **37 Review moderation**
- **Downstream:** **13 Seller dashboard**; **24 Admin command center**; **43 Analytics/reporting**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 22 — Seller staff permissions

- **Upstream:** **01 Identity**; **23 Store management**; **25 User administration**; **40 Platform governance**; **46 Security/audit/risk**
- **Downstream:** **09 Messaging and support**; **13 Seller dashboard**; **14 Seller product management**; **15 Seller order management**; **16 Inventory/warehouses**; **19 Seller finance**; **20 Seller marketing**; **23 Store management**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 23 — Store management

- **Upstream:** **01 Identity**; **12 Seller onboarding/KYB**; **22 Seller staff permissions**; **41 Markets/FX/localization**
- **Downstream:** **02 Product catalog**; **12 Seller onboarding/KYB**; **13 Seller dashboard**; **14 Seller product management**; **16 Inventory/warehouses**; **18 Seller shipping**; **20 Seller marketing**; **21 Seller reputation**; **49 Property/booking**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 24 — Admin command center

- **Upstream:** **01 Identity**; **25 User administration**; **26 Seller administration**; **28 Central order operations**; **29 Payment administration**; **31 Accounting ledger**; **32 Payout administration**; **33 Returns/refunds/disputes administration**; **35 Tax/compliance**; **38 Central support**; **40 Platform governance**; **43 Analytics/reporting**; **45 Jobs/outbox**; **46 Security/audit/risk**
- **Downstream:** **25 User administration**; **26 Seller administration**; **27 Catalog administration**; **28 Central order operations**; **29 Payment administration**; **30 Commission management**; **31 Accounting ledger**; **32 Payout administration**; **33 Returns/refunds/disputes administration**; **34 Shipping administration**; **35 Tax/compliance**; **38 Central support**; **39 CMS/content**; **40 Platform governance**; **43 Analytics/reporting**; **44 External integrations**; **45 Jobs/outbox**; **46 Security/audit/risk**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 25 — User administration

- **Upstream:** **01 Identity**; **24 Admin command center**; **40 Platform governance**; **46 Security/audit/risk**
- **Downstream:** **01 Identity**; **09 Messaging and support**; **10 Notifications**; **12 Seller onboarding/KYB**; **22 Seller staff permissions**; **26 Seller administration**; **38 Central support**; **46 Security/audit/risk**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 26 — Seller administration

- **Upstream:** **01 Identity**; **12 Seller onboarding/KYB**; **22 Seller staff permissions**; **23 Store management**; **40 Platform governance**; **46 Security/audit/risk**
- **Downstream:** **13 Seller dashboard**; **14 Seller product management**; **15 Seller order management**; **16 Inventory/warehouses**; **18 Seller shipping**; **19 Seller finance**; **22 Seller staff permissions**; **23 Store management**; **24 Admin command center**; **43 Analytics/reporting**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 27 — Catalog administration

- **Upstream:** **01 Identity**; **02 Product catalog**; **03 Search**; **14 Seller product management**; **35 Tax/compliance**; **39 CMS/content**; **41 Markets/FX/localization**; **46 Security/audit/risk**; **47 SEO/public discovery**
- **Downstream:** **02 Product catalog**; **03 Search**; **14 Seller product management**; **20 Seller marketing**; **39 CMS/content**; **43 Analytics/reporting**; **47 SEO/public discovery**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 28 — Central order operations

- **Upstream:** **01 Identity**; **04 Cart and checkout**; **05 Orders**; **11 Customer returns**; **15 Seller order management**; **18 Seller shipping**; **29 Payment administration**; **31 Accounting ledger**; **33 Returns/refunds/disputes administration**; **34 Shipping administration**; **35 Tax/compliance**; **42 Invoicing/credit notes**; **45 Jobs/outbox**; **46 Security/audit/risk**
- **Downstream:** **24 Admin command center**; **29 Payment administration**; **31 Accounting ledger**; **32 Payout administration**; **33 Returns/refunds/disputes administration**; **34 Shipping administration**; **35 Tax/compliance**; **38 Central support**; **42 Invoicing/credit notes**; **43 Analytics/reporting**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 29 — Payment administration

- **Upstream:** **01 Identity**; **04 Cart and checkout**; **05 Orders**; **28 Central order operations**; **31 Accounting ledger**; **32 Payout administration**; **33 Returns/refunds/disputes administration**; **35 Tax/compliance**; **44 External integrations**; **45 Jobs/outbox**; **46 Security/audit/risk**
- **Downstream:** **04 Cart and checkout**; **05 Orders**; **11 Customer returns**; **19 Seller finance**; **24 Admin command center**; **28 Central order operations**; **31 Accounting ledger**; **32 Payout administration**; **33 Returns/refunds/disputes administration**; **38 Central support**; **42 Invoicing/credit notes**; **43 Analytics/reporting**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 30 — Commission management

- **Upstream:** **01 Identity**; **19 Seller finance**; **31 Accounting ledger**; **32 Payout administration**; **35 Tax/compliance**; **41 Markets/FX/localization**
- **Downstream:** **19 Seller finance**; **24 Admin command center**; **31 Accounting ledger**; **32 Payout administration**; **42 Invoicing/credit notes**; **43 Analytics/reporting**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 31 — Accounting ledger

- **Upstream:** **01 Identity**; **05 Orders**; **19 Seller finance**; **29 Payment administration**; **30 Commission management**; **32 Payout administration**; **33 Returns/refunds/disputes administration**; **35 Tax/compliance**; **42 Invoicing/credit notes**; **46 Security/audit/risk**
- **Downstream:** **24 Admin command center**; **29 Payment administration**; **30 Commission management**; **32 Payout administration**; **33 Returns/refunds/disputes administration**; **42 Invoicing/credit notes**; **43 Analytics/reporting**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 32 — Payout administration

- **Upstream:** **01 Identity**; **19 Seller finance**; **29 Payment administration**; **30 Commission management**; **31 Accounting ledger**; **44 External integrations**; **46 Security/audit/risk**
- **Downstream:** **19 Seller finance**; **24 Admin command center**; **31 Accounting ledger**; **42 Invoicing/credit notes**; **43 Analytics/reporting**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 33 — Returns/refunds/disputes administration

- **Upstream:** **01 Identity**; **05 Orders**; **11 Customer returns**; **15 Seller order management**; **29 Payment administration**; **31 Accounting ledger**; **34 Shipping administration**; **35 Tax/compliance**; **38 Central support**; **45 Jobs/outbox**; **46 Security/audit/risk**
- **Downstream:** **24 Admin command center**; **28 Central order operations**; **29 Payment administration**; **31 Accounting ledger**; **32 Payout administration**; **38 Central support**; **42 Invoicing/credit notes**; **43 Analytics/reporting**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 34 — Shipping administration

- **Upstream:** **01 Identity**; **18 Seller shipping**; **35 Tax/compliance**; **41 Markets/FX/localization**; **44 External integrations**; **45 Jobs/outbox**
- **Downstream:** **04 Cart and checkout**; **05 Orders**; **11 Customer returns**; **15 Seller order management**; **18 Seller shipping**; **28 Central order operations**; **29 Payment administration**; **33 Returns/refunds/disputes administration**; **42 Invoicing/credit notes**; **43 Analytics/reporting**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 35 — Tax/compliance

- **Upstream:** **01 Identity**; **04 Cart and checkout**; **18 Seller shipping**; **28 Central order operations**; **29 Payment administration**; **31 Accounting ledger**; **34 Shipping administration**; **41 Markets/FX/localization**; **42 Invoicing/credit notes**; **44 External integrations**; **46 Security/audit/risk**
- **Downstream:** **04 Cart and checkout**; **05 Orders**; **18 Seller shipping**; **24 Admin command center**; **28 Central order operations**; **29 Payment administration**; **31 Accounting ledger**; **32 Payout administration**; **33 Returns/refunds/disputes administration**; **42 Invoicing/credit notes**; **43 Analytics/reporting**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 36 — Promotions/loyalty

- **Upstream:** **01 Identity**; **02 Product catalog**; **03 Search**; **07 Wishlist**; **20 Seller marketing**; **39 CMS/content**; **41 Markets/FX/localization**; **48 Newsletter/lifecycle email**
- **Downstream:** **04 Cart and checkout**; **07 Wishlist**; **13 Seller dashboard**; **20 Seller marketing**; **24 Admin command center**; **43 Analytics/reporting**; **48 Newsletter/lifecycle email**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 37 — Review moderation

- **Upstream:** **01 Identity**; **06 Reviews**; **08 Product Q&A**; **21 Seller reputation**; **38 Central support**; **46 Security/audit/risk**
- **Downstream:** **06 Reviews**; **08 Product Q&A**; **21 Seller reputation**; **24 Admin command center**; **38 Central support**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 38 — Central support

- **Upstream:** **01 Identity**; **09 Messaging and support**; **10 Notifications**; **11 Customer returns**; **28 Central order operations**; **33 Returns/refunds/disputes administration**; **37 Review moderation**; **46 Security/audit/risk**
- **Downstream:** **09 Messaging and support**; **10 Notifications**; **11 Customer returns**; **24 Admin command center**; **33 Returns/refunds/disputes administration**; **37 Review moderation**; **46 Security/audit/risk**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 39 — CMS/content

- **Upstream:** **01 Identity**; **24 Admin command center**; **40 Platform governance**; **47 SEO/public discovery**
- **Downstream:** **02 Product catalog**; **03 Search**; **24 Admin command center**; **36 Promotions/loyalty**; **47 SEO/public discovery**; **48 Newsletter/lifecycle email**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 40 — Platform governance

- **Upstream:** **01 Identity**; **24 Admin command center**; **25 User administration**; **26 Seller administration**; **39 CMS/content**; **44 External integrations**; **45 Jobs/outbox**; **46 Security/audit/risk**
- **Downstream:** **01 Identity**; **24 Admin command center**; **25 User administration**; **26 Seller administration**; **27 Catalog administration**; **29 Payment administration**; **34 Shipping administration**; **35 Tax/compliance**; **39 CMS/content**; **44 External integrations**; **45 Jobs/outbox**; **46 Security/audit/risk**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 41 — Markets/FX/localization

- **Upstream:** **01 Identity**; **02 Product catalog**; **03 Search**; **04 Cart and checkout**; **12 Seller onboarding/KYB**; **14 Seller product management**; **18 Seller shipping**; **35 Tax/compliance**; **36 Promotions/loyalty**; **39 CMS/content**; **42 Invoicing/credit notes**; **47 SEO/public discovery**; **48 Newsletter/lifecycle email**
- **Downstream:** **02 Product catalog**; **03 Search**; **04 Cart and checkout**; **12 Seller onboarding/KYB**; **14 Seller product management**; **18 Seller shipping**; **20 Seller marketing**; **35 Tax/compliance**; **36 Promotions/loyalty**; **42 Invoicing/credit notes**; **43 Analytics/reporting**; **47 SEO/public discovery**; **48 Newsletter/lifecycle email**; **49 Property/booking**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 42 — Invoicing/credit notes

- **Upstream:** **01 Identity**; **05 Orders**; **19 Seller finance**; **29 Payment administration**; **31 Accounting ledger**; **35 Tax/compliance**
- **Downstream:** **19 Seller finance**; **24 Admin command center**; **28 Central order operations**; **29 Payment administration**; **31 Accounting ledger**; **32 Payout administration**; **33 Returns/refunds/disputes administration**; **43 Analytics/reporting**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 43 — Analytics/reporting

- **Upstream:** **01 Identity**; **05 Orders**; **13 Seller dashboard**; **19 Seller finance**; **24 Admin command center**; **28 Central order operations**; **29 Payment administration**; **31 Accounting ledger**; **32 Payout administration**; **33 Returns/refunds/disputes administration**; **41 Markets/FX/localization**; **45 Jobs/outbox**
- **Downstream:** **24 Admin command center**; **13 Seller dashboard**; **19 Seller finance**; **25 User administration**; **26 Seller administration**; **27 Catalog administration**; **28 Central order operations**; **29 Payment administration**; **30 Commission management**; **31 Accounting ledger**; **32 Payout administration**; **33 Returns/refunds/disputes administration**; **34 Shipping administration**; **35 Tax/compliance**; **36 Promotions/loyalty**; **38 Central support**; **43 Analytics/reporting**; **46 Security/audit/risk**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 44 — External integrations

- **Upstream:** **01 Identity**; **29 Payment administration**; **34 Shipping administration**; **35 Tax/compliance**; **40 Platform governance**; **41 Markets/FX/localization**; **45 Jobs/outbox**; **46 Security/audit/risk**
- **Downstream:** **04 Cart and checkout**; **18 Seller shipping**; **24 Admin command center**; **29 Payment administration**; **34 Shipping administration**; **35 Tax/compliance**; **41 Markets/FX/localization**; **45 Jobs/outbox**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 45 — Jobs/outbox

- **Upstream:** **01 Identity**; **04 Cart and checkout**; **05 Orders**; **10 Notifications**; **18 Seller shipping**; **29 Payment administration**; **34 Shipping administration**; **38 Central support**; **40 Platform governance**; **44 External integrations**; **46 Security/audit/risk**
- **Downstream:** **10 Notifications**; **24 Admin command center**; **28 Central order operations**; **29 Payment administration**; **31 Accounting ledger**; **32 Payout administration**; **33 Returns/refunds/disputes administration**; **34 Shipping administration**; **35 Tax/compliance**; **38 Central support**; **43 Analytics/reporting**; **44 External integrations**; **46 Security/audit/risk**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 46 — Security/audit/risk

- **Upstream:** **01 Identity**; **24 Admin command center**; **25 User administration**; **26 Seller administration**; **29 Payment administration**; **31 Accounting ledger**; **33 Returns/refunds/disputes administration**; **40 Platform governance**; **44 External integrations**; **45 Jobs/outbox**
- **Downstream:** **01 Identity**; **12 Seller onboarding/KYB**; **22 Seller staff permissions**; **24 Admin command center**; **25 User administration**; **26 Seller administration**; **27 Catalog administration**; **29 Payment administration**; **31 Accounting ledger**; **33 Returns/refunds/disputes administration**; **35 Tax/compliance**; **37 Review moderation**; **38 Central support**; **40 Platform governance**; **44 External integrations**; **45 Jobs/outbox**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 47 — SEO/public discovery

- **Upstream:** **01 Identity**; **02 Product catalog**; **03 Search**; **27 Catalog administration**; **39 CMS/content**; **41 Markets/FX/localization**
- **Downstream:** **02 Product catalog**; **03 Search**; **24 Admin command center**; **39 CMS/content**; **43 Analytics/reporting**; **47 SEO/public discovery**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 48 — Newsletter/lifecycle email

- **Upstream:** **01 Identity**; **10 Notifications**; **20 Seller marketing**; **36 Promotions/loyalty**; **39 CMS/content**
- **Downstream:** **10 Notifications**; **20 Seller marketing**; **24 Admin command center**; **36 Promotions/loyalty**; **43 Analytics/reporting**; **48 Newsletter/lifecycle email**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 49 — Property/booking

- **Upstream:** **01 Identity**; **10 Notifications**; **12 Seller onboarding/KYB**; **23 Store management**; **38 Central support**; **41 Markets/FX/localization**; **43 Analytics/reporting**; **46 Security/audit/risk**
- **Downstream:** **10 Notifications**; **23 Store management**; **24 Admin command center**; **38 Central support**; **43 Analytics/reporting**; **46 Security/audit/risk**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 01 — Identity

- **Upstream:** No numbered business-system prerequisite; depends on shared runtime/security foundation.
- **Downstream:** **02 Product catalog**; **04 Cart and checkout**; **05 Orders**; **07 Wishlist**; **09 Messaging and support**; **10 Notifications**; **11 Customer returns**; **12 Seller onboarding/KYB**; **22 Seller staff permissions**; **25 User administration**; **38 Central support**; **40 Platform governance**; **46 Security/audit/risk**; **48 Newsletter/lifecycle email**; **49 Property/booking**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 02 — Product catalog

- **Upstream:** **01 Identity**; **12 Seller onboarding/KYB**; **23 Store management**; **27 Catalog administration**; **41 Markets/FX/localization**
- **Downstream:** **03 Search**; **04 Cart and checkout**; **06 Reviews**; **07 Wishlist**; **08 Product Q&A**; **14 Seller product management**; **20 Seller marketing**; **21 Seller reputation**; **27 Catalog administration**; **47 SEO/public discovery**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 03 — Search

- **Upstream:** **01 Identity**; **02 Product catalog**; **27 Catalog administration**; **41 Markets/FX/localization**
- **Downstream:** **02 Product catalog**; **04 Cart and checkout**; **07 Wishlist**; **14 Seller product management**; **20 Seller marketing**; **47 SEO/public discovery**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 04 — Cart and checkout

- **Upstream:** **01 Identity**; **02 Product catalog**; **03 Search**; **07 Wishlist**; **16 Inventory/warehouses**; **18 Seller shipping**; **29 Payment administration**; **35 Tax/compliance**; **36 Promotions/loyalty**; **41 Markets/FX/localization**; **44 External integrations**
- **Downstream:** **05 Orders**; **10 Notifications**; **15 Seller order management**; **19 Seller finance**; **29 Payment administration**; **31 Accounting ledger**; **32 Payout administration**; **33 Returns/refunds/disputes administration**; **42 Invoicing/credit notes**; **43 Analytics/reporting**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 05 — Orders

- **Upstream:** **01 Identity**; **04 Cart and checkout**; **10 Notifications**; **15 Seller order management**; **18 Seller shipping**; **29 Payment administration**; **35 Tax/compliance**; **41 Markets/FX/localization**; **45 Jobs/outbox**
- **Downstream:** **11 Customer returns**; **15 Seller order management**; **19 Seller finance**; **28 Central order operations**; **29 Payment administration**; **31 Accounting ledger**; **32 Payout administration**; **33 Returns/refunds/disputes administration**; **38 Central support**; **42 Invoicing/credit notes**; **43 Analytics/reporting**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 06 — Reviews

- **Upstream:** **01 Identity**; **02 Product catalog**; **05 Orders**; **10 Notifications**
- **Downstream:** **08 Product Q&A**; **21 Seller reputation**; **37 Review moderation**; **43 Analytics/reporting**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 07 — Wishlist

- **Upstream:** **01 Identity**; **02 Product catalog**; **03 Search**; **41 Markets/FX/localization**
- **Downstream:** **04 Cart and checkout**; **13 Seller dashboard**; **20 Seller marketing**; **36 Promotions/loyalty**; **43 Analytics/reporting**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 08 — Product Q&A

- **Upstream:** **01 Identity**; **02 Product catalog**; **10 Notifications**
- **Downstream:** **09 Messaging and support**; **21 Seller reputation**; **37 Review moderation**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.

## 09 — Messaging and support

- **Upstream:** **01 Identity**; **10 Notifications**; **22 Seller staff permissions**; **38 Central support**
- **Downstream:** **10 Notifications**; **11 Customer returns**; **21 Seller reputation**; **38 Central support**
- **Contract:** read/write through the owning domain service; use typed API/event payloads, server-derived identity/scope, stable state transitions, and idempotent commands where retries are possible.
- **Critical test:** run the primary journey through this system and at least one upstream and downstream consumer; assert persistence, permission boundaries, no duplicate side effect, and correct UI state after refresh.


## Shared high-risk contracts

| Contract | Owning systems | Required invariant |
|---|---|---|
| Identity and scope | 01, 22, 25, 40, 46 | Server-derived actor, role, store scope and resource ownership; UI hiding is not authorization. |
| Catalog and availability | 02, 14, 16, 27, 41, 47 | Only published/approved market-eligible items appear; stock and price are never trusted from client payloads. |
| Checkout to money/order | 04, 05, 15, 29, 31, 32, 35, 41, 42, 44, 45 | Quote snapshots, idempotent payment intent, verified webhook, atomic order/vendor-order creation, ledger/reconciliation, immutable tax/price/address snapshots. |
| Fulfillment and post-purchase | 05, 11, 15, 18, 28, 33, 34, 38, 42 | Seller-scoped shipment lifecycle; delivery evidence; return decision distinct from refund execution; customer-visible status derived from canonical state. |
| Finance and settlement | 19, 29, 30, 31, 32, 33, 42, 43 | Double-entry ledger, no direct balance edits, dual control, idempotent payout, reconciliation and immutable audit. |
| Trust and communications | 06, 08, 09, 10, 21, 37, 38, 48 | Verified eligibility, moderation lifecycle, participant privacy, consent-aware delivery and retry logs. |
| Global market readiness | 12, 14, 18, 20, 35, 36, 41, 42, 44, 47, 49 | Market/currency/locale, legal/tax/customs/shipping configuration and product eligibility must agree before launch. |
| Platform operations | 24, 40, 44, 45, 46 | Audited configuration, secrets server-side, replay-safe jobs, observability, incident response and least privilege. |
| Separate property context | 49 | Shared identity/market/communications only through explicit contracts; never reuse product cart/order/stock semantics by accident. |

## Integration acceptance checklist
- [ ] Each edge has a named source service, destination consumer and contract.
- [ ] Request/event schemas are versioned and validated.
- [ ] Actor, permission, store/user scope and market are enforced server-side.
- [ ] Duplicate delivery/retry does not duplicate side effects.
- [ ] Partial failure has rollback or a recoverable state and reconciliation.
- [ ] The resulting status is visible on the correct buyer/seller/admin page.
- [ ] Exact test command, database evidence and commit are recorded in the journey matrix.
