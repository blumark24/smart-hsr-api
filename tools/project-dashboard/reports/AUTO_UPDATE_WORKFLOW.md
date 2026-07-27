# AUTO-UPDATE WORKFLOW — التحديث بعد كل تطوير

الهدف: بعد كل PR أو تطوير، تُحدَّث اللوحة **بأمان** دون رفع النسبة إلا بإغلاق بوابة موثقة.

## الدورة القياسية بعد كل تطوير

1. **شغّل الاختبارات** واحفظ نتائجها كدليل:
   ```bash
   npm run project:update -- --with-checks
   ```
   هذا يُحدّث `data/check-results.json` و`data/live-snapshot.json` من نتائج فعلية
   (verify:isolation / lint / build / tsc / npm audit) ولقطة git.

2. **قرِّر تغيّر الدرجة بيدك** في `data/`:
   - إن أُغلقت بوابة موثقة → حدّث `project-state.json` (currentVerifiedScore/previousScore/scoreDelta)
     وأضِف صفًا في `audit-history.json` مع `gate: "مكتملة"` والدليل في `evidence-ledger.json`.
   - إن لم تُغلق بوابة → **لا تغيّر النسبة**؛ حدّث فقط المرحلة/المعوّق/الخطوة التالية والأدلة.
   - قاعدة صارمة: إضافة نطاق **لا** تخفض النسبة، ونجاح فحص ثابت **لا** يرفعها.

3. **أعِد البناء والتحقق**:
   ```bash
   npm run project:update
   ```
   يفشل `validate` إن ظهر: score بلا دليل، بوابة مغلقة بلا دليل، تاريخ مستقبلي،
   نسبة خارج 0–100، أو تناقض بين درجة القسم وبواباته.

4. **قارن السابق بالجديد**: `reports/SCORE_CHANGELOG.md` يعرض قبل/بعد وΔ لكل حدث.

5. **احتفظ بالتاريخ**: لا تُحذف الصفوف القديمة من `audit-history.json`؛ أضِف فقط.

## GitHub Action (قراءة فقط)

الملف: `.github/workflows/project-dashboard.yml` — **مستقل وآمن**:

- يعمل على `pull_request` و`push` إلى `main`.
- يبني اللوحة ويشغّل المدقّق فقط. **لا** يطبّق DB، **لا** ينشر Production، **لا** auto-commit، **لا** يفتح PR.
- يرفع `index.html` + JSON + Markdown كـ**Artifact**.
- يفشل فقط عند: تناقض البيانات، بوابة مغلقة بلا دليل، Score غير صالح، HTML/JS مكسور، أو قسم مطلوب مفقود.
- لا يكشف أي أسرار.

## مصادر التحديث التلقائي

`audit-project.mjs` يقرأ آليًا: الفرع، الحالة، السجل، `origin/main` SHA، `package.json`،
عدد المسارات، عدد الـMigrations، وجود `/meetings`. المصادر الخارجية (Supabase/Vercel/GitHub PRs)
تُعرض `UNAVAILABLE/STALE` حتى تُلتقط لقطة صريحة — لا يُعاد استخدام نتيجة قديمة كأنها حديثة،
ويُعرض دومًا وقت آخر تحقق وعمر الدليل.
