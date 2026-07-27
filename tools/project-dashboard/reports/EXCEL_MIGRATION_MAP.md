# EXCEL MIGRATION MAP — من `Blumark24_OS_Truth_Based_Master_Dashboard.xlsx` إلى اللوحة

نُقلت كل أوراق Excel منطقيًا إلى مصدر حقيقة JSON + أقسام HTML. لم تُنسخ الأرقام بصمت؛
صُنّف كل رقم (Verified / Partially Verified / Stale / Unsupported) وحُفظت الأدلة.

| ورقة Excel | قسم HTML | مصدر JSON | قواعد التحقق (validate) | مصدر التحديث | الحالة |
| --- | --- | --- | --- | --- | --- |
| لوحة القيادة | نظرة عامة | `project-state.json` (scorecard + axes + executiveSummary) | delta=current−previous، النسب 0–100، حقول إلزامية غير فارغة | يدوي عند إغلاق بوابة + `project:audit` (freshness) | Verified |
| منهجية التقييم | خطة 75–100 → «بوابات الإثبات» | `score-gates.json` (gates) | بوابة مغلقة تتطلب evidence، targetScore 0–100 | يدوي | Verified |
| لوحة العميل | أقسام لوحة العميل | `module-status.json` (clientModules) | score = متوسط أوزان البوابات ×100 (تطابق إلزامي) | يدوي + مراجعة كود | Verified (14 قسمًا) |
| لوحة المالك | لوحة المالك | `module-status.json` (ownerModules) | score 0–100 | يدوي | Verified (6 وحدات) |
| المساعد التنفيذي | المساعد التنفيذي | `module-status.json` (aiLayers + aiMandatoryFlow) | score 0–100 | يدوي + مراجعة كود | Verified (11 طبقة) |
| الهيكل الإداري | الهيكل الإداري | `module-status.json` (hierarchy) | وجود القسم المطلوب | يدوي | Verified (8 مستويات) |
| الخطة 75-100 | خطة 75–100 | `score-gates.json` (plan75to100) | from/to 0–100 | يدوي | Verified (9 مراحل) |
| خارطة 1000 منشأة | خارطة 1000 منشأة | `score-gates.json` (roadmap1000) | score 0–100 | يدوي | Verified (6 مراحل) |
| الأدلة والقرارات | سجل الأدلة | `evidence-ledger.json` (evidence) | تاريخ غير مستقبلي، مصدر إلزامي | `project:audit` (git/checks) + يدوي | Verified/Stale مصنّف |
| سجل التحديث | سجل التغييرات | `audit-history.json` (changelog) | ارتفاع درجة يتطلب بوابة مغلقة | يدوي (إضافة فقط) | Verified |
| القوائم | أوزان البوابات | `module-status.json` (gateWeights/gateLabels) | مفاتيح البوابات معروفة | ثابت | Verified |

## تصنيف الأدلة (لم تُحذف البيانات التاريخية)

- **Verified (حديث، هذه الجلسة):** `main` بعد PR #524 = `a8bfd6f`؛ verify:isolation PASS (static)؛ lint/build PASS؛ tsc PASS؛
  AI Assistant tenant-scoped + rate-limit + no writes (مؤكد بالكود)؛ غياب مسار `/meetings`؛
  **Bridge — VERIFIED LIVE FROM SUPABASE PREVIEW** (`gutxgqwtiuudobpbusos`): migration `20260711005000_mydesk_task_management_bridge` + جداول
  `task_events` / `task_reviewer_assignments` / `task_reviews` — جميعها RLS enabled والصفوف الحالية 0.
- **Partially Verified:** الخط الأساسي 75 (بوابة مغلقة موثقة، لكن لا يعني Production ready).
- **Stale (لم يُعَد التحقق حيًا هذه الجلسة):** Staging Steps 1–5 + Prerequisite — مصدرها تقارير محادثة سابقة؛
  عُرضت كـ Stale ولم تُستخدم لرفع النسبة.
- **Unsupported/UNAVAILABLE:** لقطات Supabase/Vercel/GitHub الحية — لم تُقرأ (قراءة فقط، بلا كتابة)؛ تُعرض UNAVAILABLE.

## فروقات مُظهَرة (لا تغيير صامت)

- الخط الأساسي **75** ثابت: لم تُغلق بوابة جديدة منذ PR #524، لذا Current = Previous = 75، Δ = 0،
  رغم نجاح كل الفحوصات الثابتة. السبب معروض في اللوحة (deltaReason) وفي سجل التغييرات.
- درجات أقسام العميل أُعيد اشتقاقها من البوابات الست بدل نسخها كأرقام، فأصبحت **قابلة للتحقق** بالمدقّق.
