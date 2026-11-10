# النظام 29: Payment administration

> مواصفة تنفيذ مستقلة مستخرجة من المخطط الوظيفي. لا تعني وجود التنفيذ أو اكتماله.

## 1. الغرض والحدود
- **الغرض:** Monitor provider transactions, attempts, refunds, reconciliation and payment failures.
- **المتطلبات الأساسية:** verified provider events, idempotent updates, attempt history, refund controls and settlement matching.
- **الحالة السابقة الموثقة:** غير محدد في المخطط الأساسي ويجب حسمه قبل التنفيذ.
- **مالك المجال:** يحدد من خريطة الأنظمة؛ واجهات الإدارة تراقب وتضبط السياسة، وخدمة المجال هنا وحدها تملك قواعد الانتقال والكتابة.
- **داخل النطاق:** دورة حياة البيانات والعمليات والصفحات وواجهات API الخاصة بهذا النظام.
- **خارج النطاق:** وظائف الأنظمة الأخرى؛ تُستهلك عبر عقود وخدمات موثقة ولا يعاد بناء منطقها أو جداولها.
- **قاعدة عدم التداخل:** مصدر واحد لكل حقيقة تجارية، ومالك واحد لكل state transition، وعدم إنشاء صفحة أو جدول مكرر لمجرد وجود زر جديد.

## 2. الصفحات ومكانها
**صفحات الهدف:** `/admin/payments`, payment detail, provider health and reconciliation queue.

| Route الهدف | ملف الصفحة في المصدر عند baseline |
|---|---|
| `/admin/payments` | غير موجود بالمسار المتوقع؛ افحص route registry لاحتمال مسار بديل |
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
**واجهات API المستهدفة:** `/api/admin/payments`, `/api/admin/payments/[id]`, `/api/admin/payment-reconciliation`.

| API | route.ts في baseline |
|---|---|
| `/api/admin/payments` | لم يُعثر على ملف مطابق؛ راجع مسار API البديل قبل الإضافة |
| `/api/admin/payments/[id]` | لم يُعثر على ملف مطابق؛ راجع مسار API البديل قبل الإضافة |
| `/api/admin/payment-reconciliation` | لم يُعثر على ملف مطابق؛ راجع مسار API البديل قبل الإضافة |
- افحص handler → Zod → permission guard → domain service → repository → Prisma → response.
- استخرج user/seller/store/actor من الجلسة والعضوية server-side؛ لا تثق بمعرفات scope القادمة من العميل.
- أخطاء مستقرة: 400/401/403/404/409/422/429/500 دون تسريب أسرار أو معلومات موارد خاصة.
- لا تعتبر route موجوداً إذا كان stub أو fixture أو static response.

## 6. Prisma ومصدر الحقيقة
**النماذج المقترحة في blueprint:** `Payment`, `PaymentWebhookEvent`, plus future `Refund`, `Dispute`, `PaymentAttempt`, `PaymentReconciliation`, and `AuditLog`.

| Prisma model | وضعه في schema الحالية | القرار |
|---|---|---|
| `Payment` | موجود؛ أعد استخدامه وافحص العلاقات والقيود والمستهلكين |
| `PaymentWebhookEvent` | موجود؛ أعد استخدامه وافحص العلاقات والقيود والمستهلكين |
| `Refund` | غير موجود؛ لا تنشئه تلقائياً قبل إثبات فجوة بيانات دائمة |
| `Dispute` | غير موجود؛ لا تنشئه تلقائياً قبل إثبات فجوة بيانات دائمة |
| `PaymentAttempt` | غير موجود؛ لا تنشئه تلقائياً قبل إثبات فجوة بيانات دائمة |
| `PaymentReconciliation` | غير موجود؛ لا تنشئه تلقائياً قبل إثبات فجوة بيانات دائمة |
| `AuditLog` | موجود؛ أعد استخدامه وافحص العلاقات والقيود والمستهلكين |
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
- نماذج blueprint الموجودة حرفياً في schema: **3/7**.
- هذه أرقام وجود أسماء/ملفات فقط وليست أدلة تشغيل أو ربط أو نجاح DB.
- **الحالة الأولية:** Target / audit required.

## 11. المراجع
`COMPLETE_PLATFORM_SYSTEMS_BLUEPRINT.md` · `GLOBAL_PLATFORM_PAGE_AND_CONTROL_SPEC.md` · `PLATFORM_PAGE_SYSTEM_MAP.md` · `PRISMA_MODEL_USAGE_MAP.md` · `PAGE_ROUTE_REGISTRY.md` · `END_TO_END_JOURNEY_MATRIX.md` · `END_TO_END_JOURNEY_STANDARD.md`


## 12. إدارة مزودي الدفع من لوحة التحكم

تمت إضافة مواصفة تنفيذ مركز التحكم في `docs/architecture/PAYMENT_PROVIDER_CONTROL_CENTER.md`. وهي تحدد دورة حياة المزود، الإيقاف دون تعطيل Webhooks للمدفوعات الجارية، الأرشفة بدلاً من الحذف الفعلي، تشفير الأسرار وإصدارات المفاتيح، صلاحية Super Admin وMFA، سجل التدقيق، وإظهار وسائل الدفع حسب السوق والعملة.

هذه مواصفة وخطة تنفيذ وليست ادعاءً بوجود واجهة أو API أو نموذج Prisma جاهز. خط الأساس الحالي: Stripe adapter مربوط بمتغيرات البيئة؛ `Payment` و`PaymentWebhookEvent` موجودان؛ لا يوجد نموذج إعدادات مزودي دفع دائم ولا API لإدارتها. يجب تنفيذ متطلبات التشفير والتفويض قبل حفظ أي بيانات اعتماد في قاعدة البيانات.


## 12.1 — PayPal provider adapter added to the canonical payment lifecycle

- The adapter is registered as `paypal` only when all server-only PayPal credentials and the webhook ID are configured.
- Buyer approval is hosted by PayPal. The server creates the PayPal order from the canonical persisted order total and currency; client-submitted prices, plans, and email addresses are not accepted.
- PayPal approval returns to a server route that captures the order. The shared payment lifecycle checks provider reference, amount, currency, event ordering and idempotency before confirming the Matjar order.
- The shared webhook route verifies PayPal's signature using PayPal's verification API before processing capture events.
- No Prisma schema or migration change was required; the existing `Payment`, `PaymentWebhookEvent` and payment lifecycle service are reused.
- Current activation is environment-based. The Super Admin provider management UI/configuration model remains a separate incomplete deliverable.
- Sandbox/live credentials, PayPal merchant-account eligibility, supported currencies/markets and live payment smoke tests remain owner-controlled prerequisites.


## Provider configuration management — first implementation tranche

- Added `PaymentProviderConfig` with TEST/LIVE environment and DRAFT/CONFIGURED/ACTIVE/DISABLED/ARCHIVED lifecycle, encrypted credentials, market/currency/method allowlists, ordering, verification metadata and archive timestamp.
- Added the Super Admin-only management page and API. Writes require both `platform:manage` and `payment.providers.manage`, use the existing MFA step-up gate, and record non-secret AuditLog metadata.
- Added AES-256-GCM vault encryption driven by a separate 32-byte runtime key; raw credentials and ciphertext are never returned to the browser.
- Added credential validation and non-charge connection checks for Stripe and PayPal, and safe archival checks against active payments and unprocessed provider events.
- Runtime integration is intentionally not yet complete: the checkout registry still uses environment variables. The page displays this boundary so a database ACTIVE flag is not misrepresented as an active checkout route. The provider runtime binding is now implemented: each new Payment is linked to its provider configuration/environment and retains an encrypted credential snapshot for historical webhook and PayPal return verification. The remaining owner-side steps are migration application and sandbox/live verification.


## `/admin/payment-providers` — provider configuration manager (tranche 1)

- Super Admin page and APIs: `GET/POST /api/admin/payment-providers`, `PATCH/DELETE /api/admin/payment-providers/[id]`, verify/enable/disable actions.
- Prisma: `PaymentProviderConfig`, `PaymentProviderEnvironment`, `PaymentProviderConfigStatus`; migration `20261110120000_payment_provider_control_center`.
- Secret vault: AES-256-GCM using independent `PAYMENT_PROVIDER_ENCRYPTION_KEY`; secrets/ciphertext never leave server responses.
- Authorization: `platform:manage` with MFA step-up plus dedicated `payment.providers.manage`; sensitive changes are audited.
- Status: configuration CRUD, verification, administrative lifecycle and database-driven checkout binding are implemented in source. Migration application and end-to-end sandbox/live verification remain pending.


## ربط إعدادات المزود بمحرك الدفع — المرحلة الثانية

- اختيار مزود الدفع الجديد يعتمد على سجل قاعدة البيانات النشط في بيئة TEST أو LIVE، مع التحقق من العملة والدولة. وجود سجل مُدار معطّل يمنع الرجوع الصامت إلى مفاتيح البيئة لإنشاء مدفوعات جديدة.
- يرتبط كل Payment جديد بإعداد المزود ويحفظ نسخة مشفرة من بيانات الاعتماد وإصدار المفتاح المستخدم؛ تحديث بيانات المزود لا يغيّر نسخة المدفوعات السابقة.
- إشعارات Stripe وPayPal تستخدم نسخة بيانات الاعتماد المحفوظة للدفع المعني. كما يستخدم مسار عودة PayPal النسخة نفسها عند تنفيذ capture. المدفوعات القديمة التي لا تملك نسخة محفوظة تستخدم مسار متغيرات البيئة القديم.
- تعطيل المزود يمنع بدء محاولات جديدة، لكنه لا يلغي التحقق من إشعارات محاولات قائمة ذات نسخة محفوظة.
- المتبقي: دعم تدوير مفتاح التشفير الرئيسي بأكثر من إصدار (المتاح حالياً الإصدار 1 فقط)، إنفاذ اختيار طريقة الدفع داخل كل مزود، تطبيق migrations على قاعدة بيانات المستخدم، ثم إجراء رحلة sandbox حقيقية والتحقق من الإشعارات دون تنفيذ أي عملية إنتاجية قبل موافقة صاحب الحساب.
- لم تُشغّل الاختبارات أو build أو typecheck في هذه المرحلة التزاماً بتأجيلها.


- Key management: versioned AES-256-GCM key ring, backward-compatible v1 setting, active-version writes, and MFA-protected audited batch re-encryption of provider credentials plus historical payment snapshots. Old keys must remain configured until re-encryption reports zero remaining rows.

- Additional hardening: database CHECK constraint for complete-or-empty payment snapshots; malformed snapshot detection before key rotation; bounded resumable key rotation (100 rows per model per request); provider method allowlist validation; market-filtered no-store provider discovery; PayPal capture-to-payment identity checks.

- Refund boundary: provider refunds are not issued automatically yet. Refund records remain pending manual confirmation; finance enters the external provider transaction reference and confirms completion before the platform updates payment/order accounting. No browser callback can mark a refund complete.


## 13. الحالة الحالية المؤكدة — 2026-11-10

هذا القسم أحدث من ملاحظات الـbaseline التاريخية أعلاه، ويُعتمد عند وجود تعارض معها.

### PayPal وStripe
- مصدر PayPal الأصلي الذي تمت مراجعته هو `waelkamira/cartoon`. لم تُنقل شيفرته القديمة كما هي؛ أُعيد تنفيذ الدفع على خادم Matjar باستخدام Orders v2، وإنشاء الطلب من مبلغ الطلب المحفوظ، والتحقق من ارتباط PayPal order بمعرّف Payment قبل capture.
- PayPal adapter موجود في `src/server/payments/providers/paypal.ts`، وعودة الموافقة في `src/app/api/payments/paypal/return/route.ts`، والتحقق من Webhook في `src/app/api/webhooks/payments/[provider]/route.ts`.
- إعدادات مزودي الدفع موجودة في `/admin/payment-providers`، مع TEST/LIVE، قائمة سماح الدول والعملات وطرق الدفع، صلاحية Super Admin وMFA، وتسجيل تدقيقي.
- الدفع المدار من قاعدة البيانات مرتبط بإنشاء Payment؛ كل دفعة جديدة تحفظ provider config/environment ونسخة مشفرة مستقلة من بيانات الاعتماد لا تتغير عند تعديل إعداد المزود لاحقاً.
- لا تستخدم بيانات اعتماد Cartoon القديمة. أي سر سبق نشره في مستودع عام/مشترك يجب اعتباره مكشوفاً وتدويره لدى مزوده.

### التشفير وتدوير المفاتيح
- تدوير المفاتيح متعدد الإصدارات **منفذ في المصدر** وليس مهمة برمجية متبقية: `PAYMENT_PROVIDER_ENCRYPTION_KEYS` و`PAYMENT_PROVIDER_ENCRYPTION_KEY_VERSION`، مع توافق قراءة مفتاح الإصدار الأول.
- مسار `POST /api/admin/payment-providers/rotate-credentials` يتطلب صلاحية Super Admin وMFA، ويعيد تشفير إعدادات المزود ولقطات بيانات الاعتماد التاريخية على دفعات قابلة للاستئناف، ويسجل النتيجة في AuditLog.
- لا تحذف مفتاحاً قديماً قبل أن تكون أعداد السجلات المتبقية صفراً وبعد تأكيد خطة النسخ الاحتياطي والاستعادة.

### الاسترداد والمحاسبة
- استرداد Matjar الحالي **يدوي مؤكد من قسم المالية**: لا يستدعي Stripe أو PayPal لإرسال refund تلقائياً. ينشئ طلب استرداد بعد استلام المرتجع فعلياً، ثم يسجل موظف المالية مرجع العملية الخارجية قبل تحويل Refund وPayment إلى الحالة النهائية.
- توجد قيود لمنع الاسترداد المكرر أو تجاوز قيمة الدفع، مع قفل على مستوى الطلب وسجل تدقيق.
- لا توجد حتى الآن واجهة تنفيذ refund آلي عبر API المزود، ولا تسوية آلية لعمليات الاسترداد مع Webhooks، ولا ربط كامل لعكس عمولات البائع/قيود دفتر الأستاذ. لا يجوز وصف هذه الأجزاء بأنها مكتملة.

### ما لم يتم إثباته بعد
- Migration `20261110120000_payment_provider_control_center` موجودة في GitHub، لكن تطبيقها على قاعدة بيانات التشغيل لم يتم إثباته من المستودع.
- لا توجد أدلة في هذه المراجعة على نجاح رحلة PayPal Sandbox فعلية، أو وصول Webhook حقيقي، أو نجاح build/typecheck/tests بعد هذه التغييرات.
- لا تُفعّل LIVE ولا تنفذ أي عملية مالية حقيقية قبل تطبيق migration، وإعداد مفاتيح الخادم وWebhook sandbox، ثم نجاح تحقق Sandbox بموافقة صاحب الحساب.

### الخطوة التنفيذية التالية
1. على بيئة Matjar المحلية: `npx prisma migrate deploy`.
2. ثم: `npx prisma generate` (أغلق عمليات Node/Next التي قد تقفل ملفات Prisma على Windows إذا ظهر EPERM).
3. إعداد مفتاح vault مستقل 32-byte hex خارج Git وPostgreSQL backups، وإدخال بيانات PayPal Sandbox وWebhook من لوحة Super Admin.
4. تنفيذ رحلة Sandbox كاملة: إنشاء الطلب، موافقة المشتري، capture من الخادم، Webhook مكرر، والتحقق من أن الطلب والدفع لا يتكرران.
5. بعد ذلك فقط، بدء حزمة مستقلة لرد الأموال عبر المزود وربطها بقيود المحاسبة والتسوية، مع idempotency ومراجعة مالية مزدوجة.


## 14. Provider refund execution — implementation tranche

The earlier manual-only boundary above is historical. The current source now supports explicit finance-authorized provider refunds for Stripe and PayPal:

- The finance page can submit a refund to the same provider that captured the original payment. Provider credentials are resolved from the immutable encrypted payment snapshot; a managed payment without its snapshot is blocked. Legacy payments use their existing server-side environment configuration.
- Stripe resolves the original Checkout Session to its paid PaymentIntent and creates a partial/full refund using a stable idempotency key. PayPal resolves the exact Matjar Orders v2 order to its completed capture and submits a capture refund with a stable PayPal request ID.
- The refund state machine now includes PENDING_MANUAL, PROCESSING_PROVIDER, PROVIDER_FAILED, and COMPLETED. Provider pending responses are persisted with the provider refund reference and can be refreshed against the provider's canonical refund resource.
- A network interruption before the provider reference is persisted can be resumed with the same deterministic idempotency key. A provider-failed/ambiguous result is not silently marked complete; finance must reconcile it or use the manual external-reference confirmation after checking the provider dashboard.
- Only a provider-confirmed completed response changes the Refund to COMPLETED and updates Payment to PARTIALLY_REFUNDED or REFUNDED. Provider calls occur outside the PostgreSQL transaction; claim/reservation, payment caps, finalization, audit records and idempotency guards are database-enforced.
- API: POST /api/admin/refunds/[refundId] with action=execute or action=refresh; existing PATCH remains for externally completed manual refunds.
- Migration: 20261110130000_provider_refund_execution adds the provider processing/failure states to RefundStatus.
- Remaining external verification: apply migrations, run Stripe/PayPal Sandbox refunds including duplicate/retry/pending cases, and verify the resulting PostgreSQL state. No live refund or production credential was used in this implementation session.

- Dual control: the finance operator who creates the refund request cannot execute the provider refund or confirm the external refund. A different account with `payments:refund` must perform the money-moving confirmation. This implements independent-operator approval; MFA step-up, configurable amount limits and policy-based escalation remain separate launch controls.

- Provider retry retention: the first submission timestamp is stored. Automatic retry is blocked after a conservative 23-hour Stripe window and 44-day PayPal window; after expiry finance must reconcile the provider dashboard manually. This prevents replaying a deterministic key after the provider may have pruned it.

- Retry attempts: Refund.providerAttempt increments only after the provider's canonical refund resource confirms a failed attempt; ambiguous requests retry only with the same idempotency key and within the persisted retention window. A returned provider reference is always refreshed before a new attempt is permitted.
