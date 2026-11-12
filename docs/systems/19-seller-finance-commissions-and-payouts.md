# النظام 19: Seller finance, commissions and payouts

> مواصفة تنفيذ مستقلة مستخرجة من المخطط الوظيفي. لا تعني وجود التنفيذ أو اكتماله.

## 1. الغرض والحدود
- **الغرض:** Transparent seller balance, fees, commissions, settlement statements and payout requests.
- **المتطلبات الأساسية:** immutable ledger, double-entry postings, fees/taxes/refunds, holds, available vs pending balance, payout eligibility and reconciliation.
- **الحالة عند تدقيق baseline:** **Schema-only.** Finance models existed; audit found no direct model delegates or complete seller finance workflow.
- **الحالة الحالية على main (2026-11-09):** CommissionRule وإدارة قواعد العمولة وCommissionTransaction snapshots عند نجاح الدفع الموثق موجودة. صفحة `/seller/commissions` تعرض snapshots واستردادات مكتملة حسب المتجر والعملة، وصفحة `/seller/finance` تعرض ملخصاً للقراءة فقط. لا يوجد بعد دفتر أستاذ مزدوج، أو أرصدة مستحقة/معلقة، أو حجوزات/تسويات، أو وسائل سحب وطلبات دفع، أو reconciliation.
- **مالك المجال:** يحدد من خريطة الأنظمة؛ واجهات الإدارة تراقب وتضبط السياسة، وخدمة المجال هنا وحدها تملك قواعد الانتقال والكتابة.
- **داخل النطاق:** دورة حياة البيانات والعمليات والصفحات وواجهات API الخاصة بهذا النظام.
- **خارج النطاق:** وظائف الأنظمة الأخرى؛ تُستهلك عبر عقود وخدمات موثقة ولا يعاد بناء منطقها أو جداولها.
- **قاعدة عدم التداخل:** مصدر واحد لكل حقيقة تجارية، ومالك واحد لكل state transition، وعدم إنشاء صفحة أو جدول مكرر لمجرد وجود زر جديد.

## 2. الصفحات ومكانها
**صفحات الهدف:** `/seller/finance`, `/seller/transactions`, `/seller/payouts`, payout method and statement detail.

| Route الهدف | ملف الصفحة في المصدر عند baseline |
|---|---|
| `/seller/finance` | غير موجود بالمسار المتوقع؛ افحص route registry لاحتمال مسار بديل |
| `/seller/transactions` | غير موجود بالمسار المتوقع؛ افحص route registry لاحتمال مسار بديل |
| `/seller/payouts` | غير موجود بالمسار المتوقع؛ افحص route registry لاحتمال مسار بديل |
> فحص الوجود من شجرة commit `a509196e643fc82937eed856b522c0cc5e4dbc2f` فقط. لا يثبت أن الصفحة تعرض أو تعمل. لا تنشئ مساراً بديلاً قبل مراجعة `PAGE_ROUTE_REGISTRY.md`.

## 3. آلية عمل النظام
1. **نقطة الدخول:** صفحة/لوحة الجمهور الصحيح، مع رابط تنقل واضح وصلاحية مناسبة.
2. **تفاعل المستخدم:** الزر يستدعي handler محدداً؛ client validation لتحسين UX فقط.
3. **طلب API:** عقد request/response موثق، Zod params/query/body، حدود للحجم والصفحات، correlation ID، وidempotency key للعمليات القابلة للتكرار.
4. **التحقق الخلفي:** session وحالة الحساب، permission، role، resource ownership، tenant/store scope، market eligibility، وحالة الكيان الحالية.
5. **منطق المجال:** route handler رقيق يستدعي خدمة النظام؛ الخدمة تستدعي repository/Prisma ولا تضع قواعد العمل في UI.
6. **الحفظ:** transaction واحدة للكتابات المترابطة، وقيود DB تمنع التكرار والسباقات؛ لا تعتمد على فحص سابق من الواجهة.
7. **التكامل:** audit للأفعال الحساسة؛ outbox/domain event عند الحاجة؛ retries idempotent، وفشل التابع ينتج rollback أو حالة قابلة للاسترداد حسب السياسة.
8. **الاستجابة:** API يعيد الحالة canonical والمعرفات والأخطاء المستقرة؛ لا نجاح متفائل قبل تأكيد الخادم.
9. **الواجهة:** تعرض success بعد الاستجابة، تحدث البيانات/تعيد الجلب، وتغطي loading/empty/error/forbidden/conflict/retry.

## 4. تتبع كل زر حتى النتيجة
يجب تحويل كل عنصر تفاعلي حقيقي إلى رحلة مستقلة في مصفوفة النظام، وتسجيل اسم component/function والمسار والحقول الفعلية. القالب الإلزامي:

| الزر/الرابط | UI handler | API + schema | authorization + domain rule | service/repository | Prisma + transaction | نتيجة الواجهة |
|---|---|---|---|---|---|---|
| فتح القائمة/التفاصيل | loader/query | GET + query Zod | visibility + scope | list/get | read + stable pagination | بيانات حقيقية أو empty/error |
| إنشاء/إضافة | submit | POST + body Zod | permission + ownership + duplicate guard | create | transaction + unique/FK | العنصر محفوظ ويظهر بعد refresh |
| تعديل | save | PATCH/PUT | permission + valid state + concurrency | update | conditional update/transaction | القيم الجديدة من الخادم |
| موافقة/رفض/إلغاء/انتقال | confirm action | command endpoint | permission منفصلة + reason + transition graph | transition | atomic state + audit | الحالة الجديدة وسجلها |
| إعادة المحاولة | retry | same idempotency key | actor/resource/intent match | idempotent command | unique key | لا يتكرر الأثر |

## 5. واجهات API والخدمات
**واجهات API المستهدفة:** `/api/seller/finance/summary`, `/api/seller/transactions`, `/api/seller/payouts`, `/api/seller/payout-methods`.

| API | route.ts في baseline |
|---|---|
| `/api/seller/finance/summary` | لم يُعثر على ملف مطابق؛ راجع مسار API البديل قبل الإضافة |
| `/api/seller/transactions` | لم يُعثر على ملف مطابق؛ راجع مسار API البديل قبل الإضافة |
| `/api/seller/payouts` | لم يُعثر على ملف مطابق؛ راجع مسار API البديل قبل الإضافة |
| `/api/seller/payout-methods` | لم يُعثر على ملف مطابق؛ راجع مسار API البديل قبل الإضافة |
- افحص handler → Zod → permission guard → domain service → repository → Prisma → response.
- استخرج user/seller/store/actor من الجلسة والعضوية server-side؛ لا تثق بمعرفات scope القادمة من العميل.
- أخطاء مستقرة: 400/401/403/404/409/422/429/500 دون تسريب أسرار أو معلومات موارد خاصة.
- لا تعتبر route موجوداً إذا كان stub أو fixture أو static response.

## 6. Prisma ومصدر الحقيقة
**النماذج المقترحة في blueprint:** `SellerLedgerEntry`, `LedgerAccount`, `JournalEntry`, `JournalLine`, `CommissionRule`, `CommissionTransaction`, `PayoutMethod`, `Payout`, `Payment`, `Refund`, `Currency`.

| Prisma model | وضعه في schema الحالية | القرار |
|---|---|---|
| `SellerLedgerEntry` | غير موجود؛ لا تنشئه تلقائياً قبل إثبات فجوة بيانات دائمة |
| `LedgerAccount` | غير موجود؛ لا تنشئه تلقائياً قبل إثبات فجوة بيانات دائمة |
| `JournalEntry` | غير موجود؛ لا تنشئه تلقائياً قبل إثبات فجوة بيانات دائمة |
| `JournalLine` | غير موجود؛ لا تنشئه تلقائياً قبل إثبات فجوة بيانات دائمة |
| `CommissionRule` | موجود؛ قواعد فعالة زمنياً بنطاق البائع/الفئة وتُدار من Super Admin |
| `CommissionTransaction` | موجود؛ snapshot ثابت لكل عنصر طلب عند نجاح الدفع الموثق، مع unique على orderItemId |
| `PayoutMethod` | غير موجود؛ لا تنشئه تلقائياً قبل إثبات فجوة بيانات دائمة |
| `Payout` | غير موجود؛ لا تنشئه تلقائياً قبل إثبات فجوة بيانات دائمة |
| `Payment` | موجود؛ أعد استخدامه وافحص العلاقات والقيود والمستهلكين |
| `Refund` | موجود؛ طلب استرداد يدوي مرتبط بطلب الدفع والمرتجع، مع RefundItem allocations وإتمام يدوي موثق |
| `Currency` | موجود؛ أعد استخدامه وافحص العلاقات والقيود والمستهلكين |
- قبل أي تعديل، افحص `prisma/schema.prisma` وكل migrations و`PRISMA_MODEL_USAGE_MAP.md` والخدمات والـAPI المستهلكة.
- لا تنشئ model لكل صفحة/زر. أضف نموذجاً فقط لحقيقة دائمة/علاقة/سجل حركة لها lifecycle مستقل غير ممثل حالياً.
- أي تغيير يجب أن يحدد owner/scope، FK، unique/index/check، onDelete، lifecycle، concurrency، transaction، migration SQL، consumers والاختبارات.
- الأموال تستخدم minor units أو Decimal مع currency وimmutable snapshots، لا float.
- المخزون والطلبات والمدفوعات والأرصدة تتطلب transaction وidempotency وconcurrency guard وسجل حركة غير قابل للمحو.
- لا تعدل migration مطبقة؛ أنشئ migration لاحقة عند الحاجة المؤكدة فقط.

## 7. التكامل مع الأنظمة الأخرى
- حدد upstream dependencies التي يجب أن تسبق هذا النظام، وdownstream consumers التي تعتمد على نتائجه.
- لكل تكامل سجل owner، command/query/event contract، payload، permission، retry/backoff، idempotency، ordering، failure recovery وreconciliation.
- امنع نظامين من امتلاك نفس الحالة أو كتابة نفس الحقيقة.
- لا تستدعِ قاعدة بيانات نظام آخر مباشرة؛ استخدم service contract أو outbox/event.
- اختبر تكامل كل dependency مباشر مرة واحدة على الأقل، بما يشمل تكرار الحدث وفشل المستهلك وعزل بيانات المتاجر/المستخدمين.

## 8. الاختبارات الحاسمة
| الأولوية | الاختبار | معيار النجاح |
|---|---|---|
| P0 | زر حقيقي → API → service → PostgreSQL → response → UI refresh | القيمة محفوظة وتظهر بعد refresh |
| P0 | مستخدم غير مصرح أو بائع/مستخدم آخر يحاول الوصول | 401/403/404 ولا تغيير في DB |
| P0 | مدخل غير صالح/مورد مفقود/انتقال حالة غير مسموح | 400/404/409 بلا كتابة جزئية |
| P0 | double-click/retry/concurrent request | لا duplicate ولا double charge/reservation/write |
| P0 | فشل DB أو dependency أثناء العملية | rollback أو recovery state؛ لا نجاح كاذب |
| P1 | contract لكل نظام تابع مباشر | نتيجة صحيحة مرة واحدة وبالحالة المتوقعة |
| P1 | حالات UI والتنقل | loading/empty/error/success/forbidden واضحة ولا زر ميت |
| P1 | smoke routes وAPI | لا 404 غير مقصود ولا تسرب عبر الصلاحيات |

اختبارات الوحدة لقواعد المجال الحرجة، integration مع PostgreSQL للقيود والمعاملات، وE2E لرحلة ممثلة لكل دور حرج. لا تضف اختبارات شكلية لا تزيد الثقة.

## 9. شروط الإغلاق
- [ ] جميع الصفحات في موضعها الصحيح، دون تكرار، مع جمهور وصلاحية واضحين.
- [ ] كل زر متتبع إلى handler وAPI وخدمة وPrisma ونتيجة مرئية؛ غير الجاهز disabled بوضوح.
- [ ] server-side authorization + ownership + scope + state transition.
- [ ] مراجعة إعادة استخدام Prisma؛ migration فقط عند وجود فجوة حقيقية.
- [ ] معاملات وتكرار وتزامن محمية بحسب طبيعة العملية.
- [ ] نجاح P0/P1 ذات الصلة مع أوامر ونتائج وcommit evidence.
- [ ] تكاملات الأنظمة التابعة المباشرة ناجحة.
- [ ] تحديث route registry وjourney matrix وmodel map وBUILD_LOG.
- [ ] الحالة: Target / Present / Wired / Verified / Launch-ready.

## 10. نتيجة تدقيق المصدر عند baseline
- صفحات الهدف المطابقة اسمياً: **0/3**.
- API المطابق اسمياً: **0/4**.
- نماذج blueprint الموجودة حرفياً في schema: **2/11**.
- هذه أرقام وجود أسماء/ملفات فقط وليست أدلة تشغيل أو ربط أو نجاح DB.
- **الحالة الأولية:** Target / audit required.

## 11. المراجع
`COMPLETE_PLATFORM_SYSTEMS_BLUEPRINT.md` · `GLOBAL_PLATFORM_PAGE_AND_CONTROL_SPEC.md` · `PLATFORM_PAGE_SYSTEM_MAP.md` · `PRISMA_MODEL_USAGE_MAP.md` · `PAGE_ROUTE_REGISTRY.md` · `END_TO_END_JOURNEY_MATRIX.md` · `END_TO_END_JOURNEY_STANDARD.md`


## Seller-facing completed refund visibility (implemented 2026-11-09)

- The seller commission statement now includes completed refund item allocations attributable to the selected store, derived from RefundItem → ReturnItem → OrderItem → VendorOrder.
- Multi-store refunds are attributed by item to the correct store rather than assigning the full order refund to each seller.
- Per-currency all-time refund totals are database-aggregated; the visible detail list is limited to the latest 100 completed allocations. CSV export includes the aggregates and visible detail rows.
- These refund amounts are shown separately and are not currently netted against commissions or represented as seller payout balances. Seller accounting ledger, holds, settlement and withdrawals remain unimplemented.


## Seller financial overview page (implemented in source 2026-11-09)

- Added `/seller/finance` as a read-only, per-store financial overview using the existing `GET /api/seller/stores` and `GET /api/seller/commissions` contracts.
- Shows commission-covered sales, recorded platform commissions, and completed refunds separately, grouped by currency with BigInt-safe formatting.
- Latest commission activity links through to the full statement. The UI explicitly states that these figures are not a payable balance and does not calculate an available-to-withdraw amount.
- No new Prisma model or migration was introduced in the finance overview. The accounting ledger is not connected to payment/refund sources; holds, settlement/reconciliation, payable balances and withdrawals remain unimplemented. Encrypted seller payout-method management was added separately on 2026-11-10.
- Added the route to seller navigation, updated the seller route registry and page inventory, and refreshed the seller shell to the pastel clay palette.
- Runtime, build and browser verification are intentionally deferred until the seller portal build is complete, per the current work instruction.


## Seller finance current-main boundary
- `GET /api/seller/commissions` يقرأ `CommissionTransaction` و`RefundItem` المخصصة للمتجر عبر `ReturnItem → OrderItem → VendorOrder`. الإجماليات مجمعة حسب العملة، والتفاصيل paginated؛ المبالغ المستردة تعرض منفصلة ولا تخصم من مستحقات البائع.
- `/seller/finance` يعيد استخدام هذا المصدر ويعرض بيانات مسجلة فقط. لا يجوز تسمية أي مجموع حالياً «الرصيد المتاح للسحب».
- نجاح الدفع الموثق يسجل commission snapshot، لكنه لا ينشئ seller payable journal. إكمال Refund يغير Refund/Payment status ويسجل التدقيق، لكنه لا ينشئ ledger reversal.
- **قرار عدم التنفيذ المالي المتسرع:** `VendorOrder` يحتوي subtotal/discount/shipping/tax/total، بينما commission base يستبعد الشحن والضريبة. لا توجد سياسة مالية معتمدة تحدد ملكية رسوم الشحن والضرائب، توقيت الاستحقاق، reserve/hold، chargeback/dispute، أو قيد clearing عند capture. لذلك لا يُنشأ رصيد أو journal posting اعتماداً على commission snapshot وحده.
- الخطوة التالية قبل ledger posting: اعتماد chart of accounts وتخصيص كل مكون من VendorOrder، وتحديد seller payable trigger (capture/delivery/return window)، معالجة refund/chargeback، settlement source، وقيود الحسابات السالبة. بعد ذلك يُبنى journal مزدوج immutable مع unique source idempotency وreversal-only correction، ثم صفحة seller balances/payouts.


## 2026-11-09 — Accounting journal foundation (not yet connected to seller payouts)
- Added Prisma models `LedgerAccount`, `JournalEntry`, `JournalLine` and enum `LedgerAccountType`, with currency-specific accounts and optional GLOBAL/SELLER scope metadata.
- Added migration `20261109200000_seller_double_entry_ledger`. It creates the journal tables, foreign keys and indexes; debit/credit lines must be positive on exactly one side. Deferred database constraint triggers enforce at least two lines, equal debit/credit totals, and account currency matching the journal currency at transaction commit.
- Journal entries and lines are database append-only. Corrections must use a separate reversal entry. `postJournalEntry` validates balanced integer minor units, active same-currency accounts, idempotency-key reuse, and exact inverse lines for reversals; it posts all lines in a serializable transaction.
- `listLedgerAccountEntries` provides cursor-paginated immutable account activity. This is a low-level internal primitive only; no seller balance, payout, withdrawal, or API is exposed yet.
- **Intentionally not connected to commission/payment/refund flows:** seller payable recognition timing, shipment/delivery/return-window policy, tax/shipping ownership, chargebacks, clearing accounts and negative-balance handling are not approved. No financial balance is calculated from the new tables until those policies and account mappings are agreed and implemented.
- Required next: define chart-of-accounts codes and currency bootstrap; approve the marketplace accounting policy; then add source-specific journal posting for captured payment, seller payable release, refunds and chargebacks with idempotent source keys and immutable reversals. Only after that build seller statements and payout methods/requests.


## 2026-11-10 — Encrypted seller payout methods (merged to main)
- Added `SellerPayoutMethod` and enums `SellerPayoutMethodType` / `SellerPayoutMethodStatus`, with a forward migration. IBAN identifiers, account-holder name and optional routing code are encrypted using AES-256-GCM and a versioned key ring; the database stores a protected placeholder for the holder name and only masked account suffixes for display.
- Added owner-only `GET/POST /api/seller/payout-methods` and `PATCH/DELETE /api/seller/payout-methods/[methodId]`, plus `/seller/payouts`. Defaults are scoped per seller and currency. Mutations are audited without recording account identifiers or routing data.
- IBAN validation checks supported country-specific lengths, checksum and selected country prefix. Local bank-account entry remains disabled until country-specific account/routing validation is implemented.
- Every newly saved method is `PENDING_VERIFICATION`. There is no seller self-verification endpoint or automated bank-ownership provider check. A separate manual administrator review is now available (see 2026-11-12 below); a saved default is not verified until that review succeeds. Payout request, transfer execution and withdrawal APIs remain unimplemented.
- Verification on the merged PR: PostgreSQL integration, CodeQL and Browser E2E passed. The repository's broad CI still reports the same 17 unrelated baseline failures already present on the immediately preceding main commit; the new payout tests passed in that run.
- **Financial gate unchanged:** no payable or withdrawable balance may be calculated from commission snapshots. Do not connect the ledger or expose withdrawals until the marketplace accounting policy and per-currency chart of accounts are approved and source-event posting/reversal/reconciliation paths are implemented.


## 2026-11-12 — Manual administrator review of seller payout destinations

- Added `/admin/seller-payout-methods` with `GET /api/admin/seller-payout-methods` and `POST /api/admin/seller-payout-methods/[methodId]/review`.
- Access requires the global `platform:manage` grant and a fresh ten-minute TOTP step-up. The reviewer cannot verify a destination belonging to their own seller profile.
- The queue returns only masked destination data (bank name, type, last four, country/currency, seller identity and submission version); encrypted account identifiers are never exposed to the admin response.
- Verify/reject decisions require a non-empty external evidence reference and reason. The UI explicitly states that an administrator must complete the check with the bank or approved provider outside Matjar; this workflow does not contact a bank or move money.
- Added `SellerPayoutMethod.submissionVersion` with migration `20261112090000_seller_payout_submission_version`. Re-registering a disabled destination increments the generation. The decision command checks the inspected generation and pending state in one conditional database write; audit is written only after that guard succeeds. Stale or concurrent decisions return conflict.
- Verification on exact PR head `401cb342d034dd8ad27576dde053ce3454891b7d`: general CI, PostgreSQL integration, Browser E2E (13/13) and CodeQL passed.
- **Financial boundary unchanged:** commission snapshots are not seller payables. There is still no approved payable-balance calculation, withdrawal request, transfer execution, payout provider, or settlement/reconciliation. Do not show a withdrawable balance.


## 2026-11-12 — Review queue generation and submission timestamp refinements

- Queue pagination no longer rejects page 1001 when the reported result set has 50,001 or more records; the page bound preserves safe integer offsets.
- Evidence/reason drafts are keyed by both payout-method ID and `submissionVersion`, including session-storage restoration. Re-registering a destination cannot inherit the evidence draft from an earlier generation.
- Post-review refresh uses status/page refs synchronously updated by tab and pagination controls, so it reads the current selection even if the administrator changes filters while a decision is pending.
- Added `submittedAt` to `SellerPayoutMethod`. New and re-registered submissions set a fresh timestamp; the queue sorts and labels by this field while `createdAt` continues to represent original row creation. Migration: `20261112093000_seller_payout_submission_timestamp`.
- Latest refinements are awaiting exact-head CI, PostgreSQL integration, Browser E2E and CodeQL.
