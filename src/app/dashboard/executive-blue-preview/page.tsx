"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Activity,
  BadgeCheck,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileText,
  Headphones,
  LayoutDashboard,
  Lock,
  Mail,
  Map,
  MessageCircle,
  Network,
  Receipt,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  UserPlus,
  Users,
  WalletCards,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { mapAuthRoleToUserRole, usePermissions } from "@/contexts/PermissionsContext";
import { useTenantWorkspace } from "@/contexts/TenantWorkspaceContext";
import { useActivities, useClients, useEmployees, useProjects, useTasks, useTransactions } from "@/hooks/useData";
import { useProfileOrgDepartment } from "@/hooks/useProfileOrgDepartment";
import { useTenantCompanyName } from "@/hooks/useTenantCompanyName";
import { PLAN_LABELS_AR, type PlanSlug } from "@/lib/features/packageFeatures";
import { getTenantRoleLabel } from "@/lib/tenant/tenantDisplay";
import { cn, formatCurrency, timeAgo } from "@/lib/utils";
import type { Activity as ActivityRow, Transaction } from "@/types";

type StatusTone = "success" | "warning" | "danger" | "info" | "muted";

const ARABIC_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

const sidebarItems: {
  label: string;
  icon: LucideIcon;
  href?: string;
  active?: boolean;
}[] = [
  { label: "الرئيسية", icon: LayoutDashboard, href: "/dashboard/executive-blue-preview", active: true },
  { label: "العملاء", icon: Target, href: "/clients" },
  { label: "المشاريع", icon: BriefcaseBusiness },
  { label: "المهام", icon: CheckCircle2, href: "/tasks" },
  { label: "الفريق", icon: Users, href: "/employees" },
  { label: "التقارير", icon: BarChart3, href: "/reports" },
  { label: "المالية", icon: CircleDollarSign, href: "/finance" },
  { label: "المكتب الافتراضي", icon: Building2, href: "/virtual-office" },
  { label: "الاستراتيجية", icon: Map, href: "/strategy" },
  { label: "الأتمتة", icon: Zap, href: "/automation" },
  { label: "الاشتراك", icon: CreditCard },
  { label: "الإعدادات", icon: Settings, href: "/settings" },
  { label: "الدعم", icon: Headphones },
];

function todayArabic() {
  const d = new Date();
  return `${d.getDate()} ${ARABIC_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function organizationStatusLabel(status: string | null): { label: string; tone: StatusTone; detail: string } {
  if (status === "active") {
    return {
      label: "المنشأة نشطة",
      tone: "success",
      detail: "تم تحميل حالة المنشأة من سياق مساحة العمل الحالية.",
    };
  }
  if (status === "trial") {
    return {
      label: "المنشأة قيد المراجعة",
      tone: "info",
      detail: "تظهر المنشأة في وضع تجريبي حسب الحالة الحالية.",
    };
  }
  if (status === "suspended") {
    return {
      label: "المنشأة معلقة",
      tone: "warning",
      detail: "تحتاج الحالة إلى مراجعة من صاحب الصلاحية.",
    };
  }
  if (status === "cancelled") {
    return {
      label: "المنشأة غير نشطة",
      tone: "danger",
      detail: "الحالة الحالية غير نشطة حسب البيانات المتاحة.",
    };
  }
  return {
    label: "غير متاح",
    tone: "muted",
    detail: "لا توجد حالة منشأة متاحة بعد.",
  };
}

function StatusPill({ children, tone = "muted" }: { children: ReactNode; tone?: StatusTone }) {
  const styles: Record<StatusTone, string> = {
    success: "border-emerald-300/25 bg-emerald-400/10 text-emerald-200",
    warning: "border-amber-300/25 bg-amber-400/10 text-amber-200",
    danger: "border-rose-300/25 bg-rose-400/10 text-rose-200",
    info: "border-cyan-300/25 bg-cyan-400/10 text-cyan-100",
    muted: "border-white/[0.10] bg-white/[0.045] text-[#9DB4D3]",
  };

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold", styles[tone])}>
      {children}
    </span>
  );
}

function GlassCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[28px] border border-[rgba(148,190,255,0.16)] bg-[rgba(13,35,68,0.58)] shadow-[0_24px_70px_rgba(2,8,23,.32)] backdrop-blur-xl",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-l from-transparent via-cyan-200/35 to-transparent" />
      {children}
    </section>
  );
}

function IconBubble({ icon: Icon, active = false }: { icon: LucideIcon; active?: boolean }) {
  return (
    <span
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-2xl border",
        active
          ? "border-cyan-200/30 bg-cyan-300/15 text-cyan-100 shadow-[0_0_26px_rgba(34,211,238,.22)]"
          : "border-white/[0.08] bg-white/[0.045] text-[#9DB4D3]",
      )}
    >
      <Icon size={17} strokeWidth={1.7} />
    </span>
  );
}

function ReadOnlyModal({
  open,
  title,
  onClose,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#020817]/70 px-3 pb-3 pt-16 backdrop-blur-md sm:items-center sm:p-6" dir="rtl">
      <section className="relative w-full max-w-xl overflow-hidden rounded-[28px] border border-cyan-200/20 bg-[radial-gradient(circle_at_18%_0%,rgba(34,211,238,.16),transparent_34%),radial-gradient(circle_at_86%_18%,rgba(37,99,235,.18),transparent_32%),linear-gradient(145deg,rgba(8,23,44,.96),rgba(3,11,24,.98))] shadow-[0_30px_90px_rgba(2,8,23,.55)]">
        <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-[#2563EB]/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-10 h-56 w-56 rounded-full bg-[#22D3EE]/12 blur-3xl" />
        <div className="h-px bg-gradient-to-l from-transparent via-[#22D3EE] to-transparent" />
        <div className="relative z-10 flex items-start justify-between gap-4 border-b border-white/[0.08] px-5 py-4">
          <div>
            <StatusPill tone="warning">Smart Window · قيد التجهيز</StatusPill>
            <h2 className="mt-3 text-xl font-bold text-[#F8FAFC]">{title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-[#9DB4D3]">
              هذه نافذة قراءة فقط لعرض تجربة Blumark24 Smart Operations OS. لا توجد أي عملية دفع أو تحويل أو تعديل بيانات.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/[0.10] text-[#9DB4D3] transition hover:border-cyan-200/30 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300/35"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>
        <div className="relative z-10 px-5 py-5">
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.04] p-4 text-sm leading-relaxed text-[#D9E6F7]">
            الإجراء قيد التجهيز
          </div>
        </div>
      </section>
    </div>
  );
}

function Sidebar({
  routeSet,
  userName,
  roleLabel,
  planLabel,
}: {
  routeSet: Set<string>;
  userName: string;
  roleLabel: string;
  planLabel: string;
}) {
  return (
    <aside className="hidden h-[calc(100dvh-32px)] w-[294px] shrink-0 lg:sticky lg:top-4 lg:block">
      <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-cyan-200/15 bg-[rgba(8,23,44,.64)] p-3 shadow-[0_24px_70px_rgba(2,8,23,.32),0_0_50px_rgba(34,211,238,.08)] backdrop-blur-xl">
        <div className="mb-3 flex items-center gap-3 px-2 py-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#22D3EE] text-lg font-black text-white shadow-[0_0_32px_rgba(34,211,238,.22)]">
            B
          </div>
          <div>
            <div className="text-base font-extrabold tracking-wide text-white">Blumark24 OS</div>
            <div className="text-[11px] text-[#9DB4D3]">Executive Blue Banking</div>
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto pl-1 pr-0">
          <div className="space-y-1.5">
            {sidebarItems.map((item) => {
              const isEnabled = item.active || (item.href ? routeSet.has(item.href) : false);
              const Icon = item.icon;
              const className = cn(
                "group relative flex min-h-11 items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-right text-[13px] transition",
                item.active
                  ? "border-cyan-200/20 bg-gradient-to-l from-[#2563EB]/28 via-[#2563EB]/12 to-transparent text-white shadow-[0_0_28px_rgba(34,211,238,.12)]"
                  : isEnabled
                    ? "border-transparent text-[#9DB4D3] hover:border-white/[0.08] hover:bg-white/[0.045] hover:text-white"
                    : "cursor-not-allowed border-transparent text-[#5F7595]",
              );
              const content = (
                <>
                  {item.active && <span className="absolute right-0 top-2 h-[calc(100%-16px)] w-1 rounded-full bg-[#22D3EE] shadow-[0_0_18px_rgba(34,211,238,.9)]" />}
                  <span className="flex min-w-0 items-center gap-3">
                    <Icon className={cn("h-4 w-4 shrink-0", item.active ? "text-[#22D3EE]" : isEnabled ? "text-[#9DB4D3] group-hover:text-cyan-200" : "text-[#5F7595]")} />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {!isEnabled && <Lock size={13} />}
                </>
              );

              if (item.href && isEnabled) {
                return (
                  <Link key={item.label} href={item.href} className={className}>
                    {content}
                  </Link>
                );
              }
              return (
                <button key={item.label} type="button" disabled className={className}>
                  {content}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="mt-3 space-y-3 border-t border-white/[0.08] pt-3">
          <div className="flex items-center justify-between rounded-2xl border border-emerald-300/15 bg-emerald-400/10 px-3 py-2.5">
            <div>
              <div className="text-[11px] text-emerald-200/75">الباقة الحالية</div>
              <div className="text-sm font-bold text-white">{planLabel}</div>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[11px] text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-[#22C55E] shadow-[0_0_12px_rgba(34,197,94,.85)]" />
              Growth
            </span>
          </div>

          <div className="flex items-center gap-3 rounded-3xl border border-white/[0.10] bg-white/[0.045] p-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#22D3EE] text-sm font-bold text-white">
              {userName.slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-white">{userName}</div>
              <div className="truncate text-[11px] text-[#9DB4D3]">{roleLabel}</div>
            </div>
            <ChevronDown size={15} className="text-[#9DB4D3]" />
          </div>
        </div>
      </div>
    </aside>
  );
}

function ServiceRow({
  icon,
  title,
  subtitle,
  status,
  tone,
  href,
  enabled,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  status: string;
  tone: StatusTone;
  href?: string;
  enabled?: boolean;
}) {
  const content = (
    <>
      <IconBubble icon={icon} active={enabled} />
      <div className="min-w-0 flex-1">
        <div className="font-bold text-white">{title}</div>
        <div className="mt-1 truncate text-xs text-[#9DB4D3]">{subtitle}</div>
      </div>
      <StatusPill tone={tone}>{status}</StatusPill>
      {enabled ? <ChevronLeft size={16} className="text-cyan-200" /> : <Lock size={15} className="text-[#6D82A2]" />}
    </>
  );

  const className =
    "flex min-h-[74px] items-center gap-3 rounded-3xl border border-white/[0.08] bg-white/[0.045] px-3 py-3 text-right transition hover:border-cyan-200/20 hover:bg-white/[0.065] focus:outline-none focus:ring-2 focus:ring-cyan-300/30";

  if (href && enabled) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <div className={cn(className, "hover:border-white/[0.08] hover:bg-white/[0.045]")}>
      {content}
    </div>
  );
}

function OperationSignalCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: StatusTone;
}) {
  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.045] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <IconBubble icon={Icon} active={tone !== "muted"} />
        <StatusPill tone={tone}>{tone === "muted" ? "لا توجد بيانات بعد" : "تشغيل"}</StatusPill>
      </div>
      <div className="text-3xl font-black text-white">{value}</div>
      <div className="mt-2 text-sm font-bold text-[#D9E6F7]">{label}</div>
      <div className="mt-1 text-xs leading-relaxed text-[#9DB4D3]">{detail}</div>
    </div>
  );
}

function DigitalTwinMapCard({
  companyName,
  readiness,
  nodes,
}: {
  companyName: string;
  readiness: number;
  nodes: { label: string; value: string; tone: StatusTone; icon: LucideIcon }[];
}) {
  return (
    <GlassCard className="min-h-[430px] p-5">
      <div className="pointer-events-none absolute inset-0 opacity-55 [background-image:linear-gradient(rgba(148,190,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,190,255,.08)_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#2563EB]/18 blur-3xl" />
      <div className="pointer-events-none absolute left-8 top-8 h-56 w-56 rounded-full bg-[#2563EB]/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-8 right-12 h-48 w-48 rounded-full bg-[#22D3EE]/12 blur-3xl" />

      <div className="relative z-10 mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <StatusPill tone="info">Digital Twin</StatusPill>
          <h2 className="mt-3 text-xl font-black text-white">خريطة التشغيل الذكية</h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-[#9DB4D3]">
            تحويل فكرة خريطة التوصيل إلى محاكاة منشأة: كل نقطة تمثل جزءاً فعلياً من تشغيل Blumark24 OS.
          </p>
        </div>
        <div className="rounded-2xl border border-cyan-200/15 bg-cyan-300/10 px-4 py-3 text-left">
          <div className="text-[11px] text-cyan-100/75">جاهزية التشغيل</div>
          <div className="mt-1 text-2xl font-black text-white">{readiness}%</div>
        </div>
      </div>

      <div className="relative z-10 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="relative min-h-[300px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-[radial-gradient(circle_at_52%_40%,rgba(37,99,235,.18),transparent_36%),linear-gradient(145deg,rgba(6,20,38,.82),rgba(3,11,24,.78))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]">
          <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_center,rgba(34,211,238,.22)_0,rgba(34,211,238,.12)_1px,transparent_1px)] [background-size:28px_28px]" />
          <div className="absolute inset-x-8 top-1/2 hidden h-px -translate-y-1/2 bg-gradient-to-l from-transparent via-cyan-200/35 to-transparent sm:block" />
          <div className="absolute inset-y-8 right-1/2 hidden w-px translate-x-1/2 bg-gradient-to-b from-transparent via-blue-300/25 to-transparent sm:block" />

          <div className="grid h-full min-h-[270px] grid-cols-2 gap-3 sm:grid-cols-3">
            {nodes.slice(0, 2).map((node) => {
              const Icon = node.icon;
              return (
                <div key={node.label} className="relative rounded-[22px] border border-white/[0.08] bg-white/[0.045] p-3">
                  <Icon className="mb-3 h-5 w-5 text-cyan-200" />
                  <div className="text-sm font-bold text-white">{node.label}</div>
                  <div className="mt-1 text-xs text-[#9DB4D3]">{node.value}</div>
                  <div className="mt-3"><StatusPill tone={node.tone}>{node.tone === "muted" ? "غير متاح" : "نشط"}</StatusPill></div>
                </div>
              );
            })}

            <div className="relative col-span-2 grid place-items-center rounded-[28px] border border-cyan-200/20 bg-[radial-gradient(circle_at_50%_32%,rgba(34,211,238,.24),rgba(37,99,235,.13)_38%,rgba(255,255,255,.04))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_0_44px_rgba(37,99,235,.16)] sm:col-span-1 sm:row-span-2">
              <div className="absolute inset-6 rounded-full border border-cyan-200/15" />
              <div className="absolute inset-12 rounded-full border border-blue-300/10" />
              <div className="absolute inset-20 rounded-full border border-white/[0.06]" />
              <div className="relative z-10 text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-[24px] bg-gradient-to-br from-[#2563EB] to-[#22D3EE] text-xl font-black text-white shadow-[0_0_42px_rgba(34,211,238,.28)]">
                  B
                </div>
                <div className="mt-4 text-lg font-black text-white">{companyName}</div>
                <div className="mt-1 text-xs text-[#9DB4D3]">مركز المنشأة</div>
              </div>
            </div>

            {nodes.slice(2).map((node) => {
              const Icon = node.icon;
              return (
                <div key={node.label} className="relative rounded-[22px] border border-white/[0.08] bg-white/[0.045] p-3">
                  <Icon className="mb-3 h-5 w-5 text-cyan-200" />
                  <div className="text-sm font-bold text-white">{node.label}</div>
                  <div className="mt-1 text-xs text-[#9DB4D3]">{node.value}</div>
                  <div className="mt-3"><StatusPill tone={node.tone}>{node.tone === "muted" ? "غير متاح" : "نشط"}</StatusPill></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          {nodes.map((node) => (
            <div key={node.label} className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5">
              <span className="text-xs font-semibold text-[#D9E6F7]">{node.label}</span>
              <StatusPill tone={node.tone}>{node.value}</StatusPill>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}

function TransactionRows({
  transactions,
  activities,
}: {
  transactions: Transaction[];
  activities: ActivityRow[];
}) {
  const rows = useMemo(() => {
    if (transactions.length > 0) {
      return transactions.slice(0, 6).map((tx) => ({
        id: tx.id,
        name: tx.category || tx.description || "معاملة مالية",
        type: tx.type,
        amount: `${formatCurrency(tx.amount)} SAR`,
        status: "مسجلة",
        date: tx.date,
        tone: tx.type === "دخل" ? "success" as StatusTone : "info" as StatusTone,
      }));
    }

    return activities.slice(0, 6).map((activity) => ({
      id: activity.id,
      name: activity.description,
      type: activity.type,
      amount: activity.description,
      status: "نشاط",
      date: activity.timestamp,
      tone: "muted" as StatusTone,
    }));
  }, [activities, transactions]);

  if (rows.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-white/[0.14] bg-white/[0.035] px-4 py-10 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-cyan-200/15 bg-cyan-300/10 text-cyan-200">
          <Receipt size={20} />
        </div>
        <div className="font-bold text-white">لا توجد معاملات بعد</div>
        <div className="mt-1 text-sm text-[#9DB4D3]">ستظهر المعاملات أو الأنشطة الفعلية هنا عند توفرها.</div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-white/[0.08]">
      <div className="hidden grid-cols-[1.4fr_.7fr_1fr_.7fr_.8fr] gap-3 border-b border-white/[0.08] bg-white/[0.035] px-4 py-3 text-xs font-semibold text-[#9DB4D3] lg:grid">
        <span>المستفيد / النشاط</span>
        <span>النوع</span>
        <span>المبلغ / الوصف</span>
        <span>الحالة</span>
        <span>التاريخ</span>
      </div>
      <div className="divide-y divide-white/[0.07]">
        {rows.map((row) => (
          <div key={row.id} className="grid gap-3 bg-white/[0.025] px-4 py-3 text-sm transition hover:bg-white/[0.045] lg:grid-cols-[1.4fr_.7fr_1fr_.7fr_.8fr] lg:items-center">
            <div className="min-w-0">
              <div className="truncate font-bold text-white">{row.name}</div>
              <div className="mt-1 text-xs text-[#6F86A7] lg:hidden">{row.type}</div>
            </div>
            <div className="hidden text-[#9DB4D3] lg:block">{row.type}</div>
            <div className="truncate text-[#D9E6F7]">{row.amount}</div>
            <div>
              <StatusPill tone={row.tone}>{row.status}</StatusPill>
            </div>
            <div className="text-xs text-[#9DB4D3]">{row.date ? timeAgo(row.date) : "غير متاح"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ExecutiveBluePreviewPage() {
  const { user, loading: authLoading } = useAuth();
  const { userRole } = usePermissions();
  const { name: companyName } = useTenantCompanyName();
  const { display: departmentDisplay } = useProfileOrgDepartment();
  const { planSlug, organizationStatus, navRoutes, loading: workspaceLoading } = useTenantWorkspace();
  const { data: clients, loading: clientsLoading } = useClients();
  const { data: tasks } = useTasks();
  const { data: projects } = useProjects();
  const { data: transactions, loading: transactionsLoading } = useTransactions();
  const { data: employees } = useEmployees();
  const { data: activities, loading: activitiesLoading } = useActivities();
  const [modalTitle, setModalTitle] = useState<string | null>(null);

  const routeSet = useMemo(() => new Set(["/dashboard/executive-blue-preview", ...navRoutes.map((route) => route.href)]), [navRoutes]);
  const role = userRole ?? (user?.role ? mapAuthRoleToUserRole(user.role) : null);
  const roleLabel = role ? getTenantRoleLabel(role) : "عضو الفريق";
  const userName = user?.name || user?.email || "المستخدم";
  const planLabel = PLAN_LABELS_AR[planSlug as PlanSlug] ?? "غير متاح";
  const orgStatus = organizationStatusLabel(organizationStatus);

  const balance = useMemo(() => {
    const income = transactions.filter((tx) => tx.type === "دخل").reduce((sum, tx) => sum + tx.amount, 0);
    const expenses = transactions.filter((tx) => tx.type === "مصروف").reduce((sum, tx) => sum + tx.amount, 0);
    return income - expenses;
  }, [transactions]);

  const readiness = useMemo(() => {
    const checks = [
      Boolean(companyName),
      organizationStatus === "active",
      clients.length > 0,
      employees.length > 0,
      transactions.length > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [clients.length, companyName, employees.length, organizationStatus, transactions.length]);

  const serviceRows = [
    {
      icon: Target,
      title: "العملاء",
      subtitle: clientsLoading ? "جاري تحميل العملاء" : clients.length > 0 ? `${clients.length} عميل من البيانات الفعلية` : "لا توجد بيانات بعد",
      status: routeSet.has("/clients") ? "متاح" : "قيد التجهيز",
      tone: routeSet.has("/clients") ? "success" as StatusTone : "warning" as StatusTone,
      href: "/clients",
      enabled: routeSet.has("/clients"),
    },
    {
      icon: WalletCards,
      title: "المالية",
      subtitle: transactions.length > 0 ? "دخل ومصروفات مسجلة" : "لا توجد بيانات مالية بعد",
      status: routeSet.has("/finance") ? "متاح" : "قيد التجهيز",
      tone: routeSet.has("/finance") ? "success" as StatusTone : "warning" as StatusTone,
      href: "/finance",
      enabled: routeSet.has("/finance"),
    },
    {
      icon: BarChart3,
      title: "التقارير",
      subtitle: "مركز التقارير حسب صلاحيات الباقة",
      status: routeSet.has("/reports") ? "متاح" : "قيد التجهيز",
      tone: routeSet.has("/reports") ? "success" as StatusTone : "warning" as StatusTone,
      href: "/reports",
      enabled: routeSet.has("/reports"),
    },
    {
      icon: Sparkles,
      title: "الخدمات الذكية",
      subtitle: "جاهزية الخدمات تعرض بدون وعود غير مفعلة",
      status: "قيد التجهيز",
      tone: "warning" as StatusTone,
      enabled: false,
    },
  ];

  const quickActions = [
    { label: "تحويل داخلي", icon: Send },
    { label: "تحويل دولي", icon: ArrowLeft },
    { label: "إضافة مستفيد", icon: UserPlus },
    { label: "دفع فاتورة", icon: Receipt },
    { label: "إنشاء حساب", icon: CreditCard },
    { label: "طلب دعم", icon: MessageCircle },
  ];

  const activeClients = clients.filter((client) => client.status === "نشط" || client.status === "متعاقد").length;
  const activeEmployees = employees.filter((employee) => employee.status === "نشط").length;
  const openTasks = tasks.filter((task) => task.status !== "مكتملة").length;
  const activeProjects = projects.filter((project) => project.status === "قيد_التنفيذ").length;

  const twinNodes = [
    {
      label: "المشاريع",
      value: projects.length > 0 ? `${activeProjects}/${projects.length}` : "لا توجد بيانات",
      tone: projects.length > 0 ? "info" as StatusTone : "muted" as StatusTone,
      icon: BriefcaseBusiness,
    },
    {
      label: "المهام",
      value: tasks.length > 0 ? `${openTasks} مفتوحة` : "لا توجد بيانات",
      tone: tasks.length > 0 ? "warning" as StatusTone : "muted" as StatusTone,
      icon: CheckCircle2,
    },
    {
      label: "العملاء",
      value: clients.length > 0 ? `${activeClients}/${clients.length}` : "لا توجد بيانات",
      tone: clients.length > 0 ? "success" as StatusTone : "muted" as StatusTone,
      icon: Target,
    },
    {
      label: "الفريق",
      value: employees.length > 0 ? `${activeEmployees}/${employees.length}` : "لا توجد بيانات",
      tone: employees.length > 0 ? "success" as StatusTone : "muted" as StatusTone,
      icon: Users,
    },
    {
      label: "المالية",
      value: transactions.length > 0 ? "مسجلة" : "لا توجد بيانات",
      tone: transactions.length > 0 ? "info" as StatusTone : "muted" as StatusTone,
      icon: WalletCards,
    },
    {
      label: "التقارير",
      value: routeSet.has("/reports") ? "متاحة" : "قيد التجهيز",
      tone: routeSet.has("/reports") ? "info" as StatusTone : "warning" as StatusTone,
      icon: BarChart3,
    },
  ];

  const operationSignals = [
    {
      icon: BriefcaseBusiness,
      label: "مشاريع التشغيل",
      value: projects.length > 0 ? String(projects.length) : "—",
      detail: projects.length > 0 ? `${activeProjects} مشروع قيد التنفيذ` : "ستظهر المشاريع عند توفر بيانات فعلية.",
      tone: projects.length > 0 ? "info" as StatusTone : "muted" as StatusTone,
    },
    {
      icon: CheckCircle2,
      label: "مسار المهام",
      value: tasks.length > 0 ? String(openTasks) : "—",
      detail: tasks.length > 0 ? "مهام مفتوحة تمثل حالة التشغيل اليومية." : "لا توجد مهام بعد.",
      tone: tasks.length > 0 ? "warning" as StatusTone : "muted" as StatusTone,
    },
    {
      icon: Users,
      label: "فريق العمل",
      value: employees.length > 0 ? String(activeEmployees) : "—",
      detail: employees.length > 0 ? "أعضاء نشطون بدلاً من سائقي التوصيل في المرجع." : "لا توجد بيانات فريق بعد.",
      tone: employees.length > 0 ? "success" as StatusTone : "muted" as StatusTone,
    },
    {
      icon: Activity,
      label: "أنشطة وتقارير",
      value: activities.length > 0 ? String(activities.length) : "—",
      detail: activities.length > 0 ? "آخر الطلبات تحولت إلى نشاط تشغيلي وتقارير." : "لا توجد أنشطة بعد.",
      tone: activities.length > 0 ? "info" as StatusTone : "muted" as StatusTone,
    },
  ];

  if (authLoading || workspaceLoading) {
    return (
      <main className="min-h-dvh bg-[#030B18] p-4 text-white" dir="rtl">
        <div className="mx-auto grid min-h-[calc(100dvh-32px)] max-w-7xl place-items-center rounded-[28px] border border-white/[0.08] bg-white/[0.035]">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-2xl bg-cyan-300/20" />
            <div className="text-sm text-[#9DB4D3]">جاري تحميل المعاينة...</div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="relative min-h-dvh overflow-x-hidden bg-[#030B18] text-[#F8FAFC]"
      dir="rtl"
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_76%_7%,rgba(37,99,235,.42),transparent_31%),radial-gradient(circle_at_12%_22%,rgba(34,211,238,.16),transparent_28%),radial-gradient(circle_at_45%_-10%,rgba(99,102,241,.16),transparent_30%),linear-gradient(145deg,#030B18,#071C38_48%,#020617)]" />
      <div className="pointer-events-none fixed inset-0 opacity-35 [background-image:linear-gradient(rgba(148,190,255,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(148,190,255,.045)_1px,transparent_1px)] [background-size:54px_54px]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-44 bg-gradient-to-b from-[#2563EB]/10 to-transparent" />

      <ReadOnlyModal open={Boolean(modalTitle)} title={modalTitle ?? ""} onClose={() => setModalTitle(null)} />

      <div className="relative z-10 mx-auto flex w-full max-w-[1500px] gap-4 p-3 pb-24 sm:p-4 lg:pb-4">
        <Sidebar routeSet={routeSet} userName={userName} roleLabel={roleLabel} planLabel={planLabel} />

        <div className="min-w-0 flex-1 space-y-4">
          <header className="flex flex-col gap-3 rounded-[28px] border border-white/[0.08] bg-[rgba(8,23,44,.48)] p-3 shadow-[0_18px_56px_rgba(2,8,23,.26)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-black text-white sm:text-3xl">مرحباً، {userName}</h1>
              <p className="mt-1 text-sm text-[#9DB4D3]">هذا يوم رائع لإنجاز المزيد</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden rounded-full border border-white/[0.10] bg-white/[0.045] px-4 py-2 text-xs font-semibold text-[#9DB4D3] sm:block">
                {todayArabic()}
              </div>
              {[Bell, Mail].map((Icon, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setModalTitle(index === 0 ? "الإشعارات" : "الرسائل")}
                  className="grid h-11 w-11 place-items-center rounded-2xl border border-white/[0.10] bg-white/[0.045] text-[#9DB4D3] transition hover:border-cyan-200/25 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  aria-label={index === 0 ? "الإشعارات" : "الرسائل"}
                >
                  <Icon size={18} />
                </button>
              ))}
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#22D3EE] text-sm font-bold text-white">
                {userName.slice(0, 2)}
              </div>
            </div>
          </header>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_420px]">
            <GlassCard className="min-h-[320px] p-5 sm:p-7">
              <div className="pointer-events-none absolute -left-10 -top-16 h-72 w-72 rounded-full bg-[#2563EB]/35 blur-3xl" />
              <div className="pointer-events-none absolute bottom-0 right-10 h-44 w-80 rounded-full bg-[#22D3EE]/10 blur-3xl" />
              <div className="relative z-10 flex h-full flex-col justify-between gap-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <StatusPill tone="info">Blumark24 Smart Operations OS</StatusPill>
                    <h2 className="mt-5 text-lg font-bold text-[#D9E6F7]">إجمالي الرصيد التشغيلي</h2>
                    <div className="mt-3 text-4xl font-black tracking-tight text-white sm:text-6xl">
                      {transactions.length > 0 ? `${formatCurrency(balance)} SAR` : "لا توجد بيانات بعد"}
                    </div>
                    <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#9DB4D3]">
                      {transactions.length > 0
                        ? "محسوب من المعاملات الفعلية فقط: الدخل ناقص المصروفات."
                        : "سيظهر الرصيد عند توفر معاملات مالية فعلية داخل النظام."}
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-white/[0.10] bg-white/[0.055] p-4 text-left">
                    <div className="text-xs text-[#9DB4D3]">الحساب</div>
                    <div className="mt-1 text-lg font-black text-white">{companyName || "غير متاح"}</div>
                    <div className="mt-3 text-xs text-[#9DB4D3]">{departmentDisplay.text}</div>
                    <div className="mt-4 h-px bg-gradient-to-l from-transparent via-cyan-200/30 to-transparent" />
                    <div className="mt-4 rounded-2xl border border-cyan-200/15 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100">
                      عمق ذكي بصري · Preview
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setModalTitle("إيداع")}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-gradient-to-l from-[#2563EB] to-[#22D3EE] px-5 text-sm font-bold text-white shadow-[0_18px_40px_rgba(37,99,235,.28)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-cyan-300/35"
                  >
                    إيداع
                    <ArrowLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalTitle("تحويل")}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-[#08172C] transition hover:bg-cyan-50 focus:outline-none focus:ring-2 focus:ring-white/60"
                  >
                    تحويل
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </GlassCard>

            <div className="grid gap-4">
              <GlassCard className="p-5">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <StatusPill tone={orgStatus.tone}>{orgStatus.label}</StatusPill>
                    <h2 className="mt-3 text-xl font-black text-white">حالة المنشأة</h2>
                    <p className="mt-1 text-sm leading-relaxed text-[#9DB4D3]">{orgStatus.detail}</p>
                  </div>
                  <IconBubble icon={orgStatus.tone === "success" ? ShieldCheck : BadgeCheck} active />
                </div>
                <div className="mb-3 flex items-center justify-between text-xs text-[#9DB4D3]">
                  <span>جاهزية الإعداد</span>
                  <span>{readiness}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white/[0.08]">
                  <div className="h-full rounded-full bg-gradient-to-l from-[#22D3EE] to-[#2563EB]" style={{ width: `${readiness}%` }} />
                </div>
              </GlassCard>

              <GlassCard className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-black text-white">حالة الاشتراك</h2>
                    <p className="mt-1 text-xs text-[#9DB4D3]">عرض بصري فقط بدون بوابة دفع.</p>
                  </div>
                  <StatusPill tone="info">{planLabel}</StatusPill>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3">
                    <div className="text-[11px] text-[#9DB4D3]">المهام</div>
                    <div className="mt-1 text-lg font-black text-white">{tasks.length}</div>
                  </div>
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3">
                    <div className="text-[11px] text-[#9DB4D3]">الفريق</div>
                    <div className="mt-1 text-lg font-black text-white">{employees.length}</div>
                  </div>
                </div>
              </GlassCard>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
            <DigitalTwinMapCard companyName={companyName || "Blumark24 OS"} readiness={readiness} nodes={twinNodes} />

            <GlassCard className="p-5">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <StatusPill tone="info">Smart Control</StatusPill>
                  <h2 className="mt-3 text-xl font-black text-white">لوحة التحكم التشغيلية</h2>
                  <p className="mt-1 text-sm leading-relaxed text-[#9DB4D3]">
                    كروت تشغيل مستوحاة من أنظمة التوصيل، لكن بمعنى أعمال Blumark24: مشاريع، مهام، عملاء، وفريق.
                  </p>
                </div>
                <IconBubble icon={Activity} active />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {operationSignals.map((signal) => (
                  <OperationSignalCard key={signal.label} {...signal} />
                ))}
              </div>
            </GlassCard>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
            <GlassCard className="p-5">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-white">الحسابات والخدمات</h2>
                  <p className="mt-1 text-sm text-[#9DB4D3]">صفوف حسابات بنمط مصرفي، مبنية على توفر المسارات الفعلية.</p>
                </div>
                <Network size={21} className="text-cyan-200" />
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {serviceRows.map((row) => (
                  <ServiceRow key={row.title} {...row} />
                ))}
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <div className="mb-5">
                <h2 className="text-xl font-black text-white">إجراءات سريعة</h2>
                <p className="mt-1 text-sm text-[#9DB4D3]">كل إجراء غير مفعل يفتح نافذة قراءة فقط.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => setModalTitle(action.label)}
                      className="group min-h-[92px] rounded-[24px] border border-white/[0.09] bg-white/[0.045] p-3 text-right transition hover:-translate-y-0.5 hover:border-cyan-200/25 hover:bg-cyan-300/[0.07] focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                    >
                      <span className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-200/15 bg-cyan-300/10 text-cyan-100">
                        <Icon size={17} />
                      </span>
                      <span className="mt-3 block text-sm font-bold text-white">{action.label}</span>
                    </button>
                  );
                })}
              </div>
            </GlassCard>
          </section>

          <GlassCard className="p-5">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-white">آخر المعاملات والنشاط</h2>
                <p className="mt-1 text-sm text-[#9DB4D3]">
                  {transactionsLoading || activitiesLoading ? "جاري تحميل البيانات الفعلية..." : "لا يتم عرض أي معاملة غير موجودة في النظام."}
                </p>
              </div>
              <StatusPill tone={transactions.length > 0 || activities.length > 0 ? "success" : "muted"}>
                {transactions.length > 0 ? `${transactions.length} معاملة` : activities.length > 0 ? `${activities.length} نشاط` : "لا توجد بيانات بعد"}
              </StatusPill>
            </div>
            <TransactionRows transactions={transactions} activities={activities} />
          </GlassCard>
        </div>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-40 rounded-[26px] border border-cyan-200/15 bg-[rgba(8,23,44,.82)] p-2 shadow-[0_24px_70px_rgba(2,8,23,.42)] backdrop-blur-xl lg:hidden" dir="rtl">
        <div className="grid grid-cols-5 gap-1">
          {[
            { label: "الرئيسية", icon: LayoutDashboard, active: true },
            { label: "العملاء", icon: Target, href: "/clients" },
            { label: "المهام", icon: CheckCircle2, href: "/tasks" },
            { label: "التقارير", icon: BarChart3, href: "/reports" },
            { label: "الإعدادات", icon: Settings, href: "/settings" },
          ].map((item) => {
            const Icon = item.icon;
            const enabled = item.active || (item.href ? routeSet.has(item.href) : false);
            const inner = (
              <>
                <Icon size={18} className={item.active ? "text-cyan-200" : "text-[#9DB4D3]"} />
                <span className="mt-1 truncate text-[10px] font-semibold">{item.label}</span>
              </>
            );
            const className = cn(
              "flex min-h-14 flex-col items-center justify-center rounded-2xl text-center transition",
              item.active ? "bg-cyan-300/12 text-white shadow-[0_0_18px_rgba(34,211,238,.12)]" : "text-[#9DB4D3]",
              !enabled && "opacity-45",
            );
            if (item.href && enabled) {
              return (
                <Link key={item.label} href={item.href} className={className}>
                  {inner}
                </Link>
              );
            }
            return (
              <button key={item.label} type="button" disabled className={className}>
                {inner}
              </button>
            );
          })}
        </div>
      </nav>
    </main>
  );
}
