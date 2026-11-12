# النظام 31: Accounting and general ledger

> مواصفة تنفيذ مستقلة مستخرجة من المخطط الوظيفي. لا تعني وجود التنفيذ أو اكتماله.

## 1. الغرض والحدود
- **الغرض:** Double-entry accounting for sales, fees, taxes, refunds, chargebacks and payouts.
- **المتطلبات الأساسية:** balanced journal entries, immutable posted records, reversals instead of destructive edits, period close and audit.
- **الحالة الحالية (2026-11-12):** أساس قيود مزدوجة immutable موجود، وخدمة ترحيل داخلية، وصفحة/API قراءة فقط لدليل الحسابات وحركة الحساب. لا يوجد ربط بمدفوعات السوق أو الاستردادات أو مستحقات البائع أو التسوية والسحب.
- **مالك المجال:** يحدد من خريطة الأنظمة؛ واجهات الإدارة تراقب وتضبط السياسة، وخدمة المجال هنا وحدها تملك قواعد الانتقال والكتابة.
- **داخل النطاق:** دورة حياة البيانات والعمليات والصفحات وواجهات API الخاصة بهذا النظام.
- **خارج النطاق:** وظائف الأنظمة الأخرى؛ تُستهلك عبر عقود وخدمات موثقة ولا يعاد بناء منطقها أو جداولها.
- **قاعدة عدم التداخل:** مصدر واحد لكل حقيقة تجارية، ومالك واحد لكل state transition، وعدم إنشاء صفحة أو جدول مكرر لمجرد وجود زر جديد.

## 2. الصفحات ومكانها
**صفحات الهدف:** `/admin/finance/ledger`, accounts, journals, trial balance and reconciliation.

| Route الهدف | ملف الصفحة في المصدر عند baseline |
|---|---|
| `/admin/finance/ledger` | `src/app/admin/finance/ledger/page.tsx`؛ صفحة قراءة فقط مع اختيار الحساب وفلاتر العملة/النوع/الحالة وتحميل حركة الحساب على دفعات |
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
**واجهات API المستهدفة:** `/api/admin/finance/accounts`, `/api/admin/finance/journals`, `/api/admin/finance/reports`.

| API | route.ts في baseline |
|---|---|
| `GET /api/admin/finance/ledger` | موجود؛ يتطلب `platform:manage` مع MFA/step-up، ويعرض الحسابات وحركة الحساب المحدد فقط؛ لا توجد عمليات كتابة أو تقارير أرصدة |
- افحص handler → Zod → permission guard → domain service → repository → Prisma → response.
- استخرج user/seller/store/actor من الجلسة والعضوية server-side؛ لا تثق بمعرفات scope القادمة من العميل.
- أخطاء مستقرة: 400/401/403/404/409/422/429/500 دون تسريب أسرار أو معلومات موارد خاصة.
- لا تعتبر route موجوداً إذا كان stub أو fixture أو static response.

## 6. Prisma ومصدر الحقيقة
**النماذج المقترحة في blueprint:** `LedgerAccount`, `JournalEntry`, `JournalLine`, `SellerLedgerEntry`, `CommissionTransaction`, `Payment`, `Refund`, `Payout`.

| Prisma model | وضعه في schema الحالية | القرار |
|---|---|---|
| `LedgerAccount` | موجود؛ حساب محدد بعملة ونوع ونطاق GLOBAL/SELLER وحالة active |
| `JournalEntry` | موجود؛ رأس قيد immutable مع مصدر ومرجع idempotency وعملة ووقت وقوع ومرجع عكس اختياري |
| `JournalLine` | موجود؛ debit/credit بوحدات minor مع تحقق توازن القيد وتوافق عملة الحساب |
| `SellerLedgerEntry` | غير موجود؛ لا يُنشأ قبل اعتماد تعريف مستحق البائع وربطه بدفتر الأستاذ |
| `CommissionTransaction` | موجود؛ snapshot عمولة ثابت لكل OrderItem بعد نجاح الدفع |
| `Payment` | موجود؛ حالة الدفع ومرجع مزود الدفع؛ لم يُربط بترحيل دفتر الأستاذ |
| `Refund` | موجود؛ دورة استرداد للمزود مع RefundItem allocations؛ لم يُربط بعكس محاسبي |
| `Payout` | غير موجود؛ لا يُنشأ قبل اعتماد سياسات المستحق والتسوية والسحب |
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

## 10. نتيجة التدقيق الحالية
- أساس دفتر الأستاذ: موجود؛ `postJournalEntry` يتحقق من توازن القيد ووحدة العملة، ويقارن كامل محتوى القيد عند إعادة idempotency key، ويتحقق من العكس المطابق تماماً.
- حماية قاعدة البيانات: migration `20261112130000_journal_append_only_integrity` تمنع إضافة JournalLine بعد معاملة إنشاء القيد، وتفرض التوازن والحسابات النشطة وتوافق العملة، وتحمي هوية الحساب بعد استخدامه.
- واجهة الإدارة: صفحة `/admin/finance/ledger` و`GET /api/admin/finance/ledger` للقراءة فقط، محمية بصلاحية `platform:manage` وMFA/step-up.
- حدود التنفيذ: لا يوجد chart-of-accounts bootstrap معتمد، ولا payment/refund posting، ولا seller payable أو balances أو holds أو reconciliation أو payout execution.
- أدلة سابقة: رحلة قراءة دفتر الأستاذ وCI/E2E موثقة على commits محددة في هذا الملف أدناه. تغييرات hardening الأحدث يجب إعادة التحقق منها على HEAD قبل اعتبارها ناجحة.
- **الحالة:** Internal posting foundation + read-only admin inspection / financial lifecycle incomplete.

## 11. المراجع
`COMPLETE_PLATFORM_SYSTEMS_BLUEPRINT.md` · `GLOBAL_PLATFORM_PAGE_AND_CONTROL_SPEC.md` · `PLATFORM_PAGE_SYSTEM_MAP.md` · `PRISMA_MODEL_USAGE_MAP.md` · `PAGE_ROUTE_REGISTRY.md` · `END_TO_END_JOURNEY_MATRIX.md` · `END_TO_END_JOURNEY_STANDARD.md`


## 2026-11-10 — Provider refund boundary update
- Stripe and PayPal provider refund execution is now present in System 29 and the `/admin/refunds` route. It is not yet connected to the general ledger.
- The existing immutable double-entry journal is a posting primitive, not an approved marketplace chart of accounts. No payment-capture journal exists, and account ownership for seller payable, processor clearing, tax, shipping, reserves/holds, and return/refund allocation is not approved.
- Do not invent debit/credit account mappings or label refunds as financially reconciled. Ledger posting remains blocked until finance policy and per-currency account mappings are approved; after approval, refund postings must be idempotent and use immutable reversals.


## 2026-11-12 — Journal posting integrity hardening

- Current main includes the internal posting service `src/server/finance/ledger.ts` and
  cursor-paginated account activity. This is a foundation, not an exposed admin ledger.
- Idempotency retries now compare the complete immutable journal payload: source type/id,
  currency, description, occurrence timestamp, reversal reference and canonical lines.
  Reusing a key with any changed value is rejected.
- Migration `20261112130000_journal_append_only_integrity` adds a database-generated
  `JournalEntry.createdTransactionId`. A BEFORE INSERT trigger rejects JournalLine inserts
  outside the transaction that created the parent journal. The deferred integrity trigger
  also rejects inactive accounts, unbalanced lines and currency mismatches.
- Added focused unit coverage in `tests/finance/ledger.test.ts` and PostgreSQL coverage in
  `tests/integration/ledger-postgres.integration.test.ts` for post-commit line append and
  inactive-account bypass attempts and used-account identity rewrites.
- **Not verified yet:** Prisma validation/client generation, TypeScript, Vitest, migration
  replay and disposable PostgreSQL integration. No payment, refund, seller payable,
  reserve, settlement or payout workflow is connected. No admin ledger page/API exists.


## 13. تدقيق أساس الاسترداد بعد الخصومات — 2026-11-12

- خدمة `src/server/payments/refunds.ts` تستخدم الآن نفس `allocateDiscountAcrossLines` التي يعتمدها إنشاء لقطة العمولة، وبذلك يصبح أساس استرداد البضاعة لكل صنف هو قيمة الصنف بعد حصته الفعلية من خصم البائع/القسيمة.
- قبل التصحيح كان مبلغ الاسترداد يُحسب من `OrderItem.lineTotalMinor` قبل الخصم، بينما العمولة تُحسب من القيمة الصافية بعد الخصم. التصحيح يمنع تضخيم قيمة استرداد البضاعة في الطلبات المخفضة، ويتحقق أيضاً من تطابق مجموع قيم الأصناف مع `VendorOrder.subtotalMinor` قبل التوزيع.
- التقسيم الجزئي يحافظ على المبالغ بوحدات minor، ويُسند الباقي الحسابي إلى آخر كمية مستردة حتى لا تتجاوز المبالغ المتراكمة الأساس الصافي للصنف. تبقى قيود الكمية، ومبالغ الاسترداد المحجوزة/المكتملة، وحد إجمالي الدفعة مطبقة.
- أضيفت تغطية مركزة لحالة خصم 300 من 3,000 على وحدتين: استرداد وحدة واحدة يساوي 1,350، مع اختبارات لتوزيع الخصم الكامل ورفض الخصم خارج إجمالي البضاعة والقيم السالبة.
- هذا التصحيح يخص قيمة البضاعة فقط. لا يقرر رد الشحن أو الضريبة، ولا يوزع خسارة الاسترداد/العمولة على المنصة والبائع، ولا ينشئ قيود عكسية. تبقى هذه الأمور مرتبطة باعتماد FIN-01..FIN-12 وخريطة الحسابات لكل عملة.
- التغييرات موجودة على main في commits: `6b855a5`, `ebcd34c`, `b5c9544`, `3035295`, `c2ab107`. لم تُشغّل الاختبارات أو migrations أو PostgreSQL على هذا الـHEAD في هذه الجلسة؛ لا تعتبر هذه التغطية نجاح CI.

## 12. تنفيذ دفتر الأستاذ للقراءة فقط — 2026-11-12

الحالة الحالية تتجاوز وصف baseline القديم أعلاه في أساس القيود المحاسبية وواجهة الاستعراض:

- src/server/finance/ledger.ts يوفّر postJournalEntry بقيد مزدوج متوازن، مبالغ بوحدات العملة الصغرى، idempotency كامل للبيانات الثابتة، عكس دقيق، وحسابات نشطة متوافقة العملة. كما يوفر listLedgerAccounts وlistLedgerAccountEntries للقراءة.
- Migration 20261112130000_journal_append_only_integrity تمنع إضافة أسطر إلى قيد بعد معاملة إنشائه، وتمنع تغيير هوية الحساب بعد استخدامه، وتتحقق من الحسابات النشطة وتوازن القيد وتوافق العملة.
- أضيفت الصفحة /admin/finance/ledger والـAPI GET /api/admin/finance/ledger. كلاهما محمي بـplatform:manage عبر بوابة MFA/step-up. الشاشة تعرض دليل الحسابات وفلاتر البحث والنوع والعملة والحالة، وأسطر القيود للحساب المحدد فقط مع cursor pagination وزر تحميل القيود الأقدم.
- المبالغ المعروضة تستخدم Currency.minorUnit الفعلية. لا تعرض الشاشة رصيداً قابلاً للسحب أو إجماليات دفترية مشتقة، ولا تتيح إنشاء القيود أو تعديلها أو عكسها.
- لا توجد بعد واجهات ميزان مراجعة أو تسوية أو إقفال فترات، ولا ربط تلقائي بالمدفوعات والاستردادات والعمولات ومستحقات البائعين والسحب. لا تنشئ هذه التدفقات أو قواعد الحسابات قبل اعتماد القرارات والسياسات المالية من مالك المنصة.
- على commit bcc70bdcb673e4bdee3ca5f985063a7edbd8558b نجحت CI (Prisma validate/migrate/generate وTypeScript وESLint ومجموعة Vitest الكاملة وproduction build)، وCodeQL، وBrowser E2E بنتيجة 14/14. يتضمن E2E رحلة Super Admin فعلية تفتح الصفحة وتختار E2E-CASH وتقرأ القيد المتوازن المحفوظ وتتحقق من غياب أدوات الترحيل والاسترداد والتحويل. اختبارات API تغطي 401/403/428 والمدخلات غير الصالحة وno-store. اختبار PostgreSQL المخصص لقيود append-only نجح على e81a6efaab6b03a324a0e21aaf256f9a6d28c7c1؛ ولم تتغير schema أو migrations بعده.

## 14. لقطة تصنيف العمولة عند checkout — 2026-11-12

- يقرأ إنشاء الطلب تصنيفات المنتج التي تحمل `isPrimary=true` فقط، ثم يحفظ `commissionCategoryId` و`commissionCategoryName` مباشرة على `OrderItem`.
- يعالج webhook الدفع العمولة اعتماداً على هذه اللقطة المحفوظة، ولا يعيد قراءة تصنيفات المنتج الحالية؛ لذلك تعديل تصنيف المنتج بعد الشراء لا يغير نطاق العمولة التاريخية للطلب.
- تم تثبيت ترتيب اختيار الفئة الأساسية حسب `sortOrder` ثم `categoryId` لتجنب اختيار غير حتمي عند وجود أكثر من سجل أساسي قديم.
- ما زال مطلوباً تدقيق بيانات التصنيفات القديمة وإضافة ضمان قاعدة بيانات يمنع تعدد الفئات الأساسية للمنتج. هذا لا يغيّر أي لقطة طلب سابقة.
- لا تزال لقطة العمولة تقريراً عن العمولة المحسوبة وليست قيداً في دفتر الأستاذ أو التزاماً مالياً مستحقاً للبائع.
