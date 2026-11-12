# النظام 31: Accounting and general ledger

> مواصفة تنفيذ مستقلة مستخرجة من المخطط الوظيفي. لا تعني وجود التنفيذ أو اكتماله.

## 1. الغرض والحدود
- **الغرض:** Double-entry accounting for sales, fees, taxes, refunds, chargebacks and payouts.
- **المتطلبات الأساسية:** balanced journal entries, immutable posted records, reversals instead of destructive edits, period close and audit.
- **الحالة السابقة الموثقة:** **Schema-only.** Accounting models exist; no application delegate workflow was identified.
- **مالك المجال:** يحدد من خريطة الأنظمة؛ واجهات الإدارة تراقب وتضبط السياسة، وخدمة المجال هنا وحدها تملك قواعد الانتقال والكتابة.
- **داخل النطاق:** دورة حياة البيانات والعمليات والصفحات وواجهات API الخاصة بهذا النظام.
- **خارج النطاق:** وظائف الأنظمة الأخرى؛ تُستهلك عبر عقود وخدمات موثقة ولا يعاد بناء منطقها أو جداولها.
- **قاعدة عدم التداخل:** مصدر واحد لكل حقيقة تجارية، ومالك واحد لكل state transition، وعدم إنشاء صفحة أو جدول مكرر لمجرد وجود زر جديد.

## 2. الصفحات ومكانها
**صفحات الهدف:** `/admin/finance/ledger`, accounts, journals, trial balance and reconciliation.

| Route الهدف | ملف الصفحة في المصدر عند baseline |
|---|---|
| `/admin/finance/ledger` | غير موجود بالمسار المتوقع؛ افحص route registry لاحتمال مسار بديل |
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
| `/api/admin/finance/accounts` | لم يُعثر على ملف مطابق؛ راجع مسار API البديل قبل الإضافة |
| `/api/admin/finance/journals` | لم يُعثر على ملف مطابق؛ راجع مسار API البديل قبل الإضافة |
| `/api/admin/finance/reports` | لم يُعثر على ملف مطابق؛ راجع مسار API البديل قبل الإضافة |
- افحص handler → Zod → permission guard → domain service → repository → Prisma → response.
- استخرج user/seller/store/actor من الجلسة والعضوية server-side؛ لا تثق بمعرفات scope القادمة من العميل.
- أخطاء مستقرة: 400/401/403/404/409/422/429/500 دون تسريب أسرار أو معلومات موارد خاصة.
- لا تعتبر route موجوداً إذا كان stub أو fixture أو static response.

## 6. Prisma ومصدر الحقيقة
**النماذج المقترحة في blueprint:** `LedgerAccount`, `JournalEntry`, `JournalLine`, `SellerLedgerEntry`, `CommissionTransaction`, `Payment`, `Refund`, `Payout`.

| Prisma model | وضعه في schema الحالية | القرار |
|---|---|---|
| `LedgerAccount` | غير موجود؛ لا تنشئه تلقائياً قبل إثبات فجوة بيانات دائمة |
| `JournalEntry` | غير موجود؛ لا تنشئه تلقائياً قبل إثبات فجوة بيانات دائمة |
| `JournalLine` | غير موجود؛ لا تنشئه تلقائياً قبل إثبات فجوة بيانات دائمة |
| `SellerLedgerEntry` | غير موجود؛ لا تنشئه تلقائياً قبل إثبات فجوة بيانات دائمة |
| `CommissionTransaction` | غير موجود؛ لا تنشئه تلقائياً قبل إثبات فجوة بيانات دائمة |
| `Payment` | موجود؛ أعد استخدامه وافحص العلاقات والقيود والمستهلكين |
| `Refund` | غير موجود؛ لا تنشئه تلقائياً قبل إثبات فجوة بيانات دائمة |
| `Payout` | غير موجود؛ لا تنشئه تلقائياً قبل إثبات فجوة بيانات دائمة |
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
- صفحات الهدف المطابقة اسمياً: **0/1**.
- API المطابق اسمياً: **0/3**.
- نماذج blueprint الموجودة حرفياً في schema: **1/8**.
- هذه أرقام وجود أسماء/ملفات فقط وليست أدلة تشغيل أو ربط أو نجاح DB.
- **الحالة الأولية:** Target / audit required.

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


## 12. تنفيذ دفتر الأستاذ للقراءة فقط — 2026-11-12

الحالة الحالية تتجاوز وصف baseline القديم أعلاه في أساس القيود المحاسبية وواجهة الاستعراض:

- src/server/finance/ledger.ts يوفّر postJournalEntry بقيد مزدوج متوازن، مبالغ بوحدات العملة الصغرى، idempotency كامل للبيانات الثابتة، عكس دقيق، وحسابات نشطة متوافقة العملة. كما يوفر listLedgerAccounts وlistLedgerAccountEntries للقراءة.
- Migration 20261112130000_journal_append_only_integrity تمنع إضافة أسطر إلى قيد بعد معاملة إنشائه، وتمنع تغيير هوية الحساب بعد استخدامه، وتتحقق من الحسابات النشطة وتوازن القيد وتوافق العملة.
- أضيفت الصفحة /admin/finance/ledger والـAPI GET /api/admin/finance/ledger. كلاهما محمي بـplatform:manage عبر بوابة MFA/step-up. الشاشة تعرض دليل الحسابات وفلاتر البحث والنوع والعملة والحالة، وأسطر القيود للحساب المحدد فقط.
- المبالغ المعروضة تستخدم Currency.minorUnit الفعلية. لا تعرض الشاشة رصيداً قابلاً للسحب أو إجماليات دفترية مشتقة، ولا تتيح إنشاء القيود أو تعديلها أو عكسها.
- لا توجد بعد واجهات ميزان مراجعة أو تسوية أو إقفال فترات، ولا ربط تلقائي بالمدفوعات والاستردادات والعمولات ومستحقات البائعين والسحب. لا تنشئ هذه التدفقات أو قواعد الحسابات قبل اعتماد القرارات والسياسات المالية من مالك المنصة.
- اختبارات PostgreSQL والـmigrations وCodeQL وBrowser E2E نجحت على commits التأسيس السابقة؛ واجهة القراءة الجديدة واختبارات القائمة تحتاج إلى اجتياز CI وE2E على نفس commit النهائي قبل اعتبارها verified.
