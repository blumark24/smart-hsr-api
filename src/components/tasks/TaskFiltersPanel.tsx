"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import {
  CheckCircle2,
  Columns,
  List,
  MoreHorizontal,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ORG_UNKNOWN_LABEL,
  createOrgScopeResolver,
} from "@/lib/org/orgScopeResolver";
import type { Client, Employee, Task } from "@/types";
import {
  EXECUTIVE_INSET,
  INPUT_CLASS,
  PRIORITY_CONFIG,
  STATUS_COLUMNS,
  isOverdue,
  statusMeta,
  type PriorityFilter,
  type TaskFilter,
  type TaskStats,
  type ViewMode,
} from "./TaskCard";
import { ExecutiveModal } from "./TaskFormModal";

type OrgScopeResolver = ReturnType<typeof createOrgScopeResolver>;

/**
 * لوحة التصفية وإجراءات مساحة العمل (المرحلة 3 — نقل حرفي بلا تغيير بصري):
 * شريط الحالات + رقائق التصفية، عناصر المرشحات، قائمة الإجراءات الذكية،
 * والنظرة التشغيلية المعروضة داخل نافذة الملخص.
 */

export type OperationalScope = {
  departments: { label: string; total: number; late: number; review: number }[];
  highLoad: { name: string; department: string; count: number }[];
  topEmployee: { name: string; department: string; count: number } | null;
  clientLinked: Task[];
  unscoped: Task[];
};

export type SmartListItem = {
  id: string;
  label: string;
  note?: string;
  icon: ReactNode;
  active?: boolean;
  href?: string;
  onSelect?: () => void;
};

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
      className="overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex min-w-max items-center gap-1.5 px-2 py-2.5 sm:gap-2 sm:px-3">
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
                ? "bg-[#1688d8]/[0.22] text-[#dff6ff] shadow-[inset_0_0_0_1px_rgba(71,193,255,0.16)]"
                : "text-[#aeb9c5] hover:bg-white/[0.055] hover:text-[#f6f8fb]",
            )}
          >
            <span>{item.label}</span>
            <span className={cn("rounded-full px-1.5 py-0.5 tabular-nums", selected ? "bg-[#36b7e9]/[0.14] text-[#93dcff]" : "text-[#718090]")}>{item.count}</span>
          </button>
          );
        })}
      </div>
    </nav>
  );
}

export type TaskStatusFilterBarProps = {
  stats: TaskStats;
  lateFilterCount: number;
  statusFilter: TaskFilter;
  priorityFilter: PriorityFilter;
  assigneeFilter: string;
  clientFilter: string;
  search: string;
  employees: Employee[];
  clients: Client[];
  hasActiveFilters: boolean;
  onStatusChange: (value: TaskFilter) => void;
  onPriorityChange: (value: PriorityFilter) => void;
  onAssigneeChange: (value: string) => void;
  onClientChange: (value: string) => void;
  onSearchClear: () => void;
  onResetAll: () => void;
};

/** شريط تصفية الحالات مع رقائق التصفية النشطة — القسم أسفل الهيدر. */
export function TaskStatusFilterBar({
  stats,
  lateFilterCount,
  statusFilter,
  priorityFilter,
  assigneeFilter,
  clientFilter,
  search,
  employees,
  clients,
  hasActiveFilters,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
  onClientChange,
  onSearchClear,
  onResetAll,
}: TaskStatusFilterBarProps) {
  return (
    <section className="rounded-[10px] bg-[#091827]/92 shadow-[0_10px_28px_rgba(0,0,0,0.20)]">
      <StatusNavigation
        stats={stats}
        lateFilterCount={lateFilterCount}
        value={statusFilter}
        onChange={onStatusChange}
      />
      {hasActiveFilters ? (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          <span className="text-[10px] text-[#718090]">التصفية الحالية</span>
          {search.trim() ? (
            <button type="button" onClick={onSearchClear} className="inline-flex min-h-9 max-w-full items-center gap-1 rounded-full bg-white/[0.055] px-3 text-[10px] text-[#d7dee6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]">
              <span className="max-w-40 truncate">بحث: {search.trim()}</span><X size={11} />
            </button>
          ) : null}
          {statusFilter !== "الكل" ? (
            <button type="button" onClick={() => onStatusChange("الكل")} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-white/[0.055] px-3 text-[10px] text-[#d7dee6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]">
              {statusMeta(statusFilter).label}<X size={11} />
            </button>
          ) : null}
          {priorityFilter !== "الكل" ? (
            <button type="button" onClick={() => onPriorityChange("الكل")} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-white/[0.055] px-3 text-[10px] text-[#d7dee6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]">
              {PRIORITY_CONFIG[priorityFilter].label}<X size={11} />
            </button>
          ) : null}
          {assigneeFilter !== "الكل" ? (
            <button type="button" onClick={() => onAssigneeChange("الكل")} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-white/[0.055] px-3 text-[10px] text-[#d7dee6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]">
              {employees.find((employee) => employee.id === assigneeFilter)?.name ?? "المكلّف"}<X size={11} />
            </button>
          ) : null}
          {clientFilter !== "الكل" ? (
            <button type="button" onClick={() => onClientChange("الكل")} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-white/[0.055] px-3 text-[10px] text-[#d7dee6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]">
              {clients.find((client) => client.id === clientFilter)?.name ?? "العميل"}<X size={11} />
            </button>
          ) : null}
          <button type="button" onClick={onResetAll} className="inline-flex min-h-9 items-center gap-1 px-2 text-[10px] font-bold text-[#8bbcff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]">
            <RotateCcw size={11} />مسح الكل
          </button>
        </div>
      ) : null}
    </section>
  );
}

export type FilterControlsProps = {
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

/** عناصر التصفية داخل نافذة "تصفية مساحة العمل". */
export function FilterControls({
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

/** النظرة التشغيلية — ملخص الأحمال والتوزيع داخل نافذة الملخص. */
export function OperationalOverview({
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

/** قائمة الإجراءات الذكية — Bottom Sheet جوال / Popover سطح مكتب. */
export function SmartListMenu({
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

/** يبني ملخص النظرة التشغيلية — نفس منطق managerCommand السابق في الصفحة حرفيًا. */
export function buildOperationalScope(
  tasks: Task[],
  orgResolver: OrgScopeResolver,
): OperationalScope {
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
}

export type TaskToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  activeFilterCount: number;
  onOpenFilters: (trigger: HTMLElement | null) => void;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  smartListOpen: boolean;
  onSmartListToggle: () => void;
  onSmartListClose: () => void;
  smartListItems: SmartListItem[];
  smartListTriggerRef: RefObject<HTMLButtonElement>;
};

/** صف أدوات مساحة العمل: البحث، المرشحات، مبدّل العرض، وقائمة الإجراءات — منقول حرفيًا من الهيدر. */
export function TaskToolbar({
  search,
  onSearchChange,
  activeFilterCount,
  onOpenFilters,
  view,
  onViewChange,
  smartListOpen,
  onSmartListToggle,
  onSmartListClose,
  smartListItems,
  smartListTriggerRef,
}: TaskToolbarProps) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <label className="relative min-w-0 flex-1 sm:max-w-[440px]">
        <span className="sr-only">البحث في المهام</span>
        <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7d91a4]" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="ابحث في المهام..."
          className={cn(INPUT_CLASS, "h-11 pr-9")}
        />
      </label>

      <button
        type="button"
        onClick={(event) => onOpenFilters(event.currentTarget)}
        aria-label="فتح مرشحات المهام"
        className={cn(
          "relative grid h-11 w-11 shrink-0 place-items-center rounded-[8px] bg-[#102235] text-[#aebdca]",
          "transition-colors duration-150 hover:bg-[#16314a] hover:text-white motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]",
          activeFilterCount > 0 && "bg-[#1688d8]/20 text-[#83d8ff]",
        )}
      >
        <SlidersHorizontal size={16} />
        {activeFilterCount ? <span className="absolute -left-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#25aeea] px-1 text-[9px] font-black text-[#03101a]">{activeFilterCount}</span> : null}
      </button>

      <button
        type="button"
        aria-label={view === "kanban" ? "التبديل إلى عرض القائمة" : "التبديل إلى عرض Kanban"}
        onClick={() => onViewChange(view === "kanban" ? "list" : "kanban")}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] bg-[#102235] text-[#8fdcff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff] sm:hidden"
      >
        {view === "kanban" ? <List size={16} /> : <Columns size={16} />}
      </button>

      <div className="hidden h-11 shrink-0 items-center rounded-[8px] bg-[#102235] p-1 sm:flex" aria-label="طريقة عرض المهام">
        <button
          type="button"
          aria-label="عرض Kanban"
          aria-pressed={view === "kanban"}
          onClick={() => onViewChange("kanban")}
          className={cn("grid h-9 w-9 place-items-center rounded-[6px] text-[#8497aa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]", view === "kanban" && "bg-[#1a73c7] text-white")}
        >
          <Columns size={15} />
        </button>
        <button
          type="button"
          aria-label="عرض القائمة"
          aria-pressed={view === "list"}
          onClick={() => onViewChange("list")}
          className={cn("grid h-9 w-9 place-items-center rounded-[6px] text-[#8497aa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]", view === "list" && "bg-[#1a73c7] text-white")}
        >
          <List size={15} />
        </button>
      </div>

      <div className="relative">
        <button
          ref={smartListTriggerRef}
          type="button"
          aria-label="فتح إجراءات المهام"
          aria-haspopup="menu"
          aria-expanded={smartListOpen}
          aria-controls="tasks-smart-list-menu"
          onClick={onSmartListToggle}
          className={cn(
            "grid h-11 w-11 place-items-center rounded-[8px] bg-[#102235] text-[#aebdca]",
            "transition-colors duration-150 hover:bg-[#16314a] hover:text-white motion-reduce:transition-none",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]",
            smartListOpen && "bg-[#1688d8]/20 text-[#83d8ff]",
          )}
        >
          <MoreHorizontal size={17} />
        </button>
        <SmartListMenu
          open={smartListOpen}
          items={smartListItems}
          onClose={onSmartListClose}
          returnFocus={smartListTriggerRef.current}
        />
      </div>
    </div>
  );
}

/** نافذة "تصفية مساحة العمل" — الغلاف والمحتوى كما كانا في الصفحة حرفيًا. */
export function TaskFiltersModal({
  open,
  activeFilterCount,
  controls,
  onClose,
  returnFocus,
}: {
  open: boolean;
  activeFilterCount: number;
  controls: FilterControlsProps;
  onClose: () => void;
  returnFocus?: HTMLElement | null;
}) {
  return (
    <ExecutiveModal
      open={open}
      title={activeFilterCount ? `تصفية مساحة العمل · ${activeFilterCount}` : "تصفية مساحة العمل"}
      eyebrow="أدوات المهام"
      onClose={onClose}
      returnFocus={returnFocus}
      footer={
        <div className="flex gap-2">
          {controls.hasActiveFilters ? (
            <button type="button" onClick={controls.onReset} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[7px] border border-white/[0.10] bg-white/[0.045] text-xs font-bold text-[#e4e9ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]">
              <RotateCcw size={13} />
              إعادة الضبط
            </button>
          ) : null}
          <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-[7px] bg-[#2276e3] text-xs font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8bbcff]">عرض النتائج</button>
        </div>
      }
    >
      <FilterControls {...controls} />
    </ExecutiveModal>
  );
}

/** نافذة "نظرة تشغيلية" — الغلاف والمحتوى كما كانا في الصفحة حرفيًا. */
export function OperationalOverviewModal({
  open,
  stats,
  operationalScope,
  onClose,
  returnFocus,
}: {
  open: boolean;
  stats: TaskStats;
  operationalScope: OperationalScope;
  onClose: () => void;
  returnFocus?: HTMLElement | null;
}) {
  return (
    <ExecutiveModal
      open={open}
      title="نظرة تشغيلية"
      eyebrow="ملخص المهام"
      onClose={onClose}
      returnFocus={returnFocus}
    >
      <OperationalOverview stats={stats} operationalScope={operationalScope} />
    </ExecutiveModal>
  );
}
