# Blumark24 OS — لوحة المتابعة التنفيذية (Self-Updating Executive Dashboard)

لوحة HTML عربية RTL تعرض الحالة الحقيقية لمشروع Blumark24 OS بناءً على **بوابات إثبات ثابتة (Gate-Based Scoring)**،
لا على نسب تقديرية. البيانات مفصولة عن العرض: مصدر الحقيقة هو ملفات JSON داخل `data/`، والـHTML يُولَّد آليًا منها.

> أداة إدارية مستقلة داخل `tools/project-dashboard/`. **لا تلمس صفحات المنتج، ولا قاعدة البيانات، ولا الأمن، ولا الـMigrations.**
> السكربتات تكتب محليًا فقط داخل هذا المجلد — لا Production deploy، ولا نشر يدوي. (أي Preview deployment ينشئه Vercel تلقائيًا عند دفع الفرع.)

## التشغيل السريع

```bash
# بناء اللوحة من JSON ثم فتحها
npm run project:dashboard        # يبني index.html من data/*.json
npm run project:serve            # يشغّل خادمًا محليًا (http://localhost:4173)

# دورة كاملة: تدقيق (git/routes) → بناء → تحقق
npm run project:update

# تحديث نتائج الفحوصات الفعلية أيضًا (verify:isolation/lint/build/tsc/audit)
npm run project:update -- --with-checks

# فحص المشروع فقط (قراءة فقط، ينتج JSON+MD)
npm run project:audit

# التحقق من سلامة البيانات (schema/scores/evidence/dates)
npm run project:validate
```

بدون npm يمكن فتح `index.html` مباشرة في المتصفح — اللوحة تعمل **offline بالكامل** (لا CDN، لا fetch؛
كل البيانات مضمّنة داخل الصفحة كـ `data island`).

## البنية

```
tools/project-dashboard/
  index.html               ← مُولَّد آليًا (لا يُحرَّر يدويًا)
  assets/
    dashboard.css          ← تصميم Premium Saudi Enterprise (dark navy / electric blue / ice cyan)
    dashboard.js           ← محرّك العرض — يبني كل الأقسام من الـdata island
  data/                    ← مصدر الحقيقة (JSON)
    project-state.json     ← النسبة/المرحلة/المعوّق/الملخص التنفيذي/المحاور
    score-gates.json       ← منهجية البوابات + خطة 75→100 + خارطة 1000 منشأة
    module-status.json     ← أقسام العميل (6 بوابات لكل قسم) + المالك + طبقات AI + الهيكل
    evidence-ledger.json   ← سجل الأدلة + المخاطر + الفجوات + لقطات المصادر الخارجية
    audit-history.json     ← سجل التغييرات (Score Changelog)
    check-results.json     ← نتائج آخر فحوصات (verify/lint/build/tsc/audit)
    live-snapshot.json     ← لقطة git/الملفات (تُولَّد عند project:audit)
  scripts/
    audit-project.mjs      ← جامع قراءة-فقط (git + routes + migrations + [--with-checks])
    build-dashboard.mjs    ← يولّد index.html + SCORE_CHANGELOG.md من JSON
    validate-dashboard.mjs ← بوابة سلامة البيانات (تفشل CI عند أي خرق)
    update-dashboard.mjs   ← audit → build → validate
  reports/
    LATEST_FULL_AUDIT.md / .json   ← لقطة التدقيق الآلية
    SCORE_CHANGELOG.md             ← سجل الدرجات (مُولَّد)
    DASHBOARD_ARCHITECTURE.md      ← معمارية اللوحة ونموذج البيانات
    AUTO_UPDATE_WORKFLOW.md        ← كيفية التحديث بعد كل تطوير
    EXCEL_MIGRATION_MAP.md         ← ربط أوراق Excel بأقسام/JSON اللوحة
```

## قاعدة النسبة (غير قابلة للتفاوض)

- إضافة نطاق/قسم جديد **لا يخفض** النسبة السابقة.
- النسبة **لا ترتفع** إلا بإغلاق بوابة موثقة (Build/Test/Isolation/E2E/Restore).
- العمل الجزئي، التقرير، ملف SQL، نجاح Build، أو واجهة موجودة — **لا يغلق بوابة**.
- كل درجة تعرض: Score / Confidence / Evidence / Last verified / Gate status / Blocker / Next action.

## السلامة

- كل السكربتات **قراءة فقط** ضد المشروع، وتكتب فقط داخل `tools/project-dashboard/`.
- لا أسرار مُخزَّنة. المصادر الخارجية (Supabase/Vercel/GitHub) تُعرض `UNAVAILABLE/STALE` حتى تُلتقط لقطة صريحة.
- `validate` يرفض: score بلا دليل، بوابة مغلقة بلا دليل، تاريخ مستقبلي، نسبة خارج 0–100، تناقض الدرجة مع البوابات.
