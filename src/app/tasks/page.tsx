"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Columns,
  Edit2,
  Inbox,
  List,
  LoaderCircle,
  MoreHorizontal,
  Plus,
  Radar,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageGuard from "@/components/ui/PageGuard";
import { PublicCodeBadge } from "@/components/ui/PublicCodeBadge";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useToast } from "@/contexts/ToastContext";
import { useClients, useEmployees, useTasks } from "@/hooks/useData";
import { useOrgStructure } from "@/hooks/useOrgStructure";
import { cn } from "@/lib/utils";
import {
  ORG_UNKNOWN_LABEL,
  createOrgScopeResolver,
} from "@/lib/org/orgScopeResolver";
import type { Client, Employee, Task, TaskPriority, TaskStatus } from "@/types";

const STATUS_COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: "جديدة", label: "جديدة", color: "#3c8cff" },
  { key: "قيد_التنفيذ", label: "قيد التنفيذ", color: "#d9a752" },
  { key: "بانتظار_المراجعة", label: "بانتظار المراجعة", color: "#36b7b4" },
  { key: "مكتملة", label: "مكتملة", color: "#5cc68b" },
  { key: "متأخرة", label: "متأخرة", color: "#f47b43" },
];

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; className: string }> = {
  عاجلة: { label: "عاجلة", className: "border-[#f47b43]/45 bg-[#f47b43]/12 text-[#ffc0a0]" },
  عالية: { label: "عالية", className: "border-[#d9a752]/40 bg-[#d9a752]/12 text-[#f2d394]" },
  متوسطة: { label: "متوسطة", className: "border-[#36b7b4]/35 bg-[#36b7b4]/10 text-[#9be7df]" },
  منخفضة: { label: "منخفضة", className: "border-white/15 bg-white/[0.05] text-[#d3d0c8]" },
};

const EXECUTIVE_GLASS =
  "relative overflow-hidden rounded-[10px] border border-white/[0.09] bg-[#0b1621]/94 " +
  "shadow-[0_14px_36px_rgba(0,0,0,0.22)] backdrop-blur-[12px]";

const EXECUTIVE_INSET =
  "rounded-[8px] border border-white/[0.08] bg-[#07111b]/72";

const INPUT_CLASS =
  "min-h-11 w-full rounded-[8px] border border-white/[0.10] bg-[#07111b]/80 px-3 text-xs text-[#f6f8fb] " +
  "outline-none transition-colors duration-150 placeholder:text-[#8d9baa] focus:border-[#4d9cff]/70 focus:ring-2 focus:ring-[#4d9cff]/15";

type ViewMode = "kanban" | "list";
type TaskFilter = TaskStatus | "الكل";
type PriorityFilter = TaskPriority | "الكل";
type TaskStats = {
  total: number;
  new: number;
  inProgress: number;
  review: number;
  late: number;
  completed: number;
};
type OperationalScope = {
  departments: { label: string; total: number; late: number; review: number }[];
  highLoad: { name: string; department: string; count: number }[];
  topEmployee: { name: string; department: string; count: number } | null;
  clientLinked: Task[];
  unscoped: Task[];
};
type SmartListItem = {
  id: string;
  label: string;
  note?: string;
  icon: ReactNode;
  active?: boolean;
  href?: string;
  onSelect?: () => void;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("ar-SA", {
  timeZone: "Asia/Riyadh",
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatDueDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATE_FORMATTER.format(date);
}

function isOverdue(dueDate: string, status: TaskStatus) {
  if (status === "مكتملة") return false;
  const due = new Date(dueDate);
  return !Number.isNaN(due.getTime()) && due < new Date();
}

function statusMeta(status: TaskStatus) {
  return STATUS_COLUMNS.find((column) => column.key === status)
    ?? { key: status, label: status, color: "#d3d0c8" };
}

function ExecutiveGlass({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(EXECUTIVE_GLASS, className)}>
      <div className="relative z-10">{children}</div>
    </section>
  );
}

function ExecutiveModal({
  open,
  title,
  eyebrow,
  children,
  footer,
  onClose,
  returnFocus,
}: {
  open: boolean;
  title: string;
  eyebrow: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  returnFocus?: HTMLElement | null;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = requestAnimationFrame(() => closeButtonRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "a[href],button:not(:disabled),textarea,input:not([type='hidden']):not([hidden]),select,[tabindex]:not([tabindex='-1'])",
        ),
      ).filter((element) => element.tabIndex !== -1 && element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      requestAnimationFrame(() => returnFocus?.focus());
    };
  }, [open, returnFocus]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#02070d]/72 p-0 backdrop-blur-[5px] animate-in fade-in duration-200 motion-reduce:animate-none sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tasks-executive-panel-title"
        className={cn(
          "flex max-h-[88svh] w-full flex-col overflow-hidden rounded-t-[16px] border border-white/[0.10]",
          "bg-[#0b1621] shadow-[0_28px_80px_rgba(0,0,0,0.52)]",
          "animate-in slide-in-from-bottom-4 duration-200 motion-reduce:animate-none sm:max-w-[540px] sm:rounded-[12px] sm:zoom-in-95",
        )}
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/[0.12] px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <small className="block text-[10px] font-bold text-[#6aa8ff]">{eyebrow}</small>
            <h2 id="tasks-executive-panel-title" className="mt-1 truncate text-lg font-black text-[#f6f8fb]">{title}</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="إغلاق النافذة"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] text-[#aeb9c5] transition-colors hover:bg-white/[0.055] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]"
          >
            <X size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {children}
        </div>
        {footer ? (
          <footer className="shrink-0 border-t border-white/[0.12] px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-5">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

function StatusNavigation({
  stats,
  lateFilterCount,
  value,
  onChange,
}: {
  stats: TaskStats;
  lateFilterCount: number;
  value: TaskFilter;
  onChange: (value: TaskFilter) => void;
}) {
  const items: { label: string; value: TaskFilter; count: number }[] = [
    { label: "الكل", value: "الكل", count: stats.total },
    { label: "الجديدة", value: "جديدة", count: stats.new },
    { label: "قيد التنفيذ", value: "قيد_التنفيذ", count: stats.inProgress },
    { label: "للمراجعة", value: "بانتظار_المراجعة", count: stats.review },
    { label: "المتأخرة", value: "متأخرة", count: lateFilterCount },
    { label: "المكتملة", value: "مكتملة", count: stats.completed },
  ];

  return (
    <nav
      aria-label="تصفية المهام حسب الحالة"
      className="overflow-x-auto overscroll-x-contain border-b border-white/[0.08] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex min-w-max items-center gap-1 px-2 py-2 sm:px-3">
        {items.map((item) => {
          const selected = value === item.value;
          return (
          <button
            key={item.label}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(item.value)}
            className={cn(
              "inline-flex min-h-10 items-center gap-2 rounded-[7px] px-3 text-[11px] font-bold",
              "transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]",
              selected
                ? "bg-[#2276e3] text-white"
                : "text-[#aeb9c5] hover:bg-white/[0.055] hover:text-[#f6f8fb]",
            )}
          >
            <span>{item.label}</span>
            <span className={cn("tabular-nums", selected ? "text-white/75" : "text-[#718090]")}>{item.count}</span>
          </button>
          );
        })}
      </div>
    </nav>
  );
}

function OperationalOverview({
  stats,
  operationalScope,
}: {
  stats: TaskStats;
  operationalScope: OperationalScope;
}) {
  const stages = [
    { label: "جديدة", value: stats.new },
    { label: "قيد التنفيذ", value: stats.inProgress },
    { label: "للمراجعة", value: stats.review },
    { label: "مكتملة", value: stats.completed },
  ];
  const topLoad = operationalScope.topEmployee;
  const topDepartment = operationalScope.departments[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="توزيع مراحل المهام">
        {stages.map((stage) => (
          <div key={stage.label} className={cn(EXECUTIVE_INSET, "px-3 py-3")}>
            <span className="block text-[10px] text-[#8d9baa]">{stage.label}</span>
            <strong className="mt-1 block text-xl font-black tabular-nums text-[#f6f8fb]">{stage.value}</strong>
          </div>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className={cn(EXECUTIVE_INSET, "flex items-center justify-between gap-3 px-3 py-3")}>
          <span className="text-[11px] text-[#aeb9c5]">المهام المتأخرة</span>
          <strong className={cn("text-lg tabular-nums", stats.late ? "text-[#ff9d8a]" : "text-[#f6f8fb]")}>{stats.late}</strong>
        </div>
        <div className={cn(EXECUTIVE_INSET, "min-w-0 px-3 py-3")}>
          <span className="block text-[10px] text-[#8d9baa]">أعلى حمل للموظفين</span>
          <strong className="mt-1 block truncate text-xs text-[#f6f8fb]">
            {topLoad ? `${topLoad.name} · ${topLoad.count} مهام` : "لا يوجد حمل حالي"}
          </strong>
        </div>
        <div className={cn(EXECUTIVE_INSET, "min-w-0 px-3 py-3")}>
          <span className="block text-[10px] text-[#8d9baa]">أعلى حمل للأقسام</span>
          <strong className="mt-1 block truncate text-xs text-[#f6f8fb]">
            {topDepartment ? `${topDepartment.label} · ${topDepartment.total} مهام` : "لا يوجد توزيع حالي"}
          </strong>
        </div>
        <div className={cn(EXECUTIVE_INSET, "flex items-center justify-between gap-3 px-3 py-3")}>
          <span className="text-[11px] text-[#aeb9c5]">مهام غير مرتبطة تنظيميًا</span>
          <strong className={cn("text-lg tabular-nums", operationalScope.unscoped.length ? "text-[#ff9d8a]" : "text-[#f6f8fb]")}>
            {operationalScope.unscoped.length}
          </strong>
        </div>
      </div>
      <p className="text-[10px] leading-5 text-[#718090]">يعكس هذا الملخص بيانات المهام والهيكل المحمّلة حاليًا، وليس تحديثًا لحظيًا.</p>
    </div>
  );
}

type FilterControlsProps = {
  status: TaskFilter;
  priority: PriorityFilter;
  assignee: string;
  client: string;
  employees: Employee[];
  clients: Client[];
  hasActiveFilters: boolean;
  onStatusChange: (value: TaskFilter) => void;
  onPriorityChange: (value: PriorityFilter) => void;
  onAssigneeChange: (value: string) => void;
  onClientChange: (value: string) => void;
  onReset: () => void;
};

function FilterControls({
  status,
  priority,
  assignee,
  client,
  employees,
  clients,
  hasActiveFilters,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
  onClientChange,
  onReset,
}: FilterControlsProps) {
  return (
    <div className="grid grid-cols-1 gap-2">
      <label className="min-w-0">
        <span className="mb-1.5 block text-[10px] font-bold text-[#aeb9c5]">الحالة</span>
        <select value={status} onChange={(event) => onStatusChange(event.target.value as TaskFilter)} className={INPUT_CLASS}>
          <option value="الكل">كل الحالات</option>
          {STATUS_COLUMNS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
      </label>
      <label className="min-w-0">
        <span className="mb-1.5 block text-[10px] font-bold text-[#aeb9c5]">الأولوية</span>
        <select value={priority} onChange={(event) => onPriorityChange(event.target.value as PriorityFilter)} className={INPUT_CLASS}>
          <option value="الكل">كل الأولويات</option>
          {Object.entries(PRIORITY_CONFIG).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
        </select>
      </label>
      <label className="min-w-0">
        <span className="mb-1.5 block text-[10px] font-bold text-[#aeb9c5]">المكلّف</span>
        <select value={assignee} onChange={(event) => onAssigneeChange(event.target.value)} className={INPUT_CLASS}>
          <option value="الكل">كل المكلّفين</option>
          {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
        </select>
      </label>
      <label className="min-w-0">
        <span className="mb-1.5 block text-[10px] font-bold text-[#aeb9c5]">العميل</span>
        <select value={client} onChange={(event) => onClientChange(event.target.value)} className={INPUT_CLASS}>
          <option value="الكل">كل العملاء</option>
          {clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      {hasActiveFilters ? (
        <button
          type="button"
          onClick={onReset}
          className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-[7px] border border-white/[0.10] bg-white/[0.045] px-3 text-[11px] font-bold text-[#e4e9ef] transition-colors hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]"
        >
          <RotateCcw size={13} />
          إعادة الضبط
        </button>
      ) : null}
    </div>
  );
}

function WorkspaceState({
  icon,
  title,
  note,
  action,
}: {
  icon: ReactNode;
  title: string;
  note: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center px-5 py-10 text-center">
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-[10px] bg-[#2276e3]/10 text-[#8bbcff]">
        {icon}
      </span>
      <strong className="text-sm font-black text-[#f6f8fb]">{title}</strong>
      <p className="mt-2 max-w-sm text-xs leading-6 text-[#8d9baa]">{note}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function TaskActionsMenu({
  task,
  canManage,
  onOpen,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  task: Task;
  canManage: boolean;
  onOpen: (trigger: HTMLElement) => void;
  onEdit: (trigger: HTMLElement) => void;
  onDelete: () => void;
  onStatusChange: (status: TaskStatus) => void;
}) {
  return (
    <details className="group relative">
      <summary
        aria-label={`إجراءات ${task.title}`}
        className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-[7px] text-[#8d9baa] marker:hidden transition-colors hover:bg-white/[0.055] hover:text-[#f6f8fb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]"
      >
        <MoreHorizontal size={16} />
      </summary>
      <div className="absolute left-0 top-12 z-20 min-w-40 overflow-hidden rounded-[9px] border border-white/[0.10] bg-[#0b1621] p-1.5 shadow-[0_16px_36px_rgba(0,0,0,0.4)]">
        <button
          type="button"
          onClick={(event) => onOpen(event.currentTarget)}
          className="flex min-h-11 w-full items-center gap-2 rounded-[7px] px-3 text-right text-[11px] font-bold text-[#e4e9ef] hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]"
        >
          <CircleDot size={13} />
          عرض التفاصيل
        </button>
        <label className="block px-3 py-2">
          <span className="mb-1 block text-[9px] text-[#8d9baa]">تغيير الحالة</span>
          <select
            aria-label={`تغيير حالة ${task.title}`}
            value={task.status}
            onChange={(event) => onStatusChange(event.target.value as TaskStatus)}
            className="min-h-11 w-full rounded-[7px] border border-white/[0.08] bg-[#07111b] px-2 text-[10px] text-[#d7dee6] outline-none focus:border-[#4d9cff]/70 focus:ring-2 focus:ring-[#4d9cff]/15"
          >
            {STATUS_COLUMNS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </label>
        {canManage ? (
          <>
            <button
              type="button"
              onClick={(event) => onEdit(event.currentTarget)}
              className="flex min-h-11 w-full items-center gap-2 rounded-[7px] px-3 text-right text-[11px] font-bold text-[#e4e9ef] hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]"
            >
              <Edit2 size={13} />
              تعديل
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="flex min-h-11 w-full items-center gap-2 rounded-[7px] px-3 text-right text-[11px] font-bold text-[#ff9d8a] hover:bg-[#d95b49]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]"
            >
              <Trash2 size={13} />
              حذف
            </button>
          </>
        ) : null}
      </div>
    </details>
  );
}

function SmartListMenu({
  open,
  items,
  onClose,
  returnFocus,
}: {
  open: boolean;
  items: SmartListItem[];
  onClose: () => void;
  returnFocus: HTMLButtonElement | null;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const previousOverflow = document.body.style.overflow;
    if (isMobile) document.body.style.overflow = "hidden";

    const frame = requestAnimationFrame(() => {
      const preferred = panel?.querySelector<HTMLElement>("[data-active='true']")
        ?? panel?.querySelector<HTMLElement>("[role='menuitem']");
      preferred?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (!panel) return;
      const menuItems = Array.from(panel.querySelectorAll<HTMLElement>("[role='menuitem']"))
        .filter((element) => element.tabIndex !== -1 && element.offsetParent !== null);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (!menuItems.length) return;
        event.preventDefault();
        const currentIndex = menuItems.indexOf(document.activeElement as HTMLElement);
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const nextIndex = currentIndex < 0
          ? 0
          : (currentIndex + direction + menuItems.length) % menuItems.length;
        menuItems[nextIndex]?.focus();
      } else if (event.key === "Home" || event.key === "End") {
        if (!menuItems.length) return;
        event.preventDefault();
        menuItems[event.key === "Home" ? 0 : menuItems.length - 1]?.focus();
      } else if (event.key === "Tab" && isMobile) {
        const focusable = Array.from(panel.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href], input:not([type='hidden']):not([hidden]), select, textarea, [tabindex]:not([tabindex='-1'])",
        )).filter((element) => element.tabIndex !== -1 && element.offsetParent !== null);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    const onOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panel.contains(target) && !returnFocus?.contains(target)) closeRef.current();
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onOutsideClick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onOutsideClick);
      if (isMobile) document.body.style.overflow = previousOverflow;
      requestAnimationFrame(() => returnFocus?.focus());
    };
  }, [open, returnFocus]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-[#02070d]/70 backdrop-blur-[7px] md:absolute md:inset-auto md:left-0 md:top-[calc(100%+6px)] md:block md:bg-transparent md:backdrop-blur-none"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        id="tasks-smart-list-menu"
        role="menu"
        aria-label="الإجراءات الثانوية"
        className={cn(
          "flex max-h-[78svh] w-full flex-col overflow-hidden rounded-t-[16px] border border-white/[0.10]",
          "bg-[#0b1621] shadow-[0_24px_64px_rgba(0,0,0,0.5)]",
          "animate-in slide-in-from-bottom-2 duration-150 motion-reduce:animate-none",
          "md:w-[296px] md:rounded-[10px] md:zoom-in-95",
        )}
      >
        <div className="sticky top-0 flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] bg-[#0b1621] px-4 py-3">
          <div>
            <strong className="block text-sm font-black text-[#f6f8fb]">إجراءات المهام</strong>
            <span className="text-[9px] text-[#8d9baa]">أدوات إضافية لمساحة العمل</span>
          </div>
          <button
            type="button"
            aria-label="إغلاق قائمة الإجراءات"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-[7px] text-[#aeb9c5] hover:bg-white/[0.055] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]"
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 pb-[max(8px,env(safe-area-inset-bottom))]">
          {items.map((item) => {
            const itemClassName = cn(
              "flex min-h-12 w-full items-center gap-3 rounded-[7px] px-3 py-2 text-right",
              "transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]",
              item.active ? "bg-[#2276e3]/16 text-[#dbeaff]" : "text-[#e4e9ef] hover:bg-white/[0.055]",
            );
            const content = (
              <>
                <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-[6px] bg-white/[0.045]", item.active && "bg-[#2276e3]/18 text-[#8bbcff]")}>
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-[11px] font-bold">{item.label}</strong>
                  {item.note ? <small className="mt-0.5 block truncate text-[9px] text-[#8d9baa]">{item.note}</small> : null}
                </span>
                {item.active ? <CheckCircle2 size={14} className="shrink-0 text-[#6aa8ff]" aria-hidden="true" /> : null}
              </>
            );
            if (item.href) {
              return (
                <Link key={item.id} href={item.href} role="menuitem" className={itemClassName} onClick={onClose}>
                  {content}
                </Link>
              );
            }
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                data-active={item.active ? "true" : undefined}
                aria-current={item.active ? "true" : undefined}
                onClick={() => {
                  item.onSelect?.();
                  onClose();
                }}
                className={itemClassName}
              >
                {content}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TasksContent() {
  const { data: tasks, loading, error, refetch, insert, update, remove } = useTasks();
  const { data: clients } = useClients();
  const { data: employees } = useEmployees();
  const { data: orgSnapshot } = useOrgStructure(true);
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const toast = useToast();
  const canManageTasks = hasPermission("manage_tasks");
  const [view, setView] = useState<ViewMode>("kanban");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskFilter>("الكل");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("الكل");
  const [assigneeFilter, setAssigneeFilter] = useState("الكل");
  const [clientFilter, setClientFilter] = useState("الكل");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [smartListOpen, setSmartListOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const smartListTriggerRef = useRef<HTMLButtonElement>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "جديدة" as TaskStatus,
    priority: "متوسطة" as TaskPriority,
    assigneeId: "",
    assigneeName: "",
    clientId: "",
    clientName: "",
    dueDate: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setView("list");
  }, []);

  const rememberTrigger = (trigger?: HTMLElement | null) => {
    if (trigger) returnFocusRef.current = trigger;
  };

  const resetForm = () => {
    setForm({
      title: "",
      description: "",
      status: "جديدة",
      priority: "متوسطة",
      assigneeId: "",
      assigneeName: "",
      clientId: "",
      clientName: "",
      dueDate: new Date().toISOString().split("T")[0],
    });
    setEditTask(null);
  };

  const openAdd = (trigger?: HTMLElement | null) => {
    rememberTrigger(trigger);
    resetForm();
    setShowModal(true);
  };

  const openEdit = (task: Task, trigger?: HTMLElement | null) => {
    rememberTrigger(trigger);
    setEditTask(task);
    setForm({
      title: task.title,
      description: task.description ?? "",
      status: task.status,
      priority: task.priority,
      assigneeId: task.assigneeId,
      assigneeName: task.assigneeName,
      clientId: task.clientId ?? "",
      clientName: task.clientName ?? "",
      dueDate: task.dueDate,
    });
    setShowModal(true);
  };

  const openDetails = (taskId: string, trigger?: HTMLElement | null) => {
    rememberTrigger(trigger);
    setDetailsId(taskId);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("عنوان المهمة مطلوب");
      return;
    }
    setSaving(true);
    try {
      const assigneeId = form.assigneeId || user?.id || "";
      const assigneeName = form.assigneeName || user?.email || "";
      const payload = {
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        assigneeId,
        assigneeName,
        clientId: form.clientId || undefined,
        clientName: form.clientName || undefined,
        dueDate: form.dueDate,
      };
      if (editTask) {
        await update(editTask.id, payload);
        toast.success("تم تحديث المهمة بنجاح");
      } else {
        await insert(payload);
        toast.success("تمت إضافة المهمة بنجاح");
      }
      setShowModal(false);
      resetForm();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "تعذر حفظ المهمة");
      console.error("[Task Save Error]", saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async (taskId: string, title: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف "${title}"؟`)) return;
    try {
      await remove(taskId);
      toast.success("تم حذف المهمة بنجاح");
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "تعذر حذف المهمة");
      console.error("[Task Delete Error]", deleteError);
    }
  };

  const moveTask = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await update(taskId, { status: newStatus });
    } catch (moveError) {
      toast.error(moveError instanceof Error ? moveError.message : "تعذر تحديث المهمة");
      console.error("[Task Move Error]", moveError);
    }
  };

  const stats = useMemo<TaskStats>(() => ({
    total: tasks.length,
    new: tasks.filter((task) => task.status === "جديدة").length,
    inProgress: tasks.filter((task) => task.status === "قيد_التنفيذ").length,
    review: tasks.filter((task) => task.status === "بانتظار_المراجعة").length,
    late: tasks.filter((task) => task.status === "متأخرة" || isOverdue(task.dueDate, task.status)).length,
    completed: tasks.filter((task) => task.status === "مكتملة").length,
  }), [tasks]);

  const orgResolver = useMemo(
    () => createOrgScopeResolver(orgSnapshot, employees),
    [orgSnapshot, employees],
  );

  const managerCommand = useMemo(() => {
    const departmentMap = new Map<string, { label: string; total: number; late: number; review: number }>();
    const employeeLoad = new Map<string, { name: string; department: string; count: number }>();

    tasks.forEach((task) => {
      const scope = orgResolver.resolveTaskAssignee(task);
      const department = scope.departmentLabel || ORG_UNKNOWN_LABEL;
      const departmentKey = scope.departmentId ?? department;
      const currentDepartment = departmentMap.get(departmentKey) ?? {
        label: department,
        total: 0,
        late: 0,
        review: 0,
      };
      currentDepartment.total += 1;
      if (task.status === "متأخرة" || isOverdue(task.dueDate, task.status)) currentDepartment.late += 1;
      if (task.status === "بانتظار_المراجعة") currentDepartment.review += 1;
      departmentMap.set(departmentKey, currentDepartment);

      const employeeKey = scope.employeeId ?? task.assigneeName ?? ORG_UNKNOWN_LABEL;
      const currentEmployee = employeeLoad.get(employeeKey) ?? {
        name: scope.employeeName,
        department,
        count: 0,
      };
      if (task.status !== "مكتملة") currentEmployee.count += 1;
      employeeLoad.set(employeeKey, currentEmployee);
    });

    return {
      departments: Array.from(departmentMap.values()).sort((a, b) => b.total - a.total).slice(0, 4),
      highLoad: Array.from(employeeLoad.values()).filter((item) => item.count >= 4).sort((a, b) => b.count - a.count).slice(0, 4),
      topEmployee: Array.from(employeeLoad.values()).filter((item) => item.count > 0).sort((a, b) => b.count - a.count)[0] ?? null,
      clientLinked: tasks.filter((task) => Boolean(task.clientId || task.clientName)),
      unscoped: tasks.filter((task) => !orgResolver.resolveTaskAssignee(task).isLinkedToOrg),
    };
  }, [orgResolver, tasks]);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ar");
    return tasks.filter((task) => {
      const matchesSearch = !query
        || task.title.toLocaleLowerCase("ar").includes(query)
        || (task.description ?? "").toLocaleLowerCase("ar").includes(query)
        || (task.assigneeName ?? "").toLocaleLowerCase("ar").includes(query)
        || (task.clientName ?? "").toLocaleLowerCase("ar").includes(query)
        || (task.publicCode ?? "").toLocaleLowerCase("ar").includes(query);
      return matchesSearch
        && (statusFilter === "الكل" || task.status === statusFilter)
        && (priorityFilter === "الكل" || task.priority === priorityFilter)
        && (assigneeFilter === "الكل" || task.assigneeId === assigneeFilter)
        && (clientFilter === "الكل" || task.clientId === clientFilter);
    });
  }, [assigneeFilter, clientFilter, priorityFilter, search, statusFilter, tasks]);

  const hasActiveFilters = Boolean(search.trim())
    || statusFilter !== "الكل"
    || priorityFilter !== "الكل"
    || assigneeFilter !== "الكل"
    || clientFilter !== "الكل";
  const activeFilterCount = [
    statusFilter !== "الكل",
    priorityFilter !== "الكل",
    assigneeFilter !== "الكل",
    clientFilter !== "الكل",
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("الكل");
    setPriorityFilter("الكل");
    setAssigneeFilter("الكل");
    setClientFilter("الكل");
  };

  const openMySmartList = () => {
    resetFilters();
    if (user?.id) setAssigneeFilter(user.id);
    setView("list");
  };

  const openAdvancedFilters = () => {
    rememberTrigger(smartListTriggerRef.current);
    requestAnimationFrame(() => setFiltersOpen(true));
  };

  const openOperationalOverview = () => {
    rememberTrigger(smartListTriggerRef.current);
    requestAnimationFrame(() => setInsightsOpen(true));
  };

  const smartListItems: SmartListItem[] = [
    {
      id: "office",
      label: "المكتب الذكي",
      note: "العودة إلى مساحة عملك الرقمية",
      icon: <BriefcaseBusiness size={14} />,
      href: "/tasks/my-desk",
    },
    {
      id: "smart-list",
      label: "القائمة الذكية",
      note: user?.id ? "مهامك المكلّفة في عرض مركّز" : "عرض مركّز للمهام",
      icon: <List size={14} />,
      active: view === "list" && Boolean(user?.id) && assigneeFilter === user?.id,
      onSelect: openMySmartList,
    },
    {
      id: "view",
      label: view === "kanban" ? "التبديل إلى القائمة" : "التبديل إلى Kanban",
      note: "تغيير طريقة عرض المهام الحالية",
      icon: view === "kanban" ? <List size={14} /> : <Columns size={14} />,
      onSelect: () => setView((current) => current === "kanban" ? "list" : "kanban"),
    },
    {
      id: "insights",
      label: "نظرة تشغيلية",
      note: "ملخص الأحمال والتوزيع الحالي",
      icon: <Radar size={14} />,
      onSelect: openOperationalOverview,
    },
    {
      id: "filters",
      label: "مرشحات متقدمة",
      note: activeFilterCount ? `${activeFilterCount} مرشح نشط` : "الحالة والأولوية والمكلّف والعميل",
      icon: <SlidersHorizontal size={14} />,
      active: activeFilterCount > 0,
      onSelect: openAdvancedFilters,
    },
  ];

  const filterControlProps: FilterControlsProps = {
    status: statusFilter,
    priority: priorityFilter,
    assignee: assigneeFilter,
    client: clientFilter,
    employees,
    clients,
    hasActiveFilters,
    onStatusChange: setStatusFilter,
    onPriorityChange: setPriorityFilter,
    onAssigneeChange: setAssigneeFilter,
    onClientChange: setClientFilter,
    onReset: resetFilters,
  };

  const detailsTask = detailsId ? tasks.find((task) => task.id === detailsId) ?? null : null;

  const renderTaskCard = (task: Task) => {
    const overdue = isOverdue(task.dueDate, task.status);
    const meta = statusMeta(task.status);
    return (
      <article key={task.id} className="flex min-h-[156px] flex-col rounded-[9px] bg-[#101d29] p-3 transition-colors duration-150 hover:bg-[#132230]">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={(event) => openDetails(task.id, event.currentTarget)}
            className="min-w-0 flex-1 rounded-[6px] text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]"
          >
            <span className="mb-2 flex items-center gap-2">
              <i className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                task.priority === "عاجلة" && "bg-[#ff7967]",
                task.priority === "عالية" && "bg-[#d4a84f]",
                task.priority === "متوسطة" && "bg-[#55bfc3]",
                task.priority === "منخفضة" && "bg-[#718090]",
              )} aria-hidden="true" />
              <span className="text-[9px] font-bold text-[#8d9baa]">{PRIORITY_CONFIG[task.priority].label}</span>
            </span>
            <strong className="block text-[13px] font-black leading-6 text-[#f6f8fb] line-clamp-3">{task.title}</strong>
          </button>
          <TaskActionsMenu
            task={task}
            canManage={canManageTasks}
            onOpen={(trigger) => openDetails(task.id, trigger)}
            onEdit={(trigger) => openEdit(task, trigger)}
            onDelete={() => void handleDeleteTask(task.id, task.title)}
            onStatusChange={(status) => void moveTask(task.id, status)}
          />
        </div>
        <div className="mt-auto flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-white/[0.07] pt-3 text-[10px] text-[#8d9baa]">
          <span style={{ color: meta.color }}>{meta.label}</span>
          <span className="flex min-w-0 items-center gap-1.5">
            <UserRound size={11} className="shrink-0" />
            <span className="max-w-32 truncate">{task.assigneeName || "غير محدد"}</span>
          </span>
          <div className={cn("flex items-center gap-1.5", overdue && "text-[#ffc0a0]")}>
            <CalendarDays size={11} />
            <span>{formatDueDate(task.dueDate)}</span>
          </div>
        </div>
      </article>
    );
  };

  return (
    <DashboardLayout>
      <div
        dir="rtl"
        className="relative isolate -m-premium-3 min-h-full overflow-x-clip bg-[#07111b] p-3 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))] font-[Tajawal,'IBM_Plex_Sans_Arabic','Segoe_UI',Tahoma,sans-serif] text-[#f6f8fb] sm:-m-premium-4 sm:p-4 lg:-m-premium-6 lg:p-5"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(circle_at_50%_-20%,rgba(45,111,190,0.14),transparent_64%)]" />
        <div className="mx-auto w-full max-w-[1480px] space-y-3">
          <header className={cn(EXECUTIVE_GLASS, "!overflow-visible p-3 sm:p-4")}>
            <div className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:grid-cols-[220px_minmax(320px,1fr)_auto_auto]">
              <div className="min-w-0 lg:col-start-1 lg:row-start-1">
                <h1 className="text-xl font-black leading-tight text-[#f6f8fb] sm:text-2xl">المهام</h1>
                <p className="mt-1 hidden text-[11px] text-[#8d9baa] sm:block">مساحة هادئة لتنظيم التنفيذ ومتابعة التقدم.</p>
              </div>

              {canManageTasks ? (
                <button
                  type="button"
                  onClick={(event) => openAdd(event.currentTarget)}
                  aria-label="مهمة جديدة"
                  className="inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-[8px] bg-[#2276e3] px-3 text-xs font-black text-white transition-[background-color,transform] duration-150 hover:bg-[#3185ef] active:translate-y-px motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8bbcff] lg:col-start-3 lg:row-start-1"
                >
                  <Plus size={16} />
                  <span className="hidden min-[380px]:inline">مهمة جديدة</span>
                </button>
              ) : <span />}

              <p className="col-span-2 text-[11px] text-[#8d9baa] sm:hidden">
                {tasks.length} مهمة ضمن نطاقك · {stats.inProgress} قيد التنفيذ
              </p>

              <label className="relative min-w-0 lg:col-start-2 lg:row-start-1">
                <span className="sr-only">البحث في المهام</span>
                <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#718090]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ابحث عن مهمة أو عميل أو مكلّف..."
                  className={cn(INPUT_CLASS, "h-12 pr-9 lg:h-11")}
                />
              </label>

              <div className="relative lg:col-start-4 lg:row-start-1">
                <button
                  ref={smartListTriggerRef}
                  type="button"
                  aria-label="فتح إجراءات المهام"
                  aria-haspopup="menu"
                  aria-expanded={smartListOpen}
                  aria-controls="tasks-smart-list-menu"
                  onClick={() => setSmartListOpen((current) => !current)}
                  className={cn(
                    "relative grid h-12 w-12 place-items-center rounded-[8px] border border-white/[0.10] text-[#aeb9c5]",
                    "transition-colors duration-150 hover:bg-white/[0.055] hover:text-white motion-reduce:transition-none",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff] lg:h-11 lg:w-11",
                    smartListOpen && "border-[#4d9cff]/45 bg-[#2276e3]/12 text-[#8bbcff]",
                  )}
                >
                  <SlidersHorizontal size={16} />
                  {activeFilterCount ? <span className="absolute -left-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#2276e3] px-1 text-[9px] font-black text-white">{activeFilterCount}</span> : null}
                </button>
                <SmartListMenu
                  open={smartListOpen}
                  items={smartListItems}
                  onClose={() => setSmartListOpen(false)}
                  returnFocus={smartListTriggerRef.current}
                />
              </div>
            </div>
          </header>

          <ExecutiveGlass>
            <StatusNavigation
              stats={stats}
              lateFilterCount={tasks.filter((task) => task.status === "متأخرة").length}
              value={statusFilter}
              onChange={setStatusFilter}
            />
            {hasActiveFilters ? (
              <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                <span className="text-[10px] text-[#718090]">التصفية الحالية</span>
                {search.trim() ? (
                  <button type="button" onClick={() => setSearch("")} className="inline-flex min-h-9 max-w-full items-center gap-1 rounded-full bg-white/[0.055] px-3 text-[10px] text-[#d7dee6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]">
                    <span className="max-w-40 truncate">بحث: {search.trim()}</span><X size={11} />
                  </button>
                ) : null}
                {statusFilter !== "الكل" ? (
                  <button type="button" onClick={() => setStatusFilter("الكل")} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-white/[0.055] px-3 text-[10px] text-[#d7dee6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]">
                    {statusMeta(statusFilter).label}<X size={11} />
                  </button>
                ) : null}
                {priorityFilter !== "الكل" ? (
                  <button type="button" onClick={() => setPriorityFilter("الكل")} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-white/[0.055] px-3 text-[10px] text-[#d7dee6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]">
                    {PRIORITY_CONFIG[priorityFilter].label}<X size={11} />
                  </button>
                ) : null}
                {assigneeFilter !== "الكل" ? (
                  <button type="button" onClick={() => setAssigneeFilter("الكل")} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-white/[0.055] px-3 text-[10px] text-[#d7dee6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]">
                    {employees.find((employee) => employee.id === assigneeFilter)?.name ?? "المكلّف"}<X size={11} />
                  </button>
                ) : null}
                {clientFilter !== "الكل" ? (
                  <button type="button" onClick={() => setClientFilter("الكل")} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-white/[0.055] px-3 text-[10px] text-[#d7dee6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]">
                    {clients.find((client) => client.id === clientFilter)?.name ?? "العميل"}<X size={11} />
                  </button>
                ) : null}
                <button type="button" onClick={resetFilters} className="inline-flex min-h-9 items-center gap-1 px-2 text-[10px] font-bold text-[#8bbcff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]">
                  <RotateCcw size={11} />مسح الكل
                </button>
              </div>
            ) : null}
          </ExecutiveGlass>

          <ExecutiveGlass>
            <div className="flex min-h-12 items-center justify-between gap-3 border-b border-white/[0.08] px-3 py-2.5 sm:px-4">
              <div>
                <strong className="block text-xs font-black text-[#f6f8fb]">{view === "kanban" ? "تدفق العمل" : "قائمة المهام"}</strong>
                <span className="text-[10px] text-[#718090]">{filteredTasks.length} من {tasks.length} مهمة</span>
              </div>
              <span className="text-[10px] text-[#8d9baa]">{view === "kanban" ? "Kanban" : "قائمة"}</span>
            </div>

              {loading ? (
                <WorkspaceState icon={<LoaderCircle size={22} className="animate-spin" />} title="جاري تحميل المهام" note="يتم تجهيز مساحة العمل الحالية." />
              ) : error ? (
                <WorkspaceState
                  icon={<AlertTriangle size={22} />}
                  title="تعذر تحميل المهام"
                  note="تحقق من الاتصال ثم أعد المحاولة."
                  action={<button type="button" onClick={() => void refetch()} className="inline-flex min-h-11 items-center gap-2 rounded-[7px] border border-white/[0.10] bg-white/[0.045] px-3 text-[11px] font-bold text-[#e4e9ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]"><RotateCcw size={13} />إعادة المحاولة</button>}
                />
              ) : tasks.length === 0 ? (
                <WorkspaceState
                  icon={<Inbox size={22} />}
                  title="لا توجد مهام بعد"
                  note="ابدأ بإنشاء مهمة لتنظيم العمل ومتابعته."
                />
              ) : filteredTasks.length === 0 ? (
                <WorkspaceState
                  icon={<Search size={22} />}
                  title="لا توجد نتائج مطابقة"
                  note="غيّر البحث أو المرشحات لعرض مهام أخرى."
                  action={<button type="button" onClick={resetFilters} className="inline-flex min-h-11 items-center gap-2 rounded-[7px] border border-white/[0.10] bg-white/[0.045] px-3 text-[11px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]"><RotateCcw size={13} />إعادة الضبط</button>}
                />
              ) : view === "kanban" ? (
                <div className="snap-x snap-mandatory scroll-px-2 overflow-x-auto overscroll-x-contain p-2 sm:p-3">
                  <div className="flex min-w-max gap-2">
                    {STATUS_COLUMNS.map((column, columnIndex) => {
                      const columnTasks = filteredTasks.filter((task) => task.status === column.key);
                      return (
                        <section key={column.key} className="w-[272px] shrink-0 snap-start rounded-[9px] bg-[#07111b]/62 p-2 sm:w-[264px] lg:w-[276px]">
                          <header className="mb-2 flex min-h-9 items-center justify-between gap-2 px-1">
                            <span className="flex items-center gap-2 text-[11px] font-bold text-[#d7dee6]">
                              <i className="h-2 w-2 rounded-full" style={{ backgroundColor: column.color }} />
                              {column.label}
                            </span>
                            <span className="text-[10px] tabular-nums text-[#718090]">{columnTasks.length}</span>
                          </header>
                          <div className="space-y-2">
                            {columnTasks.map(renderTaskCard)}
                            {!columnTasks.length ? (
                              <div className="flex min-h-20 items-center justify-center rounded-[8px] border border-dashed border-white/[0.08] px-3 text-center text-[10px] text-[#718090]">
                                لا توجد مهام في هذه المرحلة
                              </div>
                            ) : null}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.07]">
                  {filteredTasks.map((task) => {
                    const meta = statusMeta(task.status);
                    const overdue = isOverdue(task.dueDate, task.status);
                    return (
                      <article key={task.id} className="grid min-w-0 gap-3 px-3 py-3 transition-colors duration-150 hover:bg-white/[0.025] sm:px-4 md:grid-cols-[minmax(200px,1.5fr)_minmax(130px,0.8fr)_minmax(128px,0.7fr)_auto] md:items-center">
                        <button type="button" onClick={(event) => openDetails(task.id, event.currentTarget)} className="min-w-0 rounded-[6px] text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]">
                          <span className="mb-1.5 flex items-center gap-2">
                            <i aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", task.priority === "عاجلة" ? "bg-[#ff7967]" : task.priority === "عالية" ? "bg-[#d4a84f]" : task.priority === "متوسطة" ? "bg-[#55bfc3]" : "bg-[#718090]")} />
                            <span className="text-[9px] text-[#8d9baa]">{PRIORITY_CONFIG[task.priority].label}</span>
                          </span>
                          <strong className="block text-[13px] font-black leading-6 text-[#f6f8fb] line-clamp-2">{task.title}</strong>
                        </button>
                        <span className="flex min-w-0 items-center gap-2 text-[10px] text-[#8d9baa]"><UserRound size={12} /><span className="truncate">{task.assigneeName || "غير محدد"}</span></span>
                        <div className="flex flex-wrap items-center gap-2 text-[10px]">
                          <span style={{ color: meta.color }}>{meta.label}</span>
                          <span className={cn("flex items-center gap-1.5 text-[#8d9baa]", overdue && "text-[#ff9d8a]")}><CalendarDays size={11} />{formatDueDate(task.dueDate)}</span>
                        </div>
                        <div className="flex min-w-0 items-center md:justify-end">
                          <TaskActionsMenu
                            task={task}
                            canManage={canManageTasks}
                            onOpen={(trigger) => openDetails(task.id, trigger)}
                            onEdit={(trigger) => openEdit(task, trigger)}
                            onDelete={() => void handleDeleteTask(task.id, task.title)}
                            onStatusChange={(status) => void moveTask(task.id, status)}
                          />
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
          </ExecutiveGlass>
        </div>
      </div>

      <ExecutiveModal
        open={insightsOpen}
        title="نظرة تشغيلية"
        eyebrow="ملخص المهام"
        onClose={() => setInsightsOpen(false)}
        returnFocus={returnFocusRef.current}
      >
        <OperationalOverview stats={stats} operationalScope={managerCommand} />
      </ExecutiveModal>

      <ExecutiveModal
        open={filtersOpen}
        title={activeFilterCount ? `تصفية مساحة العمل · ${activeFilterCount}` : "تصفية مساحة العمل"}
        eyebrow="أدوات المهام"
        onClose={() => setFiltersOpen(false)}
        returnFocus={returnFocusRef.current}
        footer={
          <div className="flex gap-2">
            {hasActiveFilters ? (
              <button type="button" onClick={resetFilters} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[7px] border border-white/[0.10] bg-white/[0.045] text-xs font-bold text-[#e4e9ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]">
                <RotateCcw size={13} />
                إعادة الضبط
              </button>
            ) : null}
            <button type="button" onClick={() => setFiltersOpen(false)} className="min-h-11 flex-1 rounded-[7px] bg-[#2276e3] text-xs font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8bbcff]">عرض النتائج</button>
          </div>
        }
      >
        <FilterControls {...filterControlProps} />
      </ExecutiveModal>

      <ExecutiveModal
        open={Boolean(detailsTask)}
        title={detailsTask?.title ?? "تفاصيل المهمة"}
        eyebrow="مساحة تنفيذ المهام"
        onClose={() => setDetailsId(null)}
        returnFocus={returnFocusRef.current}
        footer={detailsTask && canManageTasks ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => { const task = detailsTask; setDetailsId(null); openEdit(task); }} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[7px] border border-white/[0.10] bg-white/[0.045] text-xs font-bold text-[#e4e9ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]"><Edit2 size={14} />تعديل</button>
            <button type="button" onClick={() => { const task = detailsTask; setDetailsId(null); void handleDeleteTask(task.id, task.title); }} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[7px] border border-[#d95b49]/24 bg-[#d95b49]/8 text-xs font-bold text-[#ff9d8a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]"><Trash2 size={14} />حذف</button>
          </div>
        ) : undefined}
      >
        {detailsTask ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <span className={cn("rounded-full border px-2 py-1 text-[10px] font-black", PRIORITY_CONFIG[detailsTask.priority].className)}>{PRIORITY_CONFIG[detailsTask.priority].label}</span>
              <span className="rounded-full border px-2 py-1 text-[10px] font-black" style={{ borderColor: `${statusMeta(detailsTask.status).color}55`, color: statusMeta(detailsTask.status).color }}>{statusMeta(detailsTask.status).label}</span>
              <PublicCodeBadge code={detailsTask.publicCode} />
            </div>
            {detailsTask.description ? <p className="text-xs leading-6 text-[#d3d0c8]/80">{detailsTask.description}</p> : null}
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { label: "المكلّف", value: detailsTask.assigneeName || "غير محدد", icon: <UserRound size={13} /> },
                { label: "العميل", value: detailsTask.clientName || "دون عميل", icon: <Building2 size={13} /> },
                { label: "الموعد النهائي", value: formatDueDate(detailsTask.dueDate), icon: <CalendarDays size={13} /> },
                { label: "الحالة", value: statusMeta(detailsTask.status).label, icon: <CircleDot size={13} /> },
              ].map((item) => (
                <div key={item.label} className={cn(EXECUTIVE_INSET, "flex items-center gap-2.5 px-3 py-2.5")}>
                  <span className="text-[#6aa8ff]">{item.icon}</span>
                  <span className="min-w-0"><small className="block text-[9px] text-[#d3d0c8]/60">{item.label}</small><strong className="block truncate text-[11px]">{item.value}</strong></span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </ExecutiveModal>

      <ExecutiveModal
        open={showModal}
        title={editTask ? "تعديل المهمة" : "إضافة مهمة جديدة"}
        eyebrow="مساحة تنفيذ المهام"
        onClose={() => { setShowModal(false); resetForm(); }}
        returnFocus={returnFocusRef.current}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" onClick={() => { setShowModal(false); resetForm(); }} disabled={saving} className="min-h-11 flex-1 rounded-[7px] border border-white/[0.10] bg-white/[0.045] text-xs font-bold text-[#e4e9ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]">إلغاء</button>
            <button type="button" onClick={() => void handleSave()} disabled={saving} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[7px] bg-[#2276e3] text-xs font-black text-white disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8bbcff]">
              {saving ? <LoaderCircle size={14} className="animate-spin" /> : null}
              {saving ? "جاري الحفظ" : editTask ? "حفظ التعديلات" : "إضافة المهمة"}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-bold text-[#aeb9c5]">عنوان المهمة</span>
            <input className={INPUT_CLASS} placeholder="أدخل عنوان المهمة" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-bold text-[#aeb9c5]">الوصف</span>
            <textarea className={cn(INPUT_CLASS, "min-h-20 resize-y py-2")} placeholder="وصف تفصيلي للمهمة" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1.5 block text-[10px] font-bold text-[#aeb9c5]">الأولوية</span>
              <select className={INPUT_CLASS} value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as TaskPriority })}>
                {Object.entries(PRIORITY_CONFIG).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-[10px] font-bold text-[#aeb9c5]">الحالة</span>
              <select className={INPUT_CLASS} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as TaskStatus })}>
                {STATUS_COLUMNS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1.5 block text-[10px] font-bold text-[#aeb9c5]">المكلّف</span>
              <select className={INPUT_CLASS} value={form.assigneeId} onChange={(event) => { const employee = employees.find((item) => item.id === event.target.value); setForm({ ...form, assigneeId: event.target.value, assigneeName: employee?.name ?? "" }); }}>
                <option value="">اختر موظفًا</option>
                {employees.filter((employee) => employee.status === "نشط").map((employee) => <option key={employee.id} value={employee.id}>{employee.name} ({employee.department})</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-[10px] font-bold text-[#aeb9c5]">الموعد النهائي</span>
              <input className={INPUT_CLASS} type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-bold text-[#aeb9c5]">العميل (اختياري)</span>
            <select className={INPUT_CLASS} value={form.clientId} onChange={(event) => { const client = clients.find((item) => item.id === event.target.value); setForm({ ...form, clientId: event.target.value, clientName: client?.name ?? "" }); }}>
              <option value="">دون عميل</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name} ({client.status})</option>)}
            </select>
          </label>
        </div>
      </ExecutiveModal>
    </DashboardLayout>
  );
}

export default function TasksPage() {
  return (
    <PageGuard permission="manage_tasks">
      <TasksContent />
    </PageGuard>
  );
}
