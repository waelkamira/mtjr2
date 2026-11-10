# النظام 20: Seller marketing and promotions

> مواصفة تنفيذ مستقلة مستخرجة من المخطط الوظيفي. لا تعني وجود التنفيذ أو اكتماله.

## 1. الغرض والحدود
- **الغرض:** Create store-scoped discounts and promotions within platform policy.
- **المتطلبات الأساسية:** eligibility, date windows, usage limits, stacking rules, budget caps and abuse prevention.
- **الحالة السابقة الموثقة:** **Partial / schema-only.** Admin discounts surface exists; complete seller promotion lifecycle is not proven.
- **مالك المجال:** يحدد من خريطة الأنظمة؛ واجهات الإدارة تراقب وتضبط السياسة، وخدمة المجال هنا وحدها تملك قواعد الانتقال والكتابة.
- **داخل النطاق:** دورة حياة البيانات والعمليات والصفحات وواجهات API الخاصة بهذا النظام.
- **خارج النطاق:** وظائف الأنظمة الأخرى؛ تُستهلك عبر عقود وخدمات موثقة ولا يعاد بناء منطقها أو جداولها.
- **قاعدة عدم التداخل:** مصدر واحد لكل حقيقة تجارية، ومالك واحد لكل state transition، وعدم إنشاء صفحة أو جدول مكرر لمجرد وجود زر جديد.

## 2. الصفحات ومكانها
**صفحات الهدف:** `/seller/marketing`, `/seller/coupons`, promotion editor and performance.

| Route الهدف | ملف الصفحة في المصدر عند baseline |
|---|---|
| `/seller/marketing` | غير موجود بالمسار المتوقع؛ افحص route registry لاحتمال مسار بديل |
| `/seller/coupons` | غير موجود بالمسار المتوقع؛ افحص route registry لاحتمال مسار بديل |
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
**واجهات API المستهدفة:** `/api/seller/promotions`, `/api/seller/coupons`, `/api/seller/promotions/[id]`.

| API | route.ts في baseline |
|---|---|
| `/api/seller/promotions` | لم يُعثر على ملف مطابق؛ راجع مسار API البديل قبل الإضافة |
| `/api/seller/coupons` | لم يُعثر على ملف مطابق؛ راجع مسار API البديل قبل الإضافة |
| `/api/seller/promotions/[id]` | لم يُعثر على ملف مطابق؛ راجع مسار API البديل قبل الإضافة |
- افحص handler → Zod → permission guard → domain service → repository → Prisma → response.
- استخرج user/seller/store/actor من الجلسة والعضوية server-side؛ لا تثق بمعرفات scope القادمة من العميل.
- أخطاء مستقرة: 400/401/403/404/409/422/429/500 دون تسريب أسرار أو معلومات موارد خاصة.
- لا تعتبر route موجوداً إذا كان stub أو fixture أو static response.

## 6. Prisma ومصدر الحقيقة
**النماذج المقترحة في blueprint:** `Promotion`, `Coupon`, `CouponRedemption`, `PromotionProduct`, `PromotionCategory`, `PromotionSeller`, `Store`, `Product`.

| Prisma model | وضعه في schema الحالية | القرار |
|---|---|---|
| `Promotion` | غير موجود؛ لا تنشئه تلقائياً قبل إثبات فجوة بيانات دائمة |
| `Coupon` | غير موجود؛ لا تنشئه تلقائياً قبل إثبات فجوة بيانات دائمة |
| `CouponRedemption` | غير موجود؛ لا تنشئه تلقائياً قبل إثبات فجوة بيانات دائمة |
| `PromotionProduct` | غير موجود؛ لا تنشئه تلقائياً قبل إثبات فجوة بيانات دائمة |
| `PromotionCategory` | غير موجود؛ لا تنشئه تلقائياً قبل إثبات فجوة بيانات دائمة |
| `PromotionSeller` | غير موجود؛ لا تنشئه تلقائياً قبل إثبات فجوة بيانات دائمة |
| `Store` | موجود؛ أعد استخدامه وافحص العلاقات والقيود والمستهلكين |
| `Product` | موجود؛ أعد استخدامه وافحص العلاقات والقيود والمستهلكين |
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
- صفحات الهدف المطابقة اسمياً: **0/2**.
- API المطابق اسمياً: **0/3**.
- نماذج blueprint الموجودة حرفياً في schema: **2/8**.
- هذه أرقام وجود أسماء/ملفات فقط وليست أدلة تشغيل أو ربط أو نجاح DB.
- **الحالة الأولية:** Target / audit required.

## 11. المراجع
`COMPLETE_PLATFORM_SYSTEMS_BLUEPRINT.md` · `GLOBAL_PLATFORM_PAGE_AND_CONTROL_SPEC.md` · `PLATFORM_PAGE_SYSTEM_MAP.md` · `PRISMA_MODEL_USAGE_MAP.md` · `PAGE_ROUTE_REGISTRY.md` · `END_TO_END_JOURNEY_MATRIX.md` · `END_TO_END_JOURNEY_STANDARD.md`


## 12. Recheck against PR #57 branch (2026-11-06)

This is a fresh schema-only recheck of commit `3f81e8153b753206812e8049ada90c5c4428a0e8`; it supersedes the older baseline counts above for current implementation decisions:

| Model | Current schema finding | Meaning for seller marketing |
|---|---|---|
| `Coupon` | Present | A global checkout discount record; it has no `storeId`, seller owner, or seller campaign lifecycle. Do not expose it directly as a seller-owned campaign. |
| `CouponRedemption` | Present | Checkout/order redemption history for Coupon; not an advertising impression/click or campaign attribution record. |
| `Promotion` | Absent | No durable campaign entity currently exists. |
| `PromotionProduct` | Absent | No campaign-to-product relation currently exists. |
| `PromotionCategory` | Absent | No campaign-to-category relation currently exists. |
| `PromotionSeller` | Absent | No platform/seller campaign participation relation currently exists. |

The seller advertising gap therefore remains real. Any implementation must be a distinct, store-scoped advertising domain with explicit lifecycle, moderation and policy checks; the existing global coupon capability must remain separate. This recheck does not claim that any seller advertising routes or UI have been implemented.


## 13. Seller advertising campaign management — implementation added in PR #57

Implemented in PR #57. Exact-head CI and PostgreSQL integration passed on `f27767effd4ef6bdd141b529baa05eeb2b52a11d` (PR CI run `42298838565`; PostgreSQL integration run `42298838567`).

- Dedicated `AdCampaign` model and PostgreSQL migration, separate from global checkout coupons.
- Store-scoped campaign tied to one product from that same store; only active, approved and published products are eligible.
- Seller APIs: `GET/POST /api/seller/advertising/campaigns` and `PATCH /api/seller/advertising/campaigns/[campaignId]`.
- Admin moderation APIs: `GET /api/admin/advertising/campaigns` and `PATCH /api/admin/advertising/campaigns/[campaignId]`.
- Seller page `/seller/advertising`; moderation page `/admin/advertising`; links added to seller workspace and admin navigation.
- Permissions: `ads:manage` for exact STORE-scoped delegated managers; `ads:moderate` for ADMIN/SUPER_ADMIN. Seller owners are checked against the store's actual Seller.ownerId.
- Lifecycle: DRAFT → SUBMITTED → APPROVED/REJECTED → ACTIVE/PAUSED/ARCHIVED. Conditional writes protect transitions; sensitive changes create audit records.
- Schedule has a database check constraint. Rejected submissions require a reason. A product must belong to the same store and be ACTIVE + APPROVED.
- No billing, account debit, impression/click telemetry, attribution, placement inventory, targeting engine, delivery scheduler or live ad delivery is implemented. Approval does not charge the seller. Do not describe this as a complete ad-serving network.

Verification gates:
- [ ] Prisma validate/generate/migration deploy against PostgreSQL, typecheck, lint, tests and production build.
- [ ] Seller A cannot read/mutate seller B campaigns; delegated managers need exact STORE scope.
- [ ] Foreign product IDs, unapproved products, inactive stores, invalid schedules and unauthorized moderation are rejected.
- [ ] Only submitted campaigns can be moderated; rejection requires a reason; concurrent decisions cannot overwrite the first.
- [ ] Real-browser seller/admin flows and desktop/mobile visual QA.

## Advertising campaign management — separate implemented capability

The platform now has a distinct `AdCampaign` domain. It is **not** the coupon/discount domain described above and must not reuse global coupon records as advertising campaigns.

### Implemented lifecycle

- Seller routes: `/seller/advertising` and `/api/seller/advertising/campaigns`.
- Super Admin route: `/admin/advertising` and `/api/admin/advertising/campaigns`.
- Campaigns are scoped to one store and one approved, published product owned by that store.
- Lifecycle: `DRAFT → SUBMITTED → APPROVED/REJECTED → ACTIVE/PAUSED/ARCHIVED`.
- Seller actions: create, submit, activate, pause and archive, subject to server-side state and schedule checks.
- Platform moderation: approve or reject submitted campaigns; rejection requires a reason.
- Dedicated `ads:manage` and `ads:moderate` permissions, store ownership/scoped access checks and audit records.
- Prisma model and migration are included in the merged platform campaign implementation.

### Explicitly not implemented

This lifecycle does not deliver ads to shoppers. Live placements/ad serving, targeting, pacing/frequency caps, impression/click ingestion, event deduplication, attribution, campaign analytics and billing/debits are not implemented. Do not expose these as active controls or charge advertisers until the delivery/event pipeline, fraud controls, budget reservation and payment/ledger design have been separately implemented and tested.

The current authoritative verification and remaining-work record is `docs/qa/PR-57-verification-record.md`.
