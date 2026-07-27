"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  CalendarClock,
  CircleCheck,
  ClipboardList,
  Layers,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createOrgScopeResolver } from "@/lib/org/orgScopeResolver";
import type { Employee, Task } from "@/types";
import type { OrgStructureSnapshot } from "@/lib/org/types";
import type { UserRole } from "@/contexts/PermissionsContext";
import { isOverdue } from "./TaskCard";

/**
 * مركز قيادة المهام (إعادة التصميم — طبقة تنفيذية مضغوطة + لقطة توأم رقمي مختصرة).
 *
 * كل القيم المعروضة هنا محسوبة من بيانات Supabase الحقيقية الممرّرة من الصفحة،
 * والمعزولة أصلًا حسب organization_id عبر RLS و requireTenantOrgId. لا توجد أي
 * بيانات ثابتة أو أسماء تجريبية أو أرقام وهمية أو توصيات ذكاء اصطناعي غير حقيقية:
 * عند غياب البيانات تظهر حالات فارغة محترفة بدلًا من أي محتوى مصطنع.
 */

type OrgScopeResolver = ReturnType<typeof createOrgScopeResolver>;

const RIYADH_TODAY = new Intl.DateTimeFormat("ar-SA", {
  timeZone: "Asia/Riyadh",
  weekday: "long",
  day: "numeric",
  month: "long",
});

const MS_PER_DAY = 86_400_000;

const SURFACE = "rounded-[12px] border border-white/[0.07] bg-[#0b1826]/94 shadow-[0_14px_36px_rgba(0,0,0,0.28)]";
const INSET = "rounded-[9px] border border-white/[0.07] bg-[#07121d]/80";

/** الأدوار الإدارية التي ترى ملخص المنشأة والتوأم الرقمي والمخاطر. */
export function isManagerScope(role: UserRole | null): boolean {
  if (!role) return false;
  return role !== "employee";
}

function isActive(task: Task): boolean {
  return task.status !== "مكتملة";
}

function isLate(task: Task): boolean {
  return task.status === "متأخرة" || isOverdue(task.dueDate, task.status);
}

/** هل تستحق المهمة خلال 48 ساعة القادمة (ولم تتأخر أو تكتمل بعد). */
function isDueSoon(task: Task): boolean {
  if (task.status === "مكتملة" || task.status === "متأخرة") return false;
  const due = new Date(task.dueDate);
  if (Number.isNaN(due.getTime())) return false;
  const diff = due.getTime() - Date.now();
  return diff >= 0 && diff <= 2 * MS_PER_DAY;
}

export type TaskIntelligence = {
  total: number;
  active: number;
  newCount: number;
  inProgress: number;
  review: number;
  late: number;
  completed: number;
  dueSoon: number;
  completionPct: number | null;
};

/** ملخص محسوب لأي مجموعة مهام (يُستخدم للمنشأة أو للمهام الشخصية). */
export function buildTaskIntelligence(tasks: Task[]): TaskIntelligence {
  let active = 0;
  let newCount = 0;
  let inProgress = 0;
  let review = 0;
  let late = 0;
  let completed = 0;
  let dueSoon = 0;

  for (const task of tasks) {
    if (task.status === "جديدة") newCount += 1;
    if (task.status === "قيد_التنفيذ") inProgress += 1;
    if (task.status === "بانتظار_المراجعة") review += 1;
    if (task.status === "مكتملة") completed += 1;
    if (isActive(task)) active += 1;
    if (isLate(task)) late += 1;
    if (isDueSoon(task)) dueSoon += 1;
  }

  return {
    total: tasks.length,
    active,
    newCount,
    inProgress,
    review,
    late,
    completed,
    dueSoon,
    completionPct: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : null,
  };
}

export type TwinDepartmentNode = {
  id: string;
  label: string;
  total: number;
  active: number;
  late: number;
  tone: "critical" | "active" | "idle";
};

export type TwinSnapshot = {
  hasEnoughData: boolean;
  nodes: TwinDepartmentNode[];
  departmentsCount: number;
  linkedEmployees: number;
  unscopedTasks: number;
  criticalTasks: number;
  reviewTasks: number;
  completionPct: number | null;
  workloadLabel: string | null;
};

/**
 * يبني لقطة التوأم الرقمي من الأقسام والموظفين والمهام الحقيقية فقط.
 * كل خلية تمثل قسمًا حقيقيًا في هيكل المنشأة، ولونها مشتق من حالة مهامه الفعلية.
 */
export function buildTwinSnapshot(
  orgSnapshot: OrgStructureSnapshot | null | undefined,
  employees: Employee[],
  tasks: Task[],
  orgResolver: OrgScopeResolver,
): TwinSnapshot {
  const departments = orgSnapshot?.departments ?? [];
  const byDeptId = new Map<string, { total: number; active: number; late: number }>();
  let unscopedTasks = 0;
  let criticalTasks = 0;
  let reviewTasks = 0;
  let completed = 0;

  for (const task of tasks) {
    const scope = orgResolver.resolveTaskAssignee(task);
    const late = isLate(task);
    if (late) criticalTasks += 1;
    if (task.status === "بانتظار_المراجعة") reviewTasks += 1;
    if (task.status === "مكتملة") completed += 1;

    if (scope.departmentId) {
      const bucket = byDeptId.get(scope.departmentId) ?? { total: 0, active: 0, late: 0 };
      bucket.total += 1;
      if (isActive(task)) bucket.active += 1;
      if (late) bucket.late += 1;
      byDeptId.set(scope.departmentId, bucket);
    } else {
      unscopedTasks += 1;
    }
  }

  const nodes: TwinDepartmentNode[] = departments.map((department) => {
    const bucket = byDeptId.get(department.id) ?? { total: 0, active: 0, late: 0 };
    const tone: TwinDepartmentNode["tone"] = bucket.late > 0 ? "critical" : bucket.active > 0 ? "active" : "idle";
    return { id: department.id, label: department.name, total: bucket.total, active: bucket.active, late: bucket.late, tone };
  });

  const linkedEmployees = employees.length;
  const activeTasks = tasks.filter(isActive).length;
  let workloadLabel: string | null = null;
  if (linkedEmployees > 0 && tasks.length > 0) {
    const ratio = activeTasks / linkedEmployees;
    workloadLabel = ratio >= 4 ? "مرتفع" : ratio >= 2 ? "متوازن" : "منخفض";
  }

  return {
    hasEnoughData: departments.length > 0 && tasks.length > 0,
    nodes,
    departmentsCount: departments.length,
    linkedEmployees,
    unscopedTasks,
    criticalTasks,
    reviewTasks,
    completionPct: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : null,
    workloadLabel,
  };
}

export type TaskSignal = {
  id: string;
  tone: "danger" | "warning" | "info";
  title: string;
  body: string;
};

/** يبني الإشارات التشغيلية الحقيقية (مخاطر/قرارات/حمل) — لا توصيات ذكاء اصطناعي مصطنعة. */
export function buildTaskSignals(
  intelligence: TaskIntelligence,
  options: { managerScope: boolean; unscopedTasks: number; topLoad: { name: string; count: number } | null },
): TaskSignal[] {
  const signals: TaskSignal[] = [];

  if (intelligence.late > 0) {
    signals.push({ id: "late", tone: "danger", title: "مخاطر التأخير", body: `${intelligence.late} مهمة تجاوزت موعدها وتحتاج متابعة عاجلة.` });
  }
  if (intelligence.review > 0) {
    signals.push({ id: "review", tone: "warning", title: "قرارات ومراجعات", body: `${intelligence.review} مهمة بانتظار المراجعة أو الاعتماد.` });
  }
  if (intelligence.dueSoon > 0) {
    signals.push({ id: "due-soon", tone: "info", title: "مواعيد قريبة", body: `${intelligence.dueSoon} مهمة تستحق خلال 48 ساعة القادمة.` });
  }
  if (options.managerScope && options.unscopedTasks > 0) {
    signals.push({ id: "unscoped", tone: "warning", title: "بلا ارتباط تنظيمي", body: `${options.unscopedTasks} مهمة غير مرتبطة بقسم في هيكل المنشأة.` });
  }
  if (options.managerScope && options.topLoad && options.topLoad.count >= 4) {
    signals.push({ id: "top-load", tone: "info", title: "أعلى حمل تشغيلي", body: `${options.topLoad.name} لديه ${options.topLoad.count} مهمة نشطة حاليًا.` });
  }

  return signals;
}

// ─── واجهة العرض ───────────────────────────────────────────────────────────

/** زر المكتب الذكي البارز — يظهر أعلى الصفحة، وبيانات حيّة حقيقية فقط. */
function SmartDeskButton({ liveNote }: { liveNote: string }) {
  return (
    <Link
      href="/tasks/my-desk"
      className={cn(
        "group flex min-h-[52px] items-center gap-2.5 overflow-hidden rounded-[10px] px-3.5 text-white",
        "bg-[linear-gradient(125deg,#1268cc_0%,#168fd6_58%,#27b9d3_100%)]",
        "shadow-[0_12px_30px_rgba(24,135,218,0.30),inset_0_1px_0_rgba(255,255,255,0.24)]",
        "transition-[transform,filter] duration-200 hover:-translate-y-0.5 hover:brightness-110",
        "motion-reduce:transform-none motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9eeaff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#081522]",
      )}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-white/[0.16] shadow-[inset_0_1px_0_rgba(255,255,255,0.20)]">
        <BriefcaseBusiness size={18} />
      </span>
      <span className="min-w-0 flex-1 text-right">
        <span className="flex items-center gap-1.5">
          <strong className="block text-[13px] font-black">فتح المكتب الذكي</strong>
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#dff4fa] motion-reduce:animate-none" aria-hidden="true" />
        </span>
        <small className="mt-0.5 block truncate text-[10px] font-bold text-white/80">{liveNote}</small>
      </span>
      <ArrowLeft size={16} className="shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
    </Link>
  );
}

export type MissionHeroProps = {
  managerScope: boolean;
  companyName: string;
  logoUrl: string | null;
  profileChips: { label: string; value: string }[];
  intelligence: TaskIntelligence;
  canManage: boolean;
  onAdd: (trigger: HTMLElement) => void;
};

/** الطبقة التنفيذية المضغوطة — هوية المنشأة، لقطة اليوم، وزرّا المكتب الذكي/مهمة جديدة أعلى الصفحة. */
export function TaskMissionHero({
  managerScope,
  companyName,
  logoUrl,
  profileChips,
  intelligence,
  canManage,
  onAdd,
}: MissionHeroProps) {
  const today = RIYADH_TODAY.format(new Date());
  const title = managerScope ? "المهام الذكية" : "مهامي اليوم";
  const attention = intelligence.late + intelligence.review;
  const liveNote = `${intelligence.active} مهمة نشطة اليوم`;

  return (
    <section className={cn(SURFACE, "overflow-hidden")}>
      {/* الصف العلوي: الهوية + زرّا الإجراء البارزان */}
      <div className="flex flex-col gap-2.5 border-b border-white/[0.06] px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={companyName} className="h-9 w-9 shrink-0 rounded-[9px] border border-white/10 bg-white object-contain p-1" />
          ) : (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] border border-white/10 bg-[#102235] text-[#66cfff]">
              <ShieldCheck size={16} />
            </span>
          )}
          <div className="min-w-0">
            <strong className="block truncate text-[13px] font-black text-white">{companyName}</strong>
            <span className="flex items-center gap-1.5 text-[10px] text-[#8d9baa]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#3FD2E6] motion-reduce:animate-none" aria-hidden="true" />
              مباشر · {today}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-stretch gap-2">
          <div className="min-w-0 flex-1 sm:w-[248px] sm:flex-none">
            <SmartDeskButton liveNote={liveNote} />
          </div>
          {canManage ? (
            <button
              type="button"
              onClick={(event) => onAdd(event.currentTarget)}
              className="inline-flex min-h-[52px] shrink-0 items-center justify-center gap-2 rounded-[10px] bg-[#102235] px-3.5 text-xs font-black text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)] transition-colors hover:bg-[#16314a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8bd5ff]"
            >
              <Plus size={16} />
              <span className="hidden min-[420px]:inline">مهمة جديدة</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* الصف السفلي المضغوط: العنوان + الملخص + النسبة */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3.5 py-2.5 sm:px-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-lg font-black leading-tight text-white sm:text-xl">{title}</h1>
            {attention > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E6B84F]/25 bg-[#E6B84F]/[0.08] px-2.5 py-1 text-[10.5px] font-bold text-[#f1e4c4]">
                <AlertTriangle size={12} className="shrink-0 text-[#E6B84F]" />
                {intelligence.late} متأخرة · {intelligence.review} للمراجعة
              </span>
            ) : null}
          </div>
          {profileChips.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-[#8d9baa]">
              {profileChips.map((chip) => (
                <span key={chip.label}>
                  <span className="text-[#66758a]">{chip.label}:</span> <span className="font-bold text-[#c4cfdb]">{chip.value}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {intelligence.completionPct !== null ? (
          <div className="text-left">
            <div className="text-2xl font-black leading-none text-white tabular-nums">{intelligence.completionPct}%</div>
            <div className="mt-0.5 text-[10px] text-[#8d9baa]">نسبة الإنجاز {managerScope ? "الحالية" : "لمهامك"}</div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export type OperationalRailItem = {
  label: string;
  value: number | string;
  tone?: "default" | "info" | "danger" | "success";
};

/** الشريط التشغيلي — مقاييس المهام الحقيقية (يستخدمه المدير لصحة العمل والحمل). */
export function TaskOperationalRail({ items }: { items: OperationalRailItem[] }) {
  const toneColor: Record<NonNullable<OperationalRailItem["tone"]>, string> = {
    default: "text-white",
    info: "text-[#66cfff]",
    danger: "text-[#ff9d8a]",
    success: "text-[#7fe0a6]",
  };
  return (
    <section className={cn(SURFACE, "grid grid-cols-3 gap-px overflow-hidden bg-white/[0.06] sm:grid-cols-6")}>
      {items.map((item) => (
        <div key={item.label} className="bg-[#0b1826] px-3 py-3">
          <div className={cn("text-xl font-black tabular-nums", toneColor[item.tone ?? "default"])}>{item.value}</div>
          <div className="mt-0.5 text-[10.5px] font-bold text-[#8d9baa]">{item.label}</div>
        </div>
      ))}
    </section>
  );
}

/** لقطة التوأم الرقمي المختصرة — عرض فقط، بيانات حقيقية، وحالة فارغة عند نقص البيانات. */
export function TaskDigitalTwinSnapshot({ snapshot }: { snapshot: TwinSnapshot }) {
  const toneStyle: Record<TwinDepartmentNode["tone"], string> = {
    critical: "border-[#F06464]/50 bg-[#F06464]/[0.16]",
    active: "border-[#2F7DF6]/45 bg-[#2F7DF6]/[0.18]",
    idle: "border-white/[0.08] bg-white/[0.03]",
  };
  const metrics = [
    { label: "أقسام", value: String(snapshot.departmentsCount) },
    { label: "إنجاز", value: snapshot.completionPct !== null ? `${snapshot.completionPct}%` : "—" },
    { label: "حرجة", value: String(snapshot.criticalTasks) },
    { label: "الحمل", value: snapshot.workloadLabel ?? "—" },
  ];

  return (
    <section className={cn(SURFACE, "overflow-hidden")}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-3.5 py-2.5 sm:px-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] border border-[#3FD2E6]/30 bg-[#102235] text-[#3FD2E6]">
            <Layers size={15} />
          </span>
          <div>
            <strong className="block text-[12.5px] font-black text-white">التوأم الرقمي · لقطة</strong>
            <span className="block text-[9.5px] text-[#8d9baa]">مشتقة من أقسامك ومهامك الحقيقية</span>
          </div>
        </div>
        <Link
          href="/tasks/my-desk"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] border border-[#2F7DF6]/40 bg-[#2F7DF6]/[0.12] px-3 text-[11px] font-bold text-[#8fb9ff] transition-colors hover:bg-[#2F7DF6]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8bd5ff]"
        >
          <BriefcaseBusiness size={13} />
          المكتب الذكي
        </Link>
      </div>

      {snapshot.hasEnoughData ? (
        <div className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5" aria-hidden="true">
            {snapshot.nodes.map((node) => (
              <span
                key={node.id}
                title={`${node.label} · ${node.total} مهمة`}
                className={cn("h-7 w-7 rounded-[6px] border", toneStyle[node.tone])}
              />
            ))}
          </div>
          <div className="grid shrink-0 grid-cols-4 gap-2 sm:w-[300px]">
            {metrics.map((metric) => (
              <div key={metric.label} className={cn(INSET, "px-2 py-2 text-center")}>
                <div className="truncate text-[13px] font-black text-white">{metric.value}</div>
                <div className="mt-0.5 text-[9.5px] text-[#8d9baa]">{metric.label}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] border border-white/[0.08] bg-[#102235] text-[#66cfff]">
            <Layers size={16} />
          </span>
          <p className="text-[11.5px] leading-6 text-[#8d9baa]">
            التوأم الرقمي غير جاهز بعد — ستظهر لقطة الأقسام والحمل التشغيلي بعد إضافة أقسام لهيكل منشأتك وتوزيع المهام عليها.
          </p>
        </div>
      )}
    </section>
  );
}

/** الإشارات التشغيلية الحقيقية (المخاطر/القرارات/الحمل) — أو حالة فارغة عند عدم توفر بيانات كافية. */
export function TaskInsightsRail({ signals }: { signals: TaskSignal[] }) {
  const toneStyle: Record<TaskSignal["tone"], { dot: string; title: string }> = {
    danger: { dot: "bg-[#F06464]", title: "text-[#ffb0a0]" },
    warning: { dot: "bg-[#E6B84F]", title: "text-[#f2d394]" },
    info: { dot: "bg-[#3FD2E6]", title: "text-[#8fdcff]" },
  };

  return (
    <section className={cn(SURFACE, "p-3.5 sm:p-4")}>
      <div className="mb-2.5 flex items-center gap-2">
        <Sparkles size={13} className="text-[#3FD2E6]" />
        <strong className="text-[11px] font-black text-[#d7dee6]">إشارات تشغيلية</strong>
      </div>
      {signals.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {signals.map((signal) => (
            <div key={signal.id} className={cn(INSET, "p-3")}>
              <div className="mb-1 flex items-center gap-2">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", toneStyle[signal.tone].dot)} aria-hidden="true" />
                <strong className={cn("text-[11px] font-black", toneStyle[signal.tone].title)}>{signal.title}</strong>
              </div>
              <p className="text-[11px] leading-5 text-[#c4cfdb]">{signal.body}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-[9px] border border-white/[0.06] bg-[#07121d]/70 px-3.5 py-3.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-[#102235] text-[#66cfff]">
            <ClipboardList size={15} />
          </span>
          <p className="text-[11.5px] leading-6 text-[#8d9baa]">ستظهر الإشارات الذكية بعد توفر بيانات كافية عن المهام والمواعيد.</p>
        </div>
      )}
    </section>
  );
}

/** بطاقة تركيز شخصية للموظف — مبنية من مهامه هو فقط (مهامي/التالية/المتأخرة/المكتملة). */
export function TaskPersonalFocus({ intelligence }: { intelligence: TaskIntelligence }) {
  const cards: { label: string; value: number; icon: ReactNode; tone: string }[] = [
    { label: "مهام نشطة", value: intelligence.active, icon: <ClipboardList size={14} />, tone: "text-[#66cfff]" },
    { label: "تستحق قريبًا", value: intelligence.dueSoon, icon: <CalendarClock size={14} />, tone: "text-[#f2d394]" },
    { label: "متأخرة", value: intelligence.late, icon: <AlertTriangle size={14} />, tone: "text-[#ff9d8a]" },
    { label: "مكتملة", value: intelligence.completed, icon: <CircleCheck size={14} />, tone: "text-[#7fe0a6]" },
  ];
  return (
    <section className={cn(SURFACE, "grid grid-cols-2 gap-px overflow-hidden bg-white/[0.06] lg:grid-cols-4")}>
      {cards.map((card) => (
        <div key={card.label} className="bg-[#0b1826] px-3.5 py-3">
          <span className={cn("mb-1 block", card.tone)}>{card.icon}</span>
          <div className="text-xl font-black tabular-nums text-white">{card.value}</div>
          <div className="mt-0.5 text-[10.5px] font-bold text-[#8d9baa]">{card.label}</div>
        </div>
      ))}
    </section>
  );
}

/** حالة تحميل موحّدة لمركز القيادة. */
export function CommandCenterLoading() {
  return (
    <section className={cn(SURFACE, "flex items-center justify-center gap-3 px-5 py-8")}>
      <Loader2 size={18} className="animate-spin text-[#66cfff]" />
      <span className="text-[12px] font-bold text-[#8d9baa]">جاري تجهيز مساحة المهام…</span>
    </section>
  );
}
