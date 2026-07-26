# Blumark24 Design System V1

المرجع البصري الرسمي لنظام Blumark24 OS. أي واجهة جديدة أو مُعاد تصميمها تلتزم بهذه الوثيقة.

- **التوكنز:** `src/styles/design-tokens.css` (مستوردة عالميًا في `globals.css`)
- **ربط Tailwind:** أصناف `ds-*` في `tailwind.config.ts`
- **المكونات:** `src/components/ds/` (تُستورد من `@/components/ds`)

## القاعدة الذهبية

**يُمنع كتابة أي لون hex يدويًا في المكونات.** كل قيمة بصرية عبر توكن — إما صنف Tailwind دلالي (`bg-ds-surface-1`) أو `var(--ds-*)`. الشفافيات المشتقة عبر `color-mix(in srgb, var(--ds-*) N%, transparent)`.

---

## 1. الألوان

| التوكن | صنف Tailwind | Dark | الاستخدام |
|---|---|---|---|
| `--ds-bg` | `bg-ds-bg` | `#040c16` | أرضية الصفحة |
| `--ds-surface-1` | `bg-ds-surface-1` | `#0b1927` | البطاقات الرئيسية والنوافذ |
| `--ds-surface-2` | `bg-ds-surface-2` | `#07111b` | الأسطح الغائرة والحقول |
| `--ds-surface-3` | `bg-ds-surface-3` | `#102235` | بطاقات المهام والأزرار المحايدة |
| `--ds-border-soft / border / border-strong` | `border-ds-border-*` | أبيض 8/10/12% | الحدود بثلاث درجات |
| `--ds-accent` | `bg-ds-accent` | `#1e6fd9` | الفعل الأساسي (أزرق الهوية) |
| `--ds-accent-teal` | `text-ds-teal` | `#22d3ee` | هوية Blumark24 — تمييز وعناصر حية |
| `--ds-ring` | `ring-ds-ring` | `#22d3ee` | حلقة التركيز الموحدة |
| `--ds-text-1 / 2 / 3` | `text-ds-text-*` | `#f6f8fb / #aeb9c5 / #8d9baa` | نص أساسي/ثانوي/خافت — **لا أخفت من text-3** |
| `--ds-info` | `text-ds-info` | `#3c8cff` | حالة: جديدة |
| `--ds-warn` | `text-ds-warn` | `#d9a752` | حالة: قيد التنفيذ |
| `--ds-review` | `text-ds-review` | `#36b7b4` | حالة: بانتظار المراجعة |
| `--ds-success` | `text-ds-success` | `#5cc68b` | حالة: مكتملة |
| `--ds-danger` | `text-ds-danger` | `#f47b43` | حالة: متأخرة / إجراءات حذف |

قيم الوضع الفاتح معرّفة كمسودة تحت `[data-theme="light"]` وتُفعّل تلقائيًا كلما انتقلت المكونات للتوكنز.

## 2. الخطوط

- العائلة: `IBM Plex Sans Arabic` ثم `Tajawal` (`--ds-font`). لا يُفرض خط محلي في أي صفحة.
- السلّم (أصناف `text-ds-*`):

| الصنف | الحجم/الوزن | الاستخدام |
|---|---|---|
| `ds-display` | 24px / 800 | عناوين الصفحات |
| `ds-title` | 18px / 800 | عناوين النوافذ والأقسام الكبرى |
| `ds-heading` | 14px / 700 | عناوين البطاقات |
| `ds-body` | 13px / 400 | نص المحتوى والحقول |
| `ds-label` | 12px / 700 | تسميات الأزرار والحقول |
| `ds-caption` | 11px / 500 | **الحد الأدنى المطلق** — شروح وملاحظات |

الأرقام دائمًا مع `tabular-nums`.

## 3. المسافات

سلّم 4px عبر أصناف `premium-*` الموجودة: `4/8/12/16/20/24/32/40`. حشوة البطاقة القياسية 16px (12px جوال)، الفجوة بين الأقسام 12px.

## 4. الحواف والظلال

| التوكن | القيمة | الاستخدام |
|---|---|---|
| `rounded-ds-sm` | 8px | حقول، أزرار، عناصر داخلية |
| `rounded-ds-md` | 12px | بطاقات ونوافذ سطح المكتب |
| `rounded-ds-lg` | 16px | Bottom Sheets (الحافة العلوية) |
| `rounded-full` | — | رقاقات وشارات |
| `shadow-ds-1` | خفيف | بطاقات المهام |
| `shadow-ds-2` | متوسط | الأسطح الرئيسية المرفوعة |
| `shadow-ds-3` | عميق | النوافذ الحوارية |

التوهج الملوّن للعناصر الحية فقط (زر أساسي بارز، بطاقة مميزة واحدة كحد أقصى في الشاشة).

## 5. الأزرار — `DsButton`

```tsx
<DsButton onClick={save}>حفظ</DsButton>
<DsButton variant="secondary" icon={<RotateCcw size={13} />}>إعادة الضبط</DsButton>
<DsButton variant="ghost" size="icon" aria-label="فتح المرشحات" icon={<SlidersHorizontal size={16} />} />
<DsButton variant="danger" loading={deleting}>حذف</DsButton>
```

- الأنواع: `primary` (فعل رئيسي واحد بالشاشة) / `secondary` / `ghost` (أيقونات) / `danger`.
- ارتفاع أدنى 44px دائمًا، `size="icon"` = 44×44.
- `loading` يعطّل الزر ويعرض Spinner، `disabled` = opacity 55%.

## 6. الحقول — `DsInput` / `DsSelect` / `DsTextarea`

```tsx
<DsInput label="عنوان المهمة" placeholder="أدخل العنوان" error={errors.title} />
<DsSelect label="الأولوية" value={priority} onChange={...}>{options}</DsSelect>
<DsTextarea label="الوصف" hint="اختياري" />
```

- التسمية فوق الحقل، ارتفاع 44px، تركيز بحد أزرق + ring.
- `error` تظهر تحت الحقل مع `role="alert"` و`aria-invalid` و`aria-describedby` تلقائيًا — لا اكتفاء بـ Toast.

## 7. البطاقات — `DsCard`

```tsx
<DsCard as="section" padding="md">...</DsCard>          // glass: السطح الرئيسي
<DsCard variant="inset" padding="sm">...</DsCard>        // غائر: صفوف معلومات
<DsCard variant="task" hoverable as="article">...</DsCard> // بطاقة مهمة
```

بطاقة المهمة تحمل شريطًا جانبيًا 3px بلون الحالة (يُضاف عند التنفيذ في المرحلة 4 عبر border-inline-start بلون توكن الحالة).

## 8. الرقاقات — `DsBadge`

```tsx
<DsBadge tone="danger" dot>متأخرة</DsBadge>
<DsBadge tone="neutral">منخفضة</DsBadge>
```

الدرجات الست تطابق دلالات الحالات. `dot` لنقطة ملوّنة قبل النص.

## 9. الجداول والقوائم

صفوف بفاصل `divide-white/[0.07]`، ارتفاع أدنى 56px، تتحول لبطاقات مكدّسة دون `md`. ترقيم أو "تحميل المزيد" بعد 50 عنصرًا — لا رسم لقوائم غير محدودة.

## 10. حالات التفاعل

| الحالة | القاعدة |
|---|---|
| hover | تغيير خلفية فقط (أو رفع 2px للبطاقات القابلة للنقر) |
| focus-visible | `ring-2 ring-ds-ring` — موحّدة في كل النظام بلا استثناء |
| active | هبوط 1px |
| selected | خلفية `accent 16-22%` + نص فاتح |
| disabled | opacity 55% + منع الأحداث |
| الحركة | 150–200ms، وتُلغى كليًا مع `prefers-reduced-motion` (`motion-reduce:*`) |

## 11. حالات التحميل والفراغ والخطأ

- **تحميل:** Skeleton بشكل الحاوية النهائية (`src/components/ui/Skeleton.tsx`) — Spinner للأفعال فقط.
- **فراغ:** `DsEmptyState` — أيقونة + عنوان + سطر واحد + إجراء حسب الصلاحية. **صدق تام: لا أرقام أو نشاط وهمي.**
- **خطأ:** `DsEmptyState tone="danger"` + زر إعادة المحاولة.

## 12. النوافذ والقوائم — `DsModal` / `DsActionSheet`

- `DsModal`: Bottom Sheet على الجوال، مودال مركزي 540px من `sm`. Focus trap، Escape، قفل تمرير، استعادة تركيز، `aria-labelledby` تلقائي.
- `DsActionSheet`: البديل الرسمي لقوائم `<details>` — `role="menu"` بتنقل أسهم/Home/End وإغلاق بالنقر الخارجي. Bottom Sheet جوال / Popover من `md`.
- التأكيدات الخطرة (حذف) عبر `DsModal` — **يُمنع `window.confirm`**.

## 13. RTL والعربية

- الاتجاه يرثه النظام من `html[dir=rtl]` — المكونات تستخدم خصائص منطقية (`text-start`, `ps/pe`, `start-0`).
- النصوص عربية واضحة مختصرة مهنية. أهداف اللمس ≥ 44px.

## 14. قواعد الحوكمة

1. لا hex في المكونات — توكنز فقط.
2. لا خط محلي — `--ds-font` فقط.
3. لا نص أصغر من `ds-caption` (11px).
4. حلقة تركيز واحدة (`ring-ds-ring`) في كل النظام.
5. الحالات الفارغة صادقة دائمًا.
6. لا localStorage للبيانات التجارية.
7. أي مكوّن جديد يُضاف هنا وفي `src/components/ds/index.ts` معًا.
8. `brand.*` و`premium.*` و`WS_*` طبقات موروثة — تُهاجر تدريجيًا إلى `ds-*` ولا يُبنى عليها جديد.
