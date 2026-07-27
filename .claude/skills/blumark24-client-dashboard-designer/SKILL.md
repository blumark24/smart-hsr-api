---
name: blumark24-client-dashboard-designer
description: >
  Help design and review the Blumark24 OS customer dashboard with a premium
  Saudi SaaS visual identity. Use when touching customer dashboard UX, design
  direction, Executive Blue theme, RTL Arabic-first layout, glassmorphism cards,
  smart windows, Digital Twin preview, or customer portal usability. Always
  preview before implementation. Always provide risk level. Never touch /ai,
  /owner, /owner/security, Supabase/Auth/RLS, or fake data.
---

# blumark24-client-dashboard-designer

## الهدف

تصميم ومراجعة لوحة العميل في Blumark24 OS بمستوى SaaS عالمي بهوية بصرية سعودية متميزة.
هذه المهارة تعمل كمستشار تصميم متخصص — تعرض الخيارات أولاً، وتنتظر الموافقة، ثم تنفذ بحذر.

---

## الهوية البصرية المعتمدة — Blumark24 Executive Blue

```
BRAND IDENTITY
──────────────
Platform:    Blumark24 OS — منصة إدارة المنشآت السعودية
Theme:       Executive Blue (approved)
Audience:    Saudi B2B clients — Basic / Growth / Advanced plans
Language:    Arabic-first, RTL always
Feel:        Financial-grade SaaS · Enterprise · Premium · Trustworthy
```

### نظام الألوان المعتمد (Phase 1 — مطبق)

| الرمز | القيمة | الاستخدام |
|---|---|---|
| `--bg-darkest` | `#020b18` | خلفية الجسم الرئيسية |
| `--bg-dark` | `#0d1f3c` | طبقة الألواح |
| `--bg-mid` | `#142844` | حواف الكروت |
| `--bg-light` | `#1a3356` | hover states |
| `--accent-primary` | `#22d3ee` | Cyan — التمييز الأول |
| `--accent-blue` | `#1e6fd9` | Blue — التمييز الثاني |
| `--text-main` | `#f1f5ff` | النص الرئيسي |
| `--text-muted` | `#8ba3c7` | النص الثانوي |
| Violet AI | `#8b5cf6` | AI / Smart Features فقط |
| Emerald | `#10b981` | نجاح / نشط |
| Amber | `#f59e0b` | تحذير / متبقي |
| Rose | `#ef4444` | خطأ / متأخر |

### Tokens المطبقة في الكود (لا تعدل بدون طلب)

```
workspaceVisual.ts:
  WS_CARD          — glass card رئيسي، radial Cyan/0.12
  WS_CARD_HOVER    — border Cyan/0.28 + glow Cyan/0.08
  WS_SURFACE       — surface panels
  WS_INNER_CARD    — بطاقات داخلية، opacity 0.45
  WS_ICON_ORB      — أيقونة دائرية + glow
  WS_GLASS_MODAL   — مودال glass
  WS_AI_PILL       — pill خاص بـ AI
  WS_STATUS_CHIP   — chips الحالة
  WS_METRIC_VALUE  — قيمة KPI الكبيرة
  WS_SECTION_TITLE — عناوين الأقسام
  KPI_THEMES       — Cyan/Emerald/Amber/Rose per card type

globals.css:
  .glass-card      — border Cyan/0.12
  .glass-card-hover— glow Cyan/0.12
  .progress-bar    — height 7px, radius 4px
  .progress-fill   — cyan glow 0.35
  .input-dark      — focus ring Cyan/0.20
  .sidebar-active  — border-right Cyan + gradient
```

---

## متى تستخدم هذه المهارة

- عند مراجعة تصميم لوحة العميل (UX audit)
- عند اقتراح تحسينات بصرية لأي صفحة عميل
- عند تصميم مكونات جديدة داخل نطاق العميل
- عند تقييم أثر أي تغيير تصميمي على الهوية البصرية
- عند بناء Smart Windows أو Digital Twin preview
- عند مراجعة تجربة الجوال
- عند تقييم تجربة الاشتراك والدفع بصرياً

---

## البنية الحالية — صفحات العميل

```
ALLOWED CLIENT PAGES (safe to design):
  /dashboard          ← الصفحة الرئيسية للعميل
  /tasks              ← المهام
  /clients            ← العملاء
  /employees          ← الموظفون
  /finance            ← المالية
  /reports            ← التقارير
  /virtual-office     ← المكتب الافتراضي
  /strategy           ← الاستراتيجية
  /automation         ← الأتمتة
  /org                ← الهيكل التنظيمي
  /profile            ← الملف الشخصي
  /settings           ← الإعدادات

FORBIDDEN PAGES (لا تلمس):
  /ai                 ← ممنوع تماماً
  /owner              ← ممنوع تماماً
  /owner/security     ← ممنوع تماماً
  /owner/*            ← كل صفحات المالك ممنوعة
```

---

## قواعد التصميم الصارمة

### ممنوع دائماً
1. لا تعدل `/ai` — أي ملف أو مسار
2. لا تعدل `/owner` — أي ملف أو مسار
3. لا تعدل `/owner/security`
4. لا تغير Supabase / Auth / RLS
5. لا تضيف data migration
6. لا تستخدم بيانات وهمية (mock data) في العرض
7. لا تدّعي ذكاء اصطناعي حقيقي لمجرد العرض
8. لا تضيف بوابة دفع حقيقية بدون طلب صريح
9. لا تغير hooks أو منطق البيانات
10. لا تغير routes أو functions
11. لا تفتح PR بدون طلب صريح
12. لا تدمج PR بدون موافقة صريحة

### واجب دائماً
1. **عرض 3 خيارات تصميم** قبل التوصية بأي تنفيذ
2. **تحديد مستوى الخطورة** قبل أي تغيير كود
3. **الهيكل الحالي ثابت** — فقط الـ tokens والـ classes البصرية قابلة للتغيير
4. **التغييرات تدريجية وقابلة للعكس**
5. **RTL أولاً** في كل تصميم
6. **العربية أولاً** في كل نص

---

## منهجية العمل

### عند طلب تصميم جديد

```
STEP 1: تحليل الوضع الحالي
  ← اقرأ الملفات ذات الصلة
  ← افهم البنية الحالية والـ tokens المستخدمة
  ← حدد نقاط الضعف

STEP 2: عرض 3 Concepts
  ← كل Concept: وصف الستايل + الألوان + التخطيط
  ← نقاط القوة لكل Concept
  ← المخاطر لكل Concept
  ← هل يناسب Basic / Growth / Advanced

STEP 3: التوصية
  ← اختر Concept واحد مع مبرر واضح

STEP 4: انتظر الموافقة
  ← لا تنفذ أي كود حتى يقول المستخدم "نفذ"

STEP 5: التنفيذ المعتمد
  ← ملفات محددة فقط
  ← تغييرات محدودة
  ← build + tsc + lint قبل commit
  ← draft PR فقط
```

### مستويات الخطورة

```
🟢 LOW RISK — آمن للتطبيق مباشرة:
   - تغيير قيمة CSS variable في globals.css
   - تغيير opacity أو color في workspaceVisual.ts
   - تغيير border-radius أو shadow token
   - تحسين progress bar أو input focus

🟡 MEDIUM RISK — يحتاج مراجعة قبل التطبيق:
   - إضافة class جديد في globals.css
   - تغيير WS_CARD layout structure
   - تعديل spacing في workspaceVisual.ts
   - إضافة animation جديدة

🔴 HIGH RISK — يحتاج موافقة صريحة:
   - تعديل DashboardLayout.tsx أو Sidebar.tsx
   - إضافة مكون React جديد
   - تغيير grid layout في أي صفحة
   - تعديل Header.tsx أو MobileBottomNav.tsx
   - أي تغيير في ملفات خارج globals.css و workspaceVisual.ts
```

---

## مخرجات التصميم المطلوبة

عند تقديم تقرير تصميم كامل، يجب أن يشمل:

### 1. Design Audit
- ما الذي يعمل جيداً في التصميم الحالي
- ما الذي يحتاج تحسيناً
- مقارنة بالمعايير العالمية لـ Enterprise SaaS

### 2. UX Problems
- مشاكل قابلية الاستخدام
- مشاكل تدفق المستخدم
- مشاكل المعلومات الزائدة أو الناقصة
- مشاكل الجوال

### 3. Design Tokens
- الألوان المقترحة
- الطباعة المقترحة
- الـ spacing والـ radius
- الـ shadows والـ glows

### 4. Dashboard Layout Proposal
- تخطيط الصفحة الرئيسية
- ترتيب الأقسام
- التسلسل الهرمي للمعلومات

### 5. Sidebar Proposal
- شكل القائمة الجانبية
- Active states
- Collapsed state
- عناصر إضافية (Subscription widget, User widget)

### 6. Cards Proposal
- شكل بطاقات KPI
- الـ metrics display
- الـ progress bars
- الـ icon orbs

### 7. Tables Proposal
- Header style
- Row hover
- Status badges
- Numeric cells

### 8. Modals Proposal
- Backdrop
- Container style
- Header / Footer
- Action buttons

### 9. Mobile Proposal
- Bottom navigation
- Compact hero
- Card grid
- Performance considerations

### 10. Risks & Recommendation
- جدول المخاطر لكل تغيير
- التوصية النهائية
- الأولوية

### 11. Safe Implementation Plan
- المراحل (Phase 1, 2, 3)
- ما يدخل كل مرحلة
- الملفات المسموح تعديلها لكل مرحلة

### 12. Files Allowed / Forbidden

```
ALLOWED (by default):
  src/app/globals.css
  src/components/ui/workspaceVisual.ts

ALLOWED (with medium risk approval):
  src/components/ui/PremiumMetricCard.tsx
  src/components/ui/workspaceUi.tsx
  src/components/ui/Skeleton.tsx
  src/app/dashboard/page.tsx (layout-only changes)
  src/app/tasks/page.tsx
  src/app/clients/page.tsx
  src/app/finance/page.tsx
  src/app/reports/page.tsx
  src/app/settings/page.tsx
  src/app/profile/page.tsx

ALLOWED (with high risk approval only):
  src/components/layout/Sidebar.tsx
  src/components/layout/Header.tsx
  src/components/layout/DashboardLayout.tsx
  src/components/layout/MobileBottomNav.tsx

FORBIDDEN (never touch):
  src/app/ai/**
  src/app/owner/**
  src/contexts/AuthContext.tsx
  src/contexts/PermissionsContext.tsx
  src/lib/supabase*
  supabase/**
  Any migration file
  Any RLS policy file
```

---

## Digital Twin Design Framework

عند تصميم أي Digital Twin preview للعميل:

```
ENTITIES (from real data only):
  ⬡ الشركة       ← بيانات من tenant profile
  ⬡ الاشتراك     ← planSlug + organizationStatus
  ⬡ الفريق       ← employees count + active count
  ⬡ العملاء      ← clients count + active count
  ⬡ المالية      ← netProfit + transactions
  ⬡ التقارير     ← reports count
  ⬡ الدعم        ← support tickets
  ⬡ الخدمات     ← available modules per plan

RULES:
  - كل node يعرض حالة حقيقية من البيانات فقط
  - إذا لا توجد بيانات → اعرض empty state صادق
  - لا تعرض "نشط" إذا لم يُفعّل الميزة
  - زر "Coming Soon" للميزات غير المفعّلة
  - لا تصمم AI actions حقيقية — فقط rule-based insights
```

---

## Smart Windows Framework

عند تصميم نوافذ ذكية:

```
SUBSCRIPTION WINDOW:
  - الباقة الحالية + الحالة الحقيقية (من organizationStatus)
  - بيانات: تاريخ البدء، تاريخ الانتهاء (إن وجدت)، آخر فاتورة
  - زر "طلب رابط الدفع" ← disabled / Coming Soon إن لم يُفعّل
  - لا تعرض أسعار غير مصرح بها

PAYMENT WINDOW:
  - حالة الدفع الحقيقية فقط
  - "بوابة الدفع قيد التجهيز" إذا لم تُفعّل
  - Empty state راقٍ — لا أرقام وهمية

SERVICES WINDOW:
  - الخدمات المتاحة للباقة الحالية فقط (packageFeatures)
  - Coming Soon لما لم يُفعّل

SUPPORT WINDOW:
  - فتح طلب دعم جديد
  - قائمة الطلبات السابقة الحقيقية
  - WhatsApp / Email direct contact

FACILITY HEALTH WINDOW:
  - Score مشتق من KPI حقيقي فقط
  - لا تختلق مؤشرات صحية
```

---

## قائمة فحص قبل أي تنفيذ

```
□ هل طلب المستخدم التنفيذ صراحةً؟
□ هل عرضت 3 خيارات تصميم؟
□ هل حددت مستوى خطورة كل تغيير؟
□ هل الملفات المستهدفة في القائمة المسموحة؟
□ هل /ai محمية؟
□ هل /owner محمية؟
□ هل لا توجد بيانات وهمية؟
□ هل لا يوجد تغيير في routes أو functions؟
□ هل لا يوجد تغيير في Supabase/Auth/RLS؟
□ هل RTL محمي في كل تغيير؟
```

## قائمة فحص بعد التنفيذ

```
□ npm run build → passed
□ tsc --noEmit  → no errors
□ npm run lint  → no warnings
□ Layout changed: NO
□ Dashboard components changed: NO (or justified)
□ /ai untouched: YES
□ /owner untouched: YES
□ Migration added: NO
□ Auth/RLS changed: NO
□ New libraries added: NO
□ PR created as DRAFT only
□ Safe for visual preview: YES
```

---

## الملفات المعتمدة في Phase 1 (مطبقة)

```
git branch: claude/hopeful-hawking-ktu66v
PR: #373 (Draft)

FILES CHANGED:
  src/app/globals.css          — bg tokens, text, glass, progress, input
  src/components/ui/workspaceVisual.ts — WS_CARD, WS_CARD_HOVER, WS_INNER_CARD

TOKENS APPLIED:
  --bg-darkest  #0a1628 → #020b18
  --text-main   #e2e8f0 → #f1f5ff
  glass-card border 0.10 → 0.12
  progress-bar  6px → 7px + cyan glow
  input focus   0.15 → 0.20
  WS_CARD glow  0.10 → 0.12
  WS_INNER_CARD opacity 0.38 → 0.45
```

---

## المراحل المستقبلية (لم تُنفَّذ بعد)

```
PHASE 2 — Medium Risk (يحتاج موافقة):
  - Sidebar Subscription Widget
  - Sidebar User Widget
  - KPI metric font size رفع إلى 3rem
  - Icon orb size رفع إلى 44px
  - Modal border-radius رفع إلى 28px

PHASE 3 — High Risk (يحتاج موافقة صريحة):
  - Digital Twin section في /dashboard
  - Smart Windows (Subscription, Payment, Services, Support)
  - Facility Health Score widget
  - Mobile Bottom Nav redesign
```
