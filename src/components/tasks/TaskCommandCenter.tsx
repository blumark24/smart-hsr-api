"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  Home,
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
 * مركز قيادة المهام — سطح تنفيذي موحّد يطابق التصميم المرجعي بصريًا:
 * طبقة تنفيذية (هوية المنشأة + لقطة اليوم) + إشارات تشغيلية + لوحة التوأم الرقمي
 * + الشريط التشغيلي، ضمن بطاقة واحدة.
 *
 * كل القيم محسوبة من بيانات Supabase الحقيقية الممرّرة من الصفحة، والمعزولة أصلًا
 * حسب organization_id عبر RLS و requireTenantOrgId. لا توجد بيانات ثابتة ولا أسماء
 * تجريبية ولا أرقام وهمية ولا توصيات ذكاء اصطناعي مصطنعة: عند غياب البيانات تظهر
 * حالات فارغة احترافية بدلًا من أي محتوى مصطنع.
 */

type OrgScopeResolver = ReturnType<typeof createOrgScopeResolver>;

const RIYADH_TODAY = new Intl.DateTimeFormat("ar-SA", {
  timeZone: "Asia/Riyadh",
  weekday: "long",
  day: "numeric",
  month: "long",
});

const MS_PER_DAY = 86_400_000;

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
  review: number;
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
  flow: { active: number; review: number; late: number; inFlow: number };
  flowPct: { active: number; review: number; late: number };
};

export function buildTwinSnapshot(
  orgSnapshot: OrgStructureSnapshot | null | undefined,
  employees: Employee[],
  tasks: Task[],
  orgResolver: OrgScopeResolver,
): TwinSnapshot {
  const departments = orgSnapshot?.departments ?? [];
  // buckets مقسّمة بلا تداخل: متأخرة ← مراجعة (غير متأخرة) ← نشطة خالصة.
  const byDeptId = new Map<string, { total: number; active: number; late: number; review: number }>();
  let unscopedTasks = 0;
  let criticalTasks = 0;
  let reviewTasks = 0;
  let completed = 0;
  let flowActive = 0;
  let flowReview = 0;
  let flowLate = 0;

  for (const task of tasks) {
    const scope = orgResolver.resolveTaskAssignee(task);
    const late = isLate(task);
    const review = !late && task.status === "بانتظار_المراجعة";
    const pureActive = !late && !review && isActive(task);
    if (late) criticalTasks += 1;
    if (task.status === "بانتظار_المراجعة") reviewTasks += 1;
    if (task.status === "مكتملة") completed += 1;

    if (scope.departmentId) {
      const bucket = byDeptId.get(scope.departmentId) ?? { total: 0, active: 0, late: 0, review: 0 };
      bucket.total += 1;
      if (late) bucket.late += 1;
      else if (review) bucket.review += 1;
      else if (pureActive) bucket.active += 1;
      byDeptId.set(scope.departmentId, bucket);
      if (late) flowLate += 1;
      else if (review) flowReview += 1;
      else if (pureActive) flowActive += 1;
    } else {
      unscopedTasks += 1;
    }
  }

  const nodes: TwinDepartmentNode[] = departments.map((department) => {
    const bucket = byDeptId.get(department.id) ?? { total: 0, active: 0, late: 0, review: 0 };
    const tone: TwinDepartmentNode["tone"] = bucket.late > 0 ? "critical" : bucket.active + bucket.review > 0 ? "active" : "idle";
    return { id: department.id, label: department.name, total: bucket.total, active: bucket.active, late: bucket.late, review: bucket.review, tone };
  });

  const linkedEmployees = employees.length;
  const activeTasks = tasks.filter(isActive).length;
  let workloadLabel: string | null = null;
  if (linkedEmployees > 0 && tasks.length > 0) {
    const ratio = activeTasks / linkedEmployees;
    workloadLabel = ratio >= 4 ? "مرتفع" : ratio >= 2 ? "متوازن" : "منخفض";
  }

  const inFlow = flowActive + flowReview + flowLate;
  const pct = (value: number) => (inFlow > 0 ? Math.round((value / inFlow) * 100) : 0);

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
    flow: { active: flowActive, review: flowReview, late: flowLate, inFlow },
    flowPct: { active: pct(flowActive), review: pct(flowReview), late: pct(flowLate) },
  };
}

export type TaskSignal = {
  id: string;
  tone: "danger" | "warning" | "info";
  title: string;
  body: string;
  reason: string;
  impact: string;
};

export function buildTaskSignals(
  intelligence: TaskIntelligence,
  options: { managerScope: boolean; unscopedTasks: number; topLoad: { name: string; count: number } | null },
): TaskSignal[] {
  const signals: TaskSignal[] = [];

  if (intelligence.late > 0) {
    signals.push({
      id: "late",
      tone: "danger",
      title: "مخاطر التأخير",
      body: `${intelligence.late} مهمة تجاوزت موعدها وتحتاج متابعة عاجلة.`,
      reason: "مهام متأخرة",
      impact: "خطر على التسليم",
    });
  }
  if (intelligence.review > 0) {
    signals.push({
      id: "review",
      tone: "warning",
      title: "قرارات ومراجعات",
      body: `${intelligence.review} مهمة بانتظار المراجعة أو الاعتماد.`,
      reason: "بحاجة إلى قرار",
      impact: "تسريع الإنجاز",
    });
  }
  if (intelligence.dueSoon > 0) {
    signals.push({
      id: "due-soon",
      tone: "info",
      title: "مواعيد قريبة",
      body: `${intelligence.dueSoon} مهمة تستحق خلال 48 ساعة القادمة.`,
      reason: "استحقاق وشيك",
      impact: "تفادي التأخير",
    });
  }
  if (options.managerScope && options.unscopedTasks > 0) {
    signals.push({
      id: "unscoped",
      tone: "warning",
      title: "بلا ارتباط تنظيمي",
      body: `${options.unscopedTasks} مهمة غير مرتبطة بقسم في هيكل المنشأة.`,
      reason: "قسم غير محدد",
      impact: "وضوح المسؤولية",
    });
  }
  if (options.managerScope && options.topLoad && options.topLoad.count >= 4) {
    signals.push({
      id: "top-load",
      tone: "info",
      title: "أعلى حمل تشغيلي",
      body: `${options.topLoad.name} لديه ${options.topLoad.count} مهمة نشطة حاليًا.`,
      reason: "حمل عمل مرتفع",
      impact: "إعادة التوزيع",
    });
  }

  return signals;
}

// ─── عناصر واجهة داخلية ─────────────────────────────────────────────────────

function companyInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  const letters = parts.slice(0, 2).map((part) => part[0]).join("");
  return letters.toLocaleUpperCase("ar");
}

function CompanyLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const [broken, setBroken] = useState(false);
  const initials = companyInitials(name);
  if (logoUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        onError={() => setBroken(true)}
        className="h-11 w-11 shrink-0 rounded-[11px] border border-white/10 bg-white object-contain p-1.5"
      />
    );
  }
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[11px] border border-white/10 bg-[#132138] text-[#3FD2E6]" aria-hidden="true">
      {initials ? <span className="text-[15px] font-black">{initials}</span> : <ShieldCheck size={20} />}
    </span>
  );
}

const SIGNAL_TONE: Record<TaskSignal["tone"], { title: string; dot: string; border: string }> = {
  danger: { title: "text-[#ffb0a0]", dot: "bg-[#F06464]", border: "border-[#F06464]/30" },
  warning: { title: "text-[#f2d394]", dot: "bg-[#E6B84F]", border: "border-[#E6B84F]/30" },
  info: { title: "text-[#8fdcff]", dot: "bg-[#3FD2E6]", border: "border-[#3FD2E6]/25" },
};

/** بوابة المكتب الذكي — مدخل رئيسي بارز، بنص حقيقي أو نص محايد بلا أرقام. */
function SmartDeskGateway({ deskPortal }: { deskPortal: { dueToday: number; pendingDecisions: number } }) {
  const parts: string[] = [];
  if (deskPortal.dueToday > 0) parts.push(`${deskPortal.dueToday} مهمة اليوم`);
  if (deskPortal.pendingDecisions > 0) parts.push(`${deskPortal.pendingDecisions} بانتظارك`);
  const note = parts.length ? parts.join(" · ") : "عرض يوم العمل والتوأم الرقمي";

  return (
    <Link
      href="/tasks/my-desk"
      className="group flex h-16 items-center gap-3 overflow-hidden rounded-[14px] bg-[linear-gradient(125deg,#2F7DF6_0%,#2b8fe0_55%,#27b9d3_100%)] px-4 text-white shadow-[0_14px_32px_-8px_rgba(47,125,246,0.6)] ring-1 ring-inset ring-white/15 transition-[transform,filter] duration-200 hover:-translate-y-0.5 hover:brightness-110 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9eeaff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#08111D]"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[11px] bg-white/[0.18] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
        <Home size={20} />
      </span>
      <span className="min-w-0 flex-1 text-right">
        <span className="flex items-center gap-1.5">
          <strong className="block text-[14px] font-black">فتح المكتب الذكي</strong>
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#DFF4FA] motion-reduce:animate-none" aria-hidden="true" />
        </span>
        <small className="mt-0.5 block truncate text-[11.5px] font-bold text-white/85">{note}</small>
      </span>
      <ArrowLeft size={17} className="shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
    </Link>
  );
}

/** بطاقة إشارة تشغيلية — بنفس هيئة بطاقة "الاقتراحات الذكية" في المرجع. */
function SignalCard({ signal }: { signal: TaskSignal }) {
  const tone = SIGNAL_TONE[signal.tone];
  return (
    <div className={cn("rounded-[13px] border bg-[#0D1828] p-3.5", tone.border)}>
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", tone.dot)} aria-hidden="true" />
        <strong className={cn("text-[11px] font-black", tone.title)}>{signal.title}</strong>
      </div>
      <p className="mb-1.5 text-[12.5px] leading-6 text-[#D7DFE9]">{signal.body}</p>
      <p className="text-[10.5px] text-[#64758A]">السبب: {signal.reason} · الأثر: {signal.impact}</p>
    </div>
  );
}

function SignalsBlock({ signals, managerScope }: { signals: TaskSignal[]; managerScope: boolean }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-1.5">
        <Sparkles size={13} className="text-[#3FD2E6]" />
        <span className="text-[11px] font-black text-[#94A3B8]">إشارات تشغيلية</span>
      </div>
      {signals.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {signals.slice(0, managerScope ? 6 : 3).map((signal) => <SignalCard key={signal.id} signal={signal} />)}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-[13px] border border-white/[0.07] bg-[#0D1828] px-4 py-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[#132138] text-[#3FD2E6]" aria-hidden="true">
            <ClipboardList size={18} />
          </span>
          <p className="text-[12.5px] leading-6 text-[#94A3B8]">ستظهر الإشارات الذكية بعد توفر بيانات كافية عن المهام والمواعيد.</p>
        </div>
      )}
    </div>
  );
}

const TWIN_TILE_TONE: Record<TwinDepartmentNode["tone"], string> = {
  critical: "border-[#F06464]/45 bg-[#F06464]/[0.12]",
  active: "border-[#2F7DF6]/45 bg-[#2F7DF6]/[0.12]",
  idle: "border-white/[0.08] bg-white/[0.03]",
};
/** لوحة التوأم الرقمي — Snapshot تشغيلي: خريطة أقسام حقيقية + تدفّق + مقاييس + إشارة. */
function DigitalTwinPanel({ snapshot, signals }: { snapshot: TwinSnapshot; signals: TaskSignal[] }) {
  const metrics: { label: string; value: string; tone: string }[] = [
    { label: "الأقسام النشطة", value: String(snapshot.departmentsCount), tone: "text-[#F8FAFC]" },
    { label: "إنجاز المنشأة", value: snapshot.completionPct !== null ? `${snapshot.completionPct}%` : "—", tone: "text-[#2F7DF6]" },
    { label: "مهام حرجة", value: String(snapshot.criticalTasks), tone: snapshot.criticalTasks ? "text-[#F06464]" : "text-[#F8FAFC]" },
    { label: "بانتظار المراجعة", value: String(snapshot.reviewTasks), tone: "text-[#F8FAFC]" },
    { label: "الحمل التشغيلي", value: snapshot.workloadLabel ?? "—", tone: "text-[#E6B84F]" },
    { label: "مهام بلا قسم", value: String(snapshot.unscopedTasks), tone: snapshot.unscopedTasks ? "text-[#E6B84F]" : "text-[#F8FAFC]" },
  ];
  const topSignal = signals[0] ?? null;

  return (
    <div className="overflow-hidden rounded-[18px] border border-[#2F7DF6]/[0.18] bg-[linear-gradient(180deg,#0D1828,#0A1420)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] border border-[#3FD2E6]/30 bg-[#132138] text-[#3FD2E6]" aria-hidden="true">
            <Layers size={18} />
          </span>
          <div>
            <strong className="block text-[15px] font-black text-white">التوأم الرقمي للمنشأة</strong>
            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#94A3B8]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#3FD2E6] motion-reduce:animate-none" aria-hidden="true" />
              أقسام منشأتك · لقطة تشغيلية حية
            </span>
          </div>
        </div>
        <Link
          href="/tasks/my-desk"
          className="inline-flex h-10 items-center gap-1.5 rounded-[9px] bg-[#2F7DF6] px-4 text-[12.5px] font-black text-white transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9eeaff]"
        >
          <Home size={14} />
          فتح المكتب الذكي
        </Link>
      </div>

      {snapshot.hasEnoughData ? (
        <div className="grid gap-0 lg:grid-cols-[1.6fr_1fr]">
          <div className="border-white/[0.06] p-4 sm:p-5 lg:border-l">
            {/* شريط التدفق التشغيلي الإجمالي — نشط ← مراجعة ← متأخر */}
            <div className="mb-4 rounded-[12px] border border-white/[0.07] bg-[#0A1420] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10.5px] font-black text-[#94A3B8]">تدفّق المهام بين الأقسام</span>
                <span className="text-[10px] text-[#64758A]">{snapshot.flow.inFlow} مهمة قيد التدفق عبر {snapshot.departmentsCount} أقسام</span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
                <span className="h-full bg-[#2F7DF6]" style={{ width: `${snapshot.flowPct.active}%` }} />
                <span className="h-full bg-[#E6B84F]" style={{ width: `${snapshot.flowPct.review}%` }} />
                <span className="h-full bg-[#F06464]" style={{ width: `${snapshot.flowPct.late}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10.5px]">
                <span className="text-[#8fb9ff]">● {snapshot.flow.active} قيد التنفيذ</span>
                <span className="text-[#f2d394]">● {snapshot.flow.review} مراجعة</span>
                <span className="text-[#ff9d8a]">● {snapshot.flow.late} متعطّلة/متأخرة</span>
                {snapshot.unscopedTasks > 0 ? <span className="text-[#94A3B8]">● {snapshot.unscopedTasks} بلا قسم</span> : null}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {snapshot.nodes.map((node) => {
                const denom = node.total || 1;
                return (
                  <div
                    key={node.id}
                    title={`${node.label} · ${node.total} مهمة`}
                    className={cn("rounded-[10px] border p-3", TWIN_TILE_TONE[node.tone])}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong className="truncate text-[12px] font-black text-[#F8FAFC]">{node.label}</strong>
                      <span className="shrink-0 text-[10.5px] font-bold text-[#D7DFE9]">{node.total} مهمة</span>
                    </div>
                    <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
                      <span className="h-full bg-[#2F7DF6]" style={{ width: `${(node.active / denom) * 100}%` }} />
                      <span className="h-full bg-[#E6B84F]" style={{ width: `${(node.review / denom) * 100}%` }} />
                      <span className="h-full bg-[#F06464]" style={{ width: `${(node.late / denom) * 100}%` }} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 text-[10px] text-[#94A3B8]">
                      {node.total === 0 ? (
                        <span>بلا حمل حالي</span>
                      ) : (
                        <>
                          <span>{node.active} نشطة</span>
                          {node.review > 0 ? <span className="text-[#f2d394]">{node.review} مراجعة</span> : null}
                          {node.late > 0 ? <span className="text-[#ff9d8a]">{node.late} متأخرة</span> : null}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 max-w-xl text-[11px] leading-6 text-[#94A3B8]">
              لقطة تشغيلية لأقسام منشأتك الحقيقية — يوضّح كل شريط توزيع مهام القسم بين النشطة والمراجعة والمتأخرة (التعطّل).
              القيم مشتقة من مهامك الفعلية، ولا تُعرض أي بيانات وهمية.
            </p>
          </div>
          <div className="flex flex-col gap-3.5 p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-3.5">
              {metrics.map((metric) => (
                <div key={metric.label}>
                  <div className={cn("truncate text-[19px] font-black", metric.tone)}>{metric.value}</div>
                  <div className="mt-0.5 text-[11px] text-[#94A3B8]">{metric.label}</div>
                </div>
              ))}
            </div>
            {topSignal ? (
              <div className="rounded-[12px] border border-[#3FD2E6]/20 bg-[#111E31] px-4 py-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-black text-[#3FD2E6]">
                  <Sparkles size={13} />
                  إشارة تشغيلية
                </div>
                <p className="text-[12px] leading-6 text-[#D7DFE9]">{topSignal.body}</p>
              </div>
            ) : (
              <div className="rounded-[12px] border border-white/[0.07] bg-[#111E31] px-4 py-3">
                <p className="text-[12px] leading-6 text-[#94A3B8]">لا توجد إشارات حرجة حاليًا — الحمل التشغيلي ضمن المعدل.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
          <span className="mb-4 grid h-14 w-14 place-items-center rounded-[14px] border border-white/[0.08] bg-[#132138] text-[#3FD2E6]" aria-hidden="true">
            <Layers size={24} />
          </span>
          <strong className="text-[15px] font-black text-white">التوأم الرقمي غير جاهز بعد</strong>
          <p className="mt-2 max-w-md text-[12.5px] leading-6 text-[#94A3B8]">
            ستظهر خريطة الأقسام والحمل التشغيلي بعد إضافة أقسام لهيكل منشأتك وتوزيع المهام عليها. لا تُعرض هنا أي بيانات وهمية.
          </p>
        </div>
      )}
    </div>
  );
}

export type OperationalRailItem = {
  label: string;
  value: number | string;
  tone?: "default" | "info" | "danger" | "success";
};

function OperationalRail({ items }: { items: OperationalRailItem[] }) {
  const toneColor: Record<NonNullable<OperationalRailItem["tone"]>, string> = {
    default: "text-[#F8FAFC]",
    info: "text-[#2F7DF6]",
    danger: "text-[#F06464]",
    success: "text-[#38C77A]",
  };
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-white/[0.06] bg-white/[0.06] sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="bg-[#0D1828] px-4 py-4">
          <div className={cn("text-[26px] font-black leading-none tabular-nums", toneColor[item.tone ?? "default"])}>{item.value}</div>
          <div className="mt-1.5 text-[11.5px] font-bold text-[#94A3B8]">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── السطح الموحّد ──────────────────────────────────────────────────────────

export type TaskCommandCenterProps = {
  managerScope: boolean;
  companyName: string;
  logoUrl: string | null;
  sectorLabel: string | null;
  profileChips: { label: string; value: string }[];
  intelligence: TaskIntelligence;
  twinSnapshot: TwinSnapshot;
  signals: TaskSignal[];
  operationalItems: OperationalRailItem[];
  deskPortal: { dueToday: number; pendingDecisions: number };
  canManage: boolean;
  onAdd: (trigger: HTMLElement) => void;
};

export function TaskCommandCenter({
  managerScope,
  companyName,
  logoUrl,
  sectorLabel,
  profileChips,
  intelligence,
  twinSnapshot,
  signals,
  operationalItems,
  deskPortal,
  canManage,
  onAdd,
}: TaskCommandCenterProps) {
  const today = RIYADH_TODAY.format(new Date());
  const title = managerScope ? "المهام الذكية" : "مهامي اليوم";
  const attention = intelligence.late + intelligence.review;
  const description = managerScope
    ? `لديك اليوم ${intelligence.active} مهمة نشطة ضمن منشأتك، منها ${intelligence.review} بانتظار المراجعة — مساحة عمل تتكيف مع منشأتك ومكتبك الذكي.`
    : `لديك اليوم ${intelligence.active} مهمة نشطة، منها ${intelligence.dueSoon} تستحق قريبًا و${intelligence.late} متأخرة.`;

  return (
    <section className="overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#08111D] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.75)]">
      {/* شريط الهوية */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <CompanyLogo name={companyName} logoUrl={logoUrl} />
          <div className="min-w-0">
            <div className="truncate text-[14.5px] font-black text-[#F8FAFC]">{companyName}</div>
            <div className="truncate text-[11.5px] text-[#94A3B8]">{sectorLabel ?? "مساحة المهام · بيانات منشأتك فقط"}</div>
          </div>
        </div>
        {profileChips.length > 0 ? (
          <div className="flex items-center gap-2 rounded-[10px] border border-white/[0.08] bg-[#111E31] px-3 py-1.5">
            {profileChips.map((chip, index) => (
              <div key={chip.label} className="flex items-center gap-2">
                <div className="px-1.5 text-center">
                  <div className="text-[11.5px] font-bold text-[#D7DFE9]">{chip.value}</div>
                  <div className="mt-0.5 text-[9.5px] text-[#64758A]">{chip.label}</div>
                </div>
                {index < profileChips.length - 1 ? <span className="h-5 w-px bg-white/10" aria-hidden="true" /> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* الطبقة التنفيذية — مضغوطة (إحساس Workspace) */}
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#3FD2E6] motion-reduce:animate-none" aria-hidden="true" />
            <span className="text-[11px] font-bold text-[#3FD2E6]">مباشر · {today}</span>
          </div>
          <h1 className="text-[24px] font-black leading-tight tracking-tight text-[#F8FAFC] sm:text-[28px]">{title}</h1>
          <p className="mt-2 max-w-xl text-[12.5px] leading-6 text-[#D7DFE9]">{description}</p>
          {attention > 0 ? (
            <div className="mt-3 inline-flex max-w-xl items-center gap-2.5 rounded-[10px] border border-[#E6B84F]/25 bg-[#E6B84F]/[0.08] px-3.5 py-2">
              <AlertTriangle size={14} className="shrink-0 text-[#E6B84F]" aria-hidden="true" />
              <span className="text-[11.5px] font-bold text-[#F1E4C4]">
                يوجد اليوم {intelligence.late} مهمة متأخرة و{intelligence.review} بحاجة إلى مراجعة أو قرار
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-3 md:items-end">
          <div className="flex items-center justify-between gap-3 md:justify-end">
            {intelligence.completionPct !== null ? (
              <div className="text-right md:text-left">
                <div className="text-[30px] font-black leading-none text-[#F8FAFC] tabular-nums">{intelligence.completionPct}%</div>
                <div className="mt-1 text-[11px] text-[#94A3B8]">إنجاز {managerScope ? "المنشأة" : "مهامك"}</div>
              </div>
            ) : (
              <div className="text-right md:text-left">
                <div className="text-base font-black text-[#D7DFE9]">—</div>
                <div className="mt-1 text-[11px] text-[#94A3B8]">لا نسبة بعد</div>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row md:w-[420px] md:flex-row-reverse">
            <div className="min-w-0 flex-1">
              <SmartDeskGateway deskPortal={deskPortal} />
            </div>
            {canManage ? (
              <button
                type="button"
                onClick={(event) => onAdd(event.currentTarget)}
                className="inline-flex h-16 shrink-0 items-center justify-center gap-2 rounded-[14px] border border-white/[0.14] bg-[#132138] px-5 text-[13px] font-black text-[#F8FAFC] transition-colors hover:bg-[#1a2b45] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8bd5ff] sm:w-[150px]"
              >
                <Plus size={16} />
                مهمة جديدة
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* الإشارات التشغيلية */}
      <div className="px-4 pb-5 sm:px-6">
        <SignalsBlock signals={signals} managerScope={managerScope} />
      </div>

      {/* لوحة التوأم الرقمي — للمدير */}
      {managerScope ? (
        <div className="px-4 pb-5 sm:px-6">
          <DigitalTwinPanel snapshot={twinSnapshot} signals={signals} />
        </div>
      ) : null}

      {/* الشريط التشغيلي */}
      <div className="px-4 pb-5 sm:px-6">
        <OperationalRail items={operationalItems} />
      </div>
    </section>
  );
}

export function CommandCenterLoading() {
  return (
    <section className="flex items-center justify-center gap-3 rounded-[20px] border border-white/[0.06] bg-[#08111D] px-5 py-16 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.75)]">
      <Loader2 size={20} className="animate-spin text-[#3FD2E6]" />
      <span className="text-[13px] font-bold text-[#94A3B8]">جاري تجهيز مساحة المهام…</span>
    </section>
  );
}
