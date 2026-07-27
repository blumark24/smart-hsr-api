# DASHBOARD ARCHITECTURE — Blumark24 OS Executive Dashboard

## المبدأ: فصل البيانات عن العرض

مصدر الحقيقة هو ملفات JSON في `data/`. الـHTML **مُولَّد** (`build-dashboard.mjs`) ولا يُحرَّر يدويًا.
عند البناء تُضمَّن كل ملفات JSON داخل `index.html` في وسم واحد:

```html
<script type="application/json" id="dashboard-data"> { …all data… } </script>
```

ثم يقرأ `dashboard.js` هذا الـ island ويبني كل الأقسام في المتصفح. النتيجة:

- **Offline كامل**: لا `fetch`, لا CDN — يعمل عبر `file://` بلا إنترنت.
- **مصدر واحد**: تغيير أي رقم في JSON ثم `npm run project:dashboard` يغيّر الـHTML آليًا.
- **لا localStorage كمصدر حقيقة**: الحالة المؤقتة (السمة، الفلتر، القسم النشط) في الذاكرة فقط.

## تدفّق التحديث

```
project:audit    →  audit-project.mjs   (قراءة فقط: git + routes + migrations + [--with-checks])
                    ├─ data/live-snapshot.json
                    ├─ data/project-state.json (meta.generatedAt فقط)
                    └─ reports/LATEST_FULL_AUDIT.{json,md}
project:dashboard→  build-dashboard.mjs (JSON → index.html + SCORE_CHANGELOG.md)
project:validate →  validate-dashboard.mjs (بوابة السلامة)
project:update   →  audit → build → validate
```

## نموذج البيانات (JSON Schemas — مبسّط)

### project-state.json
`scorecard{ currentVerifiedScore, previousScore, scoreDelta, confidence, readiness10Clients,
readiness1000Orgs, productionGate{status,reason}, currentPhase, nextGate, currentBlocker,
nextSingleAction, lastVerified, evidenceFreshness{label,asOf,note} }`, `axes[]{name,score,source,status}`,
`executiveSummary{}`, `scoringRule`, `meta{generatedAt}`.

### score-gates.json
`methodology{rules[]}`, `gates[]{order,stage,targetScore,state(closed|open|deferred),gate,evidence,decision}`,
`plan75to100[]{order,stage,from,to,status,output,closeGate,currentStep,owner}`,
`roadmap1000[]{phase,orgs,productGoal,tech,kpi,transitionGate,status,score}`.

### module-status.json
`gateWeights{complete:1,partial:0.5,missing:0,deferred:0}`, `gateKeys[6]`, `gateLabels{}`,
`clientModules[]{name,path,gates{6},score,confidence,state,biggestGap,nextAction,design}`،
`ownerModules[]`, `aiLayers[]`, `aiMandatoryFlow[]`, `hierarchy[]`.
**قاعدة:** `score` لكل قسم عميل = متوسط أوزان بواباته × 100 (يتحقق منه المدقّق).

### evidence-ledger.json
`evidence[]{id,name,date,result,proves,doesNotProve,source,confidence,decision,freshness}`,
`externalSnapshots{github,vercel,supabase}`, `topRisks[]{id,severity,title,detail,mitigation}`, `topGaps[]`.

### audit-history.json
`changelog[]{date,phase,event,gate,scoreBefore,scoreAfter,decision}`.

### check-results.json / live-snapshot.json
نتائج الفحوصات ولقطة git/الملفات — الجزء الديناميكي الوحيد.

## حالات القسم (State)
`verified-complete` · `verified-partial` · `unverified` · `blocked` · `stale` · `planned` · `deferred`
— تُعرض بنصّ + أيقونة + شارة (لا لون وحده) لأجل الوصول (Accessibility).

## التصميم
Premium Saudi Enterprise: Dark Navy، Electric Blue، Ice Cyan. RTL أصيل، `prefers-reduced-motion`،
تباين مرتفع، تنقّل بلوحة المفاتيح، `skip-link`، وسمة فاتحة/داكنة. طباعة عبر `@media print`.
