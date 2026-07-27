"use client";

import Link from "next/link";
import { useMemo, useState, useRef, useEffect, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  CircleDollarSign,
  CreditCard,
  Gauge,
  Headphones,
  LayoutDashboard,
  LineChart,
  Lock,
  Network,
  Palette,
  Radar,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  WalletCards,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { mapAuthRoleToUserRole, usePermissions } from "@/contexts/PermissionsContext";
import { useTenantWorkspace } from "@/contexts/TenantWorkspaceContext";
import {
  useActivities,
  useClients,
  useEmployees,
  useProjects,
  useTasks,
  useTransactions,
} from "@/hooks/useData";
import { useTenantCompanyName } from "@/hooks/useTenantCompanyName";
import { PLAN_LABELS_AR, type PlanSlug } from "@/lib/features/packageFeatures";
import { getTenantRoleLabel } from "@/lib/tenant/tenantDisplay";
import { cn, formatCurrency, timeAgo } from "@/lib/utils";

// ─── Brand palette ─────────────────────────────────────────────────────────────
// Royal Blue  #002DA7 · Business Blue #006BB6 · Cyan #22D3EE
// Orange Accent #C54412 · Deep BG #020817 / #061128

type Tone = "blue" | "cyan" | "orange" | "green" | "muted";

function toneMap(tone: Tone) {
  const map: Record<Tone, { chip: string; icon: string; glow: string; bar: string; dot: string }> = {
    blue: {
      chip:  "border-[#006BB6]/30 bg-[#002DA7]/20 text-[#93c5fd]",
      icon:  "border-[#006BB6]/30 bg-[#002DA7]/20 text-[#60a5fa]",
      glow:  "shadow-[0_0_26px_rgba(0,107,182,.22)]",
      bar:   "from-[#006BB6] to-[#002DA7]",
      dot:   "#006BB6",
    },
    cyan: {
      chip:  "border-[#22D3EE]/25 bg-[#22D3EE]/10 text-[#a5f3fc]",
      icon:  "border-[#22D3EE]/25 bg-[#22D3EE]/10 text-[#22D3EE]",
      glow:  "shadow-[0_0_26px_rgba(34,211,238,.20)]",
      bar:   "from-[#22D3EE] to-[#006BB6]",
      dot:   "#22D3EE",
    },
    orange: {
      chip:  "border-[#C54412]/30 bg-[#C54412]/12 text-[#fdba74]",
      icon:  "border-[#C54412]/30 bg-[#C54412]/12 text-[#fb923c]",
      glow:  "shadow-[0_0_26px_rgba(197,68,18,.18)]",
      bar:   "from-[#C54412] to-[#9a3412]",
      dot:   "#C54412",
    },
    green: {
      chip:  "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
      icon:  "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
      glow:  "shadow-[0_0_26px_rgba(16,185,129,.16)]",
      bar:   "from-emerald-400 to-[#22D3EE]",
      dot:   "#10b981",
    },
    muted: {
      chip:  "border-white/10 bg-white/[0.04] text-[#8ca3c4]",
      icon:  "border-white/10 bg-white/[0.04] text-[#8ca3c4]",
      glow:  "",
      bar:   "from-[#1e3a5f] to-[#2d4d7a]",
      dot:   "#4b6487",
    },
  };
  return map[tone];
}

// ─── Nav items ─────────────────────────────────────────────────────────────────

const NAV_ITEMS: { label: string; icon: LucideIcon; href?: string; active?: boolean }[] = [
  { label: "لوحة التحكم",    icon: LayoutDashboard, href: "/dashboard" },
  { label: "ذكاء الأعمال",   icon: Radar,           href: "/dashboard/neon-intelligence-preview", active: true },
  { label: "العملاء",         icon: Target,           href: "/clients" },
  { label: "المشاريع",        icon: BriefcaseBusiness },
  { label: "المهام",          icon: CheckCircle2,    href: "/tasks" },
  { label: "الفريق",          icon: Users,            href: "/employees" },
  { label: "المالية",         icon: CircleDollarSign, href: "/finance" },
  { label: "التقارير",        icon: BarChart3,        href: "/reports" },
  { label: "المكتب الافتراضي",icon: Building2,        href: "/virtual-office" },
  { label: "الأتمتة",         icon: Zap,              href: "/automation" },
  { label: "الاشتراك",        icon: CreditCard },
  { label: "الدعم",           icon: Headphones },
  { label: "الإعدادات",       icon: Settings,         href: "/settings" },
];

function todayLabel() {
  return new Intl.DateTimeFormat("ar-SA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

// ─── Primitive components ───────────────────────────────────────────────────────

function GlassPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[#006BB6]/18 bg-[#061128]/80 shadow-[0_16px_48px_rgba(0,0,0,.38)] backdrop-blur-xl",
        className,
      )}
    >
      {/* Top edge accent */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-[#22D3EE]/40 to-transparent" />
      {children}
    </section>
  );
}

function Chip({ children, tone = "muted" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none", toneMap(tone).chip)}>
      {children}
    </span>
  );
}

function IconOrb({ icon: Icon, tone = "cyan" }: { icon: LucideIcon; tone?: Tone }) {
  return (
    <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl border", toneMap(tone).icon, toneMap(tone).glow)}>
      <Icon size={17} strokeWidth={1.7} />
    </span>
  );
}

// ─── Theme Switcher ─────────────────────────────────────────────────────────────

const THEMES = [
  { label: "لوحة التحكم الأصلية",       href: "/dashboard" },
  { label: "Executive Blue",             href: "/dashboard/executive-blue-preview" },
  { label: "Neon Intelligence (الحالي)", href: "/dashboard/neon-intelligence-preview" },
];

function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-[#006BB6]/25 bg-[#002DA7]/15 px-3.5 py-2 text-[12px] font-semibold text-[#93c5fd] transition hover:border-[#22D3EE]/35 hover:bg-[#002DA7]/25 focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30"
      >
        <Palette size={14} />
        تغيير الثيم
        <ChevronDown size={13} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-60 overflow-hidden rounded-xl border border-[#006BB6]/25 bg-[#061128]/95 shadow-[0_16px_44px_rgba(0,0,0,.50)] backdrop-blur-xl">
          {THEMES.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 border-b border-white/[0.05] px-4 py-3 text-[12.5px] font-medium text-[#cbd5e1] transition last:border-0 hover:bg-[#002DA7]/20 hover:text-white"
            >
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#22D3EE]" />
              {t.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modal ──────────────────────────────────────────────────────────────────────

function BrandModal({ title, onClose }: { title: string | null; onClose: () => void }) {
  if (!title) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#020817]/80 px-3 pb-3 pt-16 backdrop-blur-md sm:items-center sm:p-6"
      dir="rtl"
    >
      <section className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[#006BB6]/30 bg-[radial-gradient(circle_at_18%_-8%,rgba(0,45,167,.35),transparent_38%),radial-gradient(circle_at_82%_14%,rgba(34,211,238,.14),transparent_34%),linear-gradient(160deg,rgba(6,17,40,.97),rgba(2,8,23,.99))] shadow-[0_28px_80px_rgba(0,0,0,.55)]">
        <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-[#002DA7]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-8 h-48 w-48 rounded-full bg-[#22D3EE]/08 blur-3xl" />
        <div className="h-px bg-gradient-to-l from-transparent via-[#006BB6] to-transparent" />
        <div className="relative z-10 flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-4">
          <div>
            <Chip tone="blue">قيد التجهيز</Chip>
            <h2 className="mt-3 text-xl font-black text-white">{title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-[#8ca3c4]">
              الميزة قيد التجهيز. هذه معاينة قراءة فقط ولا تُنفَّذ أي عملية أو تعديل على البيانات.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 text-[#8ca3c4] transition hover:border-[#22D3EE]/30 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30"
            aria-label="إغلاق"
          >
            <X size={17} />
          </button>
        </div>
        <div className="relative z-10 px-5 py-5">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 text-[13.5px] leading-relaxed text-[#e2e8f0]">
            الميزة قيد التجهيز — سيتم تفعيلها في مرحلة قادمة.
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Sidebar ────────────────────────────────────────────────────────────────────

function Sidebar({
  routeSet,
  userName,
  roleLabel,
}: {
  routeSet: Set<string>;
  userName: string;
  roleLabel: string;
}) {
  return (
    <aside className="hidden h-[calc(100dvh-24px)] w-[272px] shrink-0 lg:sticky lg:top-3 lg:block">
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#006BB6]/20 bg-[#061128]/90 shadow-[0_20px_64px_rgba(0,0,0,.40),0_0_36px_rgba(0,45,167,.12)] backdrop-blur-xl">

        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-white/[0.05] px-4 py-4">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[#002DA7] via-[#006BB6] to-[#22D3EE] text-base font-black text-white shadow-[0_0_28px_rgba(0,107,182,.30)]">
            B
          </div>
          <div>
            <div className="text-[15px] font-black text-white">Blumark24</div>
            <div className="text-[10.5px] text-[#5b7fa8]">Business Intelligence</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
          <div className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const enabled = item.active || (item.href ? routeSet.has(item.href) : false);
              const Icon = item.icon;
              const inner = (
                <>
                  {item.active && (
                    <span className="absolute right-0 top-1.5 h-[calc(100%-12px)] w-[3px] rounded-full bg-gradient-to-b from-[#22D3EE] to-[#006BB6]" />
                  )}
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        item.active ? "text-[#22D3EE]" : enabled ? "text-[#5b7fa8] group-hover:text-[#93c5fd]" : "text-[#334d6e]",
                      )}
                    />
                    <span className="truncate text-[13px]">{item.label}</span>
                  </span>
                  {!enabled && <Lock size={12} className="text-[#2d4460]" />}
                </>
              );

              const cls = cn(
                "group relative flex min-h-10 items-center justify-between gap-2 rounded-xl border px-2.5 py-2 transition",
                item.active
                  ? "border-[#006BB6]/30 bg-gradient-to-l from-[#002DA7]/30 via-[#006BB6]/10 to-transparent font-bold text-white"
                  : enabled
                  ? "border-transparent text-[#7ea3c7] hover:border-white/[0.06] hover:bg-white/[0.04] hover:text-white"
                  : "cursor-not-allowed border-transparent text-[#334d6e]",
              );

              if (item.href && enabled) return <Link key={item.label} href={item.href} className={cls}>{inner}</Link>;
              return <button key={item.label} type="button" disabled className={cls}>{inner}</button>;
            })}
          </div>
        </nav>

        {/* User */}
        <div className="border-t border-white/[0.05] p-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#002DA7] to-[#006BB6] text-[13px] font-black text-white">
              {userName.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-bold text-white">{userName}</div>
              <div className="truncate text-[10.5px] text-[#5b7fa8]">{roleLabel}</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── KPI Card ───────────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: Tone;
}) {
  const hasData = value !== "—";
  return (
    <GlassPanel className="p-4">
      <div className="mb-4 flex items-start justify-between gap-2">
        <IconOrb icon={icon} tone={tone} />
        <Chip tone={hasData ? tone : "muted"}>{hasData ? "مباشر" : "لا توجد بيانات"}</Chip>
      </div>
      <div
        className="text-[32px] font-black leading-none tracking-tight"
        style={{ color: hasData ? toneMap(tone).dot : "#4b6487" }}
      >
        {value}
      </div>
      <div className="mt-2 text-[13px] font-bold text-[#d1dff0]">{label}</div>
      <div className="mt-1 text-[11.5px] leading-relaxed text-[#5b7fa8]">{detail}</div>
    </GlassPanel>
  );
}

// ─── Performance Chart ─────────────────────────────────────────────────────────

function PerformanceChart({ data }: { data: { label: string; value: number; tone: Tone }[] }) {
  const hasData = data.some((d) => d.value > 0);
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <GlassPanel className="p-5">
      {/* subtle grid */}
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(0,107,182,.10)_1px,transparent_1px),linear-gradient(90deg,rgba(0,107,182,.10)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="relative z-10 mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Chip tone="blue">مؤشرات تشغيلية</Chip>
          <h2 className="mt-2.5 text-[18px] font-black text-white">أداء المنشأة</h2>
          <p className="mt-1 text-[12px] text-[#5b7fa8]">بيانات حقيقية فقط — لا توجد مؤشرات وهمية.</p>
        </div>
        <IconOrb icon={LineChart} tone="cyan" />
      </div>

      {hasData ? (
        <div className="relative z-10 flex h-[260px] items-end gap-2.5 rounded-xl border border-white/[0.07] bg-[#020817]/50 px-4 py-4">
          {data.map((item) => (
            <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex w-full flex-1 items-end">
                <div
                  className={cn("mx-auto w-full max-w-[52px] rounded-t-xl bg-gradient-to-t", toneMap(item.tone).bar)}
                  style={{ height: `${Math.max(8, (item.value / max) * 100)}%` }}
                />
              </div>
              <div className="text-center">
                <div className="text-[11px] font-bold text-white">{item.value}</div>
                <div className="mt-0.5 truncate text-[9.5px] text-[#5b7fa8]">{item.label}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="relative z-10 grid h-[260px] place-items-center rounded-xl border border-dashed border-[#1e3a5f] bg-[#020817]/40 text-center">
          <div>
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl border border-[#006BB6]/20 bg-[#002DA7]/15 text-[#60a5fa]">
              <Gauge size={22} />
            </div>
            <div className="text-[14px] font-bold text-white">ستظهر المؤشرات عند توفر بيانات فعلية</div>
            <div className="mt-1 text-[12px] text-[#5b7fa8]">لا توجد بيانات تشغيلية كافية للرسم حالياً.</div>
          </div>
        </div>
      )}
    </GlassPanel>
  );
}

// ─── Watchlist ──────────────────────────────────────────────────────────────────

function Watchlist({ rows }: { rows: { label: string; value: string; tone: Tone }[] }) {
  return (
    <GlassPanel className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-black text-white">لمحة سريعة</h2>
        <IconOrb icon={Target} tone="cyan" />
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2"
          >
            <span className="truncate text-[12.5px] font-semibold text-[#d1dff0]">{row.label}</span>
            <Chip tone={row.tone}>{row.value}</Chip>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}

// ─── Operations Status ──────────────────────────────────────────────────────────

function OperationsStatus({
  planLabel,
  orgStatus,
  routeSet,
  onUnavailable,
}: {
  planLabel: string;
  orgStatus: string | null;
  routeSet: Set<string>;
  onUnavailable: (t: string) => void;
}) {
  const sections = [
    { label: "حالة المنشأة", value: orgStatus === "active" ? "نشطة" : orgStatus ? "قيد المتابعة" : "—", tone: (orgStatus === "active" ? "green" : "muted") as Tone },
    { label: "الباقة الحالية", value: planLabel, tone: "blue" as Tone },
    { label: "المكتب الافتراضي", value: routeSet.has("/virtual-office") ? "متاح" : "قيد التجهيز", tone: (routeSet.has("/virtual-office") ? "cyan" : "muted") as Tone },
    { label: "الأتمتة", value: routeSet.has("/automation") ? "متاحة" : "قيد التجهيز", tone: (routeSet.has("/automation") ? "green" : "muted") as Tone },
    { label: "الاشتراك والفوترة", value: "قيد التجهيز", tone: "muted" as Tone, unavailable: "الاشتراك والفوترة" },
    { label: "الدعم الفني", value: "قيد التجهيز", tone: "muted" as Tone, unavailable: "الدعم الفني" },
  ];

  return (
    <GlassPanel className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-black text-white">حالة التشغيل</h2>
          <p className="mt-0.5 text-[11px] text-[#5b7fa8]">نظرة عامة على جاهزية الأقسام.</p>
        </div>
        <IconOrb icon={ShieldCheck} tone={orgStatus === "active" ? "green" : "blue"} />
      </div>
      <div className="space-y-2">
        {sections.map((s) => (
          <div
            key={s.label}
            className={cn(
              "flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2",
              s.unavailable && "cursor-pointer hover:bg-white/[0.04]",
            )}
            onClick={s.unavailable ? () => onUnavailable(s.unavailable!) : undefined}
          >
            <span className="truncate text-[12.5px] text-[#8ca3c4]">{s.label}</span>
            <Chip tone={s.tone}>{s.value}</Chip>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}

// ─── Smart Actions ─────────────────────────────────────────────────────────────

function SmartActions({
  routeSet,
  onUnavailable,
}: {
  routeSet: Set<string>;
  onUnavailable: (title: string) => void;
}) {
  const actions = [
    { label: "العملاء",           href: "/clients",  icon: Target },
    { label: "المهام",             href: "/tasks",    icon: CheckCircle2 },
    { label: "التقارير",           href: "/reports",  icon: BarChart3 },
    { label: "المكتب الافتراضي",  href: "/virtual-office", icon: Building2 },
    { label: "الأتمتة",            href: "/automation", icon: Zap },
    { label: "الاشتراك",           icon: CreditCard },
    { label: "الدعم الفني",        icon: Headphones },
    { label: "الإعدادات",          href: "/settings",  icon: Settings },
  ];

  return (
    <GlassPanel className="p-5">
      <div className="mb-4">
        <h2 className="text-[15px] font-black text-white">إجراءات سريعة</h2>
        <p className="mt-0.5 text-[11px] text-[#5b7fa8]">المتاح يفتح مساره، وغير المتاح يفتح نافذة قراءة فقط.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
        {actions.map((action) => {
          const Icon = action.icon;
          const enabled = action.href ? routeSet.has(action.href) : false;
          const inner = (
            <>
              <IconOrb icon={Icon} tone={enabled ? "cyan" : "muted"} />
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-white">{action.label}</span>
              {enabled
                ? <ChevronLeft size={14} className="text-[#22D3EE] flex-shrink-0" />
                : <Chip tone="muted">قيد التجهيز</Chip>
              }
            </>
          );
          const cls = "flex min-h-[54px] items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-right transition hover:border-[#006BB6]/25 hover:bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/25";

          if (action.href && enabled) return <Link key={action.label} href={action.href} className={cls}>{inner}</Link>;
          return <button key={action.label} type="button" onClick={() => onUnavailable(action.label)} className={cls}>{inner}</button>;
        })}
      </div>
    </GlassPanel>
  );
}

// ─── Digital Twin Mini ─────────────────────────────────────────────────────────

function DigitalTwinMini({ nodes }: { nodes: { label: string; value: string; tone: Tone; icon: LucideIcon }[] }) {
  return (
    <GlassPanel className="p-5">
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_center,rgba(34,211,238,.18)_0,rgba(34,211,238,.06)_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="relative z-10 mb-4 flex items-center justify-between gap-3">
        <div>
          <Chip tone="cyan">Digital Twin</Chip>
          <h2 className="mt-2.5 text-[15px] font-black text-white">خريطة المنشأة</h2>
        </div>
        <IconOrb icon={Network} tone="cyan" />
      </div>
      <div className="relative z-10 grid grid-cols-2 gap-2.5">
        {/* Center hub */}
        <div className="col-span-2 grid min-h-24 place-items-center rounded-xl border border-[#22D3EE]/20 bg-[radial-gradient(circle_at_center,rgba(0,107,182,.22),rgba(0,45,167,.10)_45%,rgba(255,255,255,.02))]">
          <div className="text-center">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[#002DA7] via-[#006BB6] to-[#22D3EE] text-[13px] font-black text-white">
              B
            </div>
            <div className="mt-1.5 text-[12px] font-bold text-white">شركتك</div>
          </div>
        </div>
        {nodes.map((node) => {
          const Icon = node.icon;
          return (
            <div key={node.label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
              <Icon className="mb-2 h-4 w-4 text-[#22D3EE]" />
              <div className="text-[11.5px] font-bold text-white">{node.label}</div>
              <div className="mt-1.5">
                <Chip tone={node.tone}>{node.value}</Chip>
              </div>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}

// ─── Activity Table ─────────────────────────────────────────────────────────────

function ActivityTable({
  rows,
}: {
  rows: { id: string; name: string; type: string; detail: string; status: string; date: string; tone: Tone }[];
}) {
  if (rows.length === 0) {
    return (
      <GlassPanel className="p-5">
        <div className="grid min-h-[200px] place-items-center rounded-xl border border-dashed border-[#1e3a5f] bg-[#020817]/40 text-center">
          <div>
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl border border-[#006BB6]/20 bg-[#002DA7]/15 text-[#60a5fa]">
              <Activity size={21} />
            </div>
            <div className="text-[14px] font-bold text-white">لا توجد بيانات بعد</div>
            <div className="mt-1 text-[12px] text-[#5b7fa8]">ستظهر الأنشطة الفعلية هنا عند توفرها.</div>
          </div>
        </div>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-black text-white">النشاط الأخير</h2>
          <p className="mt-0.5 text-[11px] text-[#5b7fa8]">بيانات حقيقية فقط.</p>
        </div>
        <Chip tone="green">{rows.length} سجل</Chip>
      </div>
      <div className="overflow-hidden rounded-xl border border-white/[0.07]">
        {/* Header — desktop only */}
        <div className="hidden grid-cols-[1.4fr_.6fr_1fr_.7fr_.75fr] gap-3 border-b border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-[11px] font-semibold text-[#5b7fa8] lg:grid">
          <span>العنصر</span><span>النوع</span><span>الوصف</span><span>الحالة</span><span>التاريخ</span>
        </div>
        <div className="divide-y divide-white/[0.05]">
          {rows.map((row) => (
            <div
              key={row.id}
              className="gap-3 px-4 py-3 text-[12.5px] transition hover:bg-white/[0.03] lg:grid lg:grid-cols-[1.4fr_.6fr_1fr_.7fr_.75fr] lg:items-center"
            >
              <div className="min-w-0">
                <div className="truncate font-bold text-white">{row.name}</div>
                <div className="mt-0.5 text-[11px] text-[#5b7fa8] lg:hidden">{row.type} · {row.date}</div>
              </div>
              <div className="hidden text-[#7ea3c7] lg:block">{row.type}</div>
              <div className="hidden truncate text-[#a3bcd8] lg:block">{row.detail}</div>
              <div className="mt-1.5 lg:mt-0"><Chip tone={row.tone}>{row.status}</Chip></div>
              <div className="hidden text-[11px] text-[#5b7fa8] lg:block">{row.date}</div>
            </div>
          ))}
        </div>
      </div>
    </GlassPanel>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────────

export default function NeonIntelligencePreviewPage() {
  const { user, loading: authLoading } = useAuth();
  const { userRole } = usePermissions();
  const { name: companyName } = useTenantCompanyName();
  const { planSlug, organizationStatus, navRoutes, loading: workspaceLoading } = useTenantWorkspace();
  const { data: clients }      = useClients();
  const { data: tasks }        = useTasks();
  const { data: transactions } = useTransactions();
  const { data: employees }    = useEmployees();
  const { data: projects }     = useProjects();
  const { data: activities }   = useActivities();
  const [modalTitle, setModalTitle] = useState<string | null>(null);

  const routeSet = useMemo(
    () => new Set(["/dashboard/neon-intelligence-preview", ...navRoutes.map((r) => r.href)]),
    [navRoutes],
  );
  const role      = userRole ?? (user?.role ? mapAuthRoleToUserRole(user.role) : null);
  const roleLabel = role ? getTenantRoleLabel(role) : "عضو الفريق";
  const userName  = user?.name || user?.email || "المستخدم";
  const planLabel = PLAN_LABELS_AR[planSlug as PlanSlug] ?? "غير متاح";

  // Derived counts — real data only
  const activeClients  = clients.filter((c) => c.status === "نشط" || c.status === "متعاقد").length;
  const activeEmps     = employees.filter((e) => e.status === "نشط").length;
  const openTasks      = tasks.filter((t) => t.status !== "مكتملة").length;
  const activeProjects = projects.filter((p) => p.status === "قيد_التنفيذ").length;
  const income         = transactions.filter((tx) => tx.type === "دخل").reduce((s, tx) => s + tx.amount, 0);
  const expenses       = transactions.filter((tx) => tx.type === "مصروف").reduce((s, tx) => s + tx.amount, 0);
  const net            = income - expenses;

  const kpis = [
    { icon: Target,          label: "العملاء",  value: clients.length     > 0 ? String(clients.length)     : "—", detail: clients.length     > 0 ? `${activeClients} عميل نشط`          : "لا توجد بيانات بعد", tone: (clients.length     > 0 ? "cyan"   : "muted") as Tone },
    { icon: BriefcaseBusiness,label: "المشاريع", value: projects.length    > 0 ? String(projects.length)    : "—", detail: projects.length    > 0 ? `${activeProjects} مشروع مفتوح`       : "لا توجد بيانات بعد", tone: (projects.length    > 0 ? "blue"   : "muted") as Tone },
    { icon: CheckCircle2,    label: "المهام",   value: tasks.length       > 0 ? String(openTasks)          : "—", detail: tasks.length       > 0 ? "مهام جارية أو غير مكتملة"           : "لا توجد بيانات بعد", tone: (tasks.length       > 0 ? "green"  : "muted") as Tone },
    { icon: CircleDollarSign,label: "المالية",  value: transactions.length > 0 ? `${formatCurrency(net)} SAR` : "—", detail: transactions.length > 0 ? "صافي الدخل الفعلي"                : "لا توجد بيانات بعد", tone: (transactions.length > 0 ? "cyan"   : "muted") as Tone },
    { icon: Users,           label: "الفريق",   value: employees.length   > 0 ? String(activeEmps)         : "—", detail: employees.length   > 0 ? "أعضاء نشطون في مساحة العمل"         : "لا توجد بيانات بعد", tone: (employees.length   > 0 ? "green"  : "muted") as Tone },
    { icon: BarChart3,       label: "التقارير", value: routeSet.has("/reports") ? "متاحة" : "—",                  detail: "تقارير مجدولة وتحليلية",                                         tone: (routeSet.has("/reports") ? "blue" : "muted") as Tone },
  ];

  const chartData = [
    { label: "عملاء",   value: clients.length,      tone: "cyan"   as Tone },
    { label: "مشاريع",  value: projects.length,     tone: "blue"   as Tone },
    { label: "مهام",    value: tasks.length,        tone: "green"  as Tone },
    { label: "فريق",    value: employees.length,    tone: "cyan"   as Tone },
    { label: "أنشطة",   value: activities.length,   tone: "blue"   as Tone },
    { label: "معاملات", value: transactions.length, tone: "orange" as Tone },
  ];

  const watchRows = [
    { label: "العملاء النشطون",    value: clients.length     > 0 ? `${activeClients}/${clients.length}`    : "لا توجد بيانات", tone: (clients.length     > 0 ? "cyan"  : "muted") as Tone },
    { label: "المشاريع المفتوحة", value: projects.length    > 0 ? `${activeProjects}/${projects.length}`  : "لا توجد بيانات", tone: (projects.length    > 0 ? "blue"  : "muted") as Tone },
    { label: "المهام الجارية",    value: tasks.length       > 0 ? String(openTasks)                       : "لا توجد بيانات", tone: (tasks.length       > 0 ? "green" : "muted") as Tone },
    { label: "الفريق النشط",       value: employees.length   > 0 ? String(activeEmps)                      : "لا توجد بيانات", tone: (employees.length   > 0 ? "cyan"  : "muted") as Tone },
    { label: "أنشطة مسجلة",       value: activities.length  > 0 ? String(activities.length)               : "لا توجد بيانات", tone: (activities.length  > 0 ? "blue"  : "muted") as Tone },
  ];

  const twinNodes = [
    { label: "العملاء",    value: clients.length     > 0 ? String(clients.length)  : "—", tone: (clients.length     > 0 ? "cyan"  : "muted") as Tone, icon: Target },
    { label: "الفريق",     value: employees.length   > 0 ? String(activeEmps)      : "—", tone: (employees.length   > 0 ? "green" : "muted") as Tone, icon: Users },
    { label: "المالية",    value: transactions.length > 0 ? "نشطة"                 : "—", tone: (transactions.length > 0 ? "cyan"  : "muted") as Tone, icon: WalletCards },
    { label: "التقارير",   value: routeSet.has("/reports") ? "متاحة"               : "—", tone: (routeSet.has("/reports") ? "blue" : "muted") as Tone, icon: BarChart3 },
    { label: "الدعم",      value: "قيد التجهيز",                                          tone: "muted" as Tone,                                         icon: Headphones },
    { label: "الذكاء",     value: "قيد التجهيز",                                          tone: "muted" as Tone,                                         icon: Sparkles },
  ];

  const activityRows = useMemo(() => {
    if (activities.length > 0) {
      return activities.slice(0, 8).map((a) => ({
        id: a.id, name: a.description, type: a.type, detail: a.description,
        status: "نشاط", date: timeAgo(a.timestamp), tone: "cyan" as Tone,
      }));
    }
    return transactions.slice(0, 8).map((tx) => ({
      id: tx.id, name: tx.category || tx.description || "معاملة",
      type: tx.type, detail: `${formatCurrency(tx.amount)} SAR`,
      status: "مسجلة", date: timeAgo(tx.date),
      tone: (tx.type === "دخل" ? "green" : "orange") as Tone,
    }));
  }, [activities, transactions]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (authLoading || workspaceLoading) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#020817] p-4 text-white" dir="rtl">
        <GlassPanel className="w-full max-w-md p-10 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-xl bg-[#002DA7]/30" />
          <div className="text-[13px] text-[#5b7fa8]">جاري تحميل لوحة التحكم...</div>
        </GlassPanel>
      </main>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#020817] text-[#e2eaf5]" dir="rtl">

      {/* ── Background ── */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_72%_-10%,rgba(0,45,167,.38),transparent_38%),radial-gradient(ellipse_at_14%_30%,rgba(34,211,238,.10),transparent_28%),radial-gradient(ellipse_at_50%_80%,rgba(0,107,182,.12),transparent_30%),linear-gradient(160deg,#020817,#061128_55%,#020817)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(0,107,182,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(0,107,182,.14)_1px,transparent_1px)] [background-size:52px_52px]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-40 bg-gradient-to-b from-[#002DA7]/10 to-transparent" />

      <BrandModal title={modalTitle} onClose={() => setModalTitle(null)} />

      {/* ── Layout ── */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1560px] gap-4 p-3 pb-28 sm:p-4 lg:pb-4">

        <Sidebar routeSet={routeSet} userName={userName} roleLabel={roleLabel} />

        <div className="min-w-0 flex-1 space-y-4">

          {/* ── Header ── */}
          <GlassPanel className="px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

              {/* Left: branding + user info */}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Chip tone="blue">معاينة اختيارية · لا تغيّر لوحة التحكم الأساسية</Chip>
                  <ThemeSwitcher />
                </div>
                <h1 className="text-[26px] font-black tracking-tight text-white sm:text-[32px] lg:text-[40px]">
                  Blumark24{" "}
                  <span
                    className="bg-gradient-to-l from-[#22D3EE] via-[#006BB6] to-[#002DA7] bg-clip-text text-transparent"
                  >
                    Intelligence OS
                  </span>
                </h1>
                <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-[#5b7fa8]">
                  مركز تشغيل ذكي — قراءة أداء المنشأة في الوقت الفعلي، بيانات حقيقية فقط.
                </p>
              </div>

              {/* Right: meta cards */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:w-[440px] xl:grid-cols-2 xl:gap-2">
                {[
                  { key: "المنشأة",  val: companyName || "—" },
                  { key: "الباقة",   val: planLabel },
                  { key: "اليوم",    val: todayLabel() },
                  { key: "المستخدم", val: roleLabel },
                ].map(({ key, val }) => (
                  <div key={key} className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
                    <div className="text-[10.5px] text-[#4b6487]">{key}</div>
                    <div className="mt-0.5 truncate text-[12.5px] font-bold text-white">{val}</div>
                  </div>
                ))}
              </div>
            </div>
          </GlassPanel>

          {/* ── KPI Grid ── */}
          {/* 1-col → 2-col sm → 3-col lg → 6-col xl */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
          </section>

          {/* ── Row 2: Chart + Watchlist + Status ── */}
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <PerformanceChart data={chartData} />
            <Watchlist rows={watchRows} />
            <OperationsStatus
              planLabel={planLabel}
              orgStatus={organizationStatus}
              routeSet={routeSet}
              onUnavailable={setModalTitle}
            />
          </section>

          {/* ── Row 3: Actions + Activity + Twin ── */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)_300px]">
            <SmartActions routeSet={routeSet} onUnavailable={setModalTitle} />
            <ActivityTable rows={activityRows} />
            <DigitalTwinMini nodes={twinNodes} />
          </section>

        </div>
      </div>

      {/* ── Bottom Nav (mobile/tablet only) ── */}
      <nav
        className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-[#006BB6]/20 bg-[#061128]/90 px-2 py-2 shadow-[0_16px_48px_rgba(0,0,0,.44)] backdrop-blur-xl lg:hidden"
        dir="rtl"
      >
        <div className="grid grid-cols-5 gap-1">
          {[
            { label: "ذكاء", icon: Radar, active: true },
            { label: "عملاء",  icon: Target,      href: "/clients" },
            { label: "مهام",   icon: CheckCircle2, href: "/tasks" },
            { label: "تقارير", icon: BarChart3,    href: "/reports" },
            { label: "إعدادات",icon: Settings,     href: "/settings" },
          ].map((item) => {
            const Icon = item.icon;
            const enabled = item.active || (item.href ? routeSet.has(item.href) : false);
            const cls = cn(
              "flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl transition",
              item.active
                ? "bg-[#002DA7]/20 text-white shadow-[0_0_16px_rgba(0,107,182,.16)]"
                : enabled ? "text-[#5b7fa8] hover:text-white" : "text-[#2d4460] opacity-50",
            );
            const inner = (
              <>
                <Icon size={18} className={item.active ? "text-[#22D3EE]" : ""} />
                <span className="text-[9.5px] font-semibold">{item.label}</span>
              </>
            );
            if (item.href && enabled) return <Link key={item.label} href={item.href} className={cls}>{inner}</Link>;
            return <button key={item.label} type="button" disabled className={cls}>{inner}</button>;
          })}
        </div>
      </nav>
    </main>
  );
}
