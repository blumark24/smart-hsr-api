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
  Building2,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  CircleDot,
  Clock,
  Columns,
  Edit2,
  Filter,
  Inbox,
  List,
  LoaderCircle,
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
  "relative overflow-hidden rounded-[10px] border border-[rgba(255,236,192,0.20)] " +
  "bg-[linear-gradient(145deg,rgba(255,255,255,0.09),rgba(255,255,255,0.025)),rgba(7,12,18,0.74)] " +
  "shadow-[0_18px_46px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.11)] backdrop-blur-[18px]";

const EXECUTIVE_INSET =
  "rounded-[8px] border border-white/[0.11] bg-[rgba(2,8,14,0.28)] " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]";

const INPUT_CLASS =
  "min-h-11 w-full rounded-[7px] border border-white/[0.15] bg-black/20 px-3 text-xs text-[#f7f4ee] " +
  "outline-none transition-colors placeholder:text-[#d3d0c8]/45 focus:border-[#d9a752]/60 focus:ring-2 focus:ring-[#d9a752]/10";

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
  clientLinked: Task[];
  unscoped: Task[];
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
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f2d394]/30 to-transparent" />
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#02070d]/70 p-0 backdrop-blur-[8px] animate-in fade-in duration-200 motion-reduce:animate-none sm:items-center sm:p-5"
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
          "flex max-h-[88svh] w-full flex-col overflow-hidden rounded-t-[16px] border border-[#d9a752]/30",
          "bg-[linear-gradient(145deg,rgba(25,39,54,0.97),rgba(5,12,20,0.98))]",
          "shadow-[0_28px_80px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.12)]",
          "animate-in slide-in-from-bottom-4 duration-200 motion-reduce:animate-none sm:max-w-[540px] sm:rounded-[12px] sm:zoom-in-95",
        )}
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/[0.12] px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <small className="block text-[10px] font-black text-[#f2d394]">{eyebrow}</small>
            <h2 id="tasks-executive-panel-title" className="mt-1 truncate text-lg font-black text-[#f7f4ee]">{title}</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="إغلاق النافذة"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] border border-white/[0.18] bg-white/[0.07] text-[#f7f4ee] transition-colors hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d394]"
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

function MetricStrip({
  stats,
}: {
  stats: TaskStats;
}) {
  const items = [
    { label: "الإجمالي", value: stats.total, color: "text-white" },
    { label: "جديدة", value: stats.new, color: "text-[#9fc6ff]" },
    { label: "قيد التنفيذ", value: stats.inProgress, color: "text-[#f2d394]" },
    { label: "للمراجعة", value: stats.review, color: "text-[#9be7df]" },
    { label: "متأخرة", value: stats.late, color: "text-[#ffc0a0]" },
    { label: "مكتملة", value: stats.completed, color: "text-[#9be7b9]" },
  ];

  return (
    <ExecutiveGlass className="p-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div>
          <strong className="block text-sm font-black text-[#f7f4ee]">مؤشر العمل</strong>
          <span className="text-[10px] text-[#d3d0c8]/75">حالة المهام الحالية</span>
        </div>
        <CheckSquare size={17} className="text-[#f2d394]" />
      </div>
      <div className="grid grid-cols-3 border-y border-white/[0.12] md:grid-cols-6 xl:grid-cols-2">
        {items.map((item, index) => (
          <div
            key={item.label}
            className={cn(
              "min-w-0 px-2 py-3 text-center",
              index % 3 !== 2 && "border-l border-white/[0.10] md:border-l-0 xl:border-l-0",
              index < 5 && "md:border-l md:border-white/[0.10] xl:border-l-0",
              index % 2 === 0 && "xl:border-l xl:border-white/[0.10]",
              index < 3 && "border-b border-white/[0.10] md:border-b-0 xl:border-b-0",
              index < 4 && "xl:border-b xl:border-white/[0.10]",
            )}
          >
            <strong className={cn("block text-xl font-black tabular-nums", item.color)}>{item.value}</strong>
            <small className="mt-1 block truncate text-[9px] text-[#d3d0c8]/75">{item.label}</small>
          </div>
        ))}
      </div>
    </ExecutiveGlass>
  );
}

function TaskDigitalTwin({
  stats,
  operationalScope,
}: {
  stats: TaskStats;
  operationalScope: OperationalScope;
}) {
  const stages = [
    { label: "جديدة", value: stats.new, color: "#3c8cff" },
    { label: "قيد التنفيذ", value: stats.inProgress, color: "#d9a752" },
    { label: "بانتظار المراجعة", value: stats.review, color: "#36b7b4" },
    { label: "مكتملة", value: stats.completed, color: "#5cc68b" },
  ];
  const bottleneck = Math.max(...stages.map((stage) => stage.value));
  const largestDepartment = Math.max(
    1,
    ...operationalScope.departments.map((department) => department.total),
  );

  return (
    <ExecutiveGlass className="px-3.5 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[7px] border border-[#36b7b4]/28 bg-[#36b7b4]/10 text-[#9be7df]">
                  <Radar size={15} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-xs font-black leading-5 text-[#f7f4ee]">التوأم الرقمي للمهام</h2>
                  <p className="truncate text-[9px] leading-4 text-[#d3d0c8]/65">الوضع الحالي لتدفق العمل الفعلي</p>
                </div>
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-white/[0.12] bg-white/[0.045] px-2 py-1 text-[9px] text-[#d3d0c8]/70">
              {stats.total} مهمة
            </span>
          </div>

          <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" aria-label="مراحل تدفق المهام الحالية">
            {stages.map((stage, index) => {
              const isBottleneck = bottleneck > 0 && stage.value === bottleneck;
              return (
                <li
                  key={stage.label}
                  aria-label={`${stage.label}: ${stage.value} مهمة`}
                  className={cn(
                    "relative flex min-h-[58px] items-center justify-between gap-3 rounded-[7px] border px-3 py-2",
                    "bg-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]",
                    isBottleneck ? "border-[#d9a752]/34" : "border-white/[0.10]",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <i
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: stage.color }}
                      aria-hidden="true"
                    />
                    <span className="truncate text-[9px] font-black leading-4 text-[#d3d0c8]">{stage.label}</span>
                  </span>
                  <strong className="text-lg font-black tabular-nums text-[#f7f4ee]">{stage.value}</strong>
                  {index < stages.length - 1 ? (
                    <ChevronLeft
                      size={12}
                      aria-hidden="true"
                      className="absolute -left-[11px] top-1/2 z-10 hidden -translate-y-1/2 text-[#d3d0c8]/35 sm:block"
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-white/[0.10] pt-3 sm:grid-cols-[repeat(3,minmax(0,1fr))] lg:w-[246px] lg:grid-cols-[minmax(86px,1fr)_72px_72px] lg:border-r lg:border-t-0 lg:pr-3 lg:pt-0">
          <div className="col-span-full min-w-0 sm:col-span-1">
            <span className="text-[9px] font-black text-[#f2d394]">حمل الأقسام</span>
            <div className="mt-2 space-y-1.5">
              {operationalScope.departments.slice(0, 2).map((department) => (
                <div key={department.label} className="min-w-0" aria-label={`${department.label}: ${department.total} مهمة`}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-[8px] text-[#d3d0c8]/70">
                    <span className="truncate">{department.label}</span>
                    <span className="tabular-nums">{department.total}</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-white/[0.08]">
                    <span
                      className="block h-full rounded-full bg-[#d9a752]/70"
                      style={{ width: `${Math.max(8, (department.total / largestDepartment) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              {!operationalScope.departments.length ? (
                <span className="block text-[8px] leading-4 text-[#d3d0c8]/55">لا يوجد توزيع حالي.</span>
              ) : null}
            </div>
          </div>
          <div className={cn(EXECUTIVE_INSET, "flex min-h-[58px] flex-col justify-center px-2.5 py-2")}>
            <strong className="text-base font-black tabular-nums text-[#9be7df]">{operationalScope.clientLinked.length}</strong>
            <span className="text-[8px] leading-4 text-[#d3d0c8]/60">مرتبطة بعميل</span>
          </div>
          <div className={cn(EXECUTIVE_INSET, "flex min-h-[58px] flex-col justify-center px-2.5 py-2")}>
            <strong className={cn("text-base font-black tabular-nums", operationalScope.unscoped.length ? "text-[#ffc0a0]" : "text-[#d3d0c8]")}>
              {operationalScope.unscoped.length}
            </strong>
            <span className="text-[8px] leading-4 text-[#d3d0c8]/60">خارج الربط</span>
          </div>
          {stats.late > 0 ? (
            <div className="col-span-full flex min-h-8 items-center justify-between gap-2 rounded-[7px] border border-[#f47b43]/24 bg-[#f47b43]/8 px-2.5 text-[9px] text-[#ffc0a0]">
              <span className="flex items-center gap-1.5 font-black"><AlertTriangle size={11} />تنبيه التأخير</span>
              <strong className="tabular-nums">{stats.late}</strong>
            </div>
          ) : null}
        </div>
      </div>
    </ExecutiveGlass>
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
  compact?: boolean;
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
  compact = false,
}: FilterControlsProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-2", compact && "content-start")}>
      <label className="min-w-0">
        <span className="mb-1.5 block text-[10px] font-black text-[#f2d394]">الحالة</span>
        <select value={status} onChange={(event) => onStatusChange(event.target.value as TaskFilter)} className={INPUT_CLASS}>
          <option value="الكل">كل الحالات</option>
          {STATUS_COLUMNS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
      </label>
      <label className="min-w-0">
        <span className="mb-1.5 block text-[10px] font-black text-[#f2d394]">الأولوية</span>
        <select value={priority} onChange={(event) => onPriorityChange(event.target.value as PriorityFilter)} className={INPUT_CLASS}>
          <option value="الكل">كل الأولويات</option>
          {Object.entries(PRIORITY_CONFIG).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
        </select>
      </label>
      <label className="min-w-0">
        <span className="mb-1.5 block text-[10px] font-black text-[#f2d394]">المكلّف</span>
        <select value={assignee} onChange={(event) => onAssigneeChange(event.target.value)} className={INPUT_CLASS}>
          <option value="الكل">كل المكلّفين</option>
          {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
        </select>
      </label>
      <label className="min-w-0">
        <span className="mb-1.5 block text-[10px] font-black text-[#f2d394]">العميل</span>
        <select value={client} onChange={(event) => onClientChange(event.target.value)} className={INPUT_CLASS}>
          <option value="الكل">كل العملاء</option>
          {clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      {hasActiveFilters ? (
        <button
          type="button"
          onClick={onReset}
          className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-[7px] border border-white/[0.16] bg-white/[0.06] px-3 text-[11px] font-black text-[#f7f4ee] transition-colors hover:bg-white/[0.10] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d394]"
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
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-[10px] border border-[#d9a752]/30 bg-[#d9a752]/10 text-[#f2d394]">
        {icon}
      </span>
      <strong className="text-sm font-black text-[#f7f4ee]">{title}</strong>
      <p className="mt-2 max-w-sm text-xs leading-6 text-[#d3d0c8]/75">{note}</p>
      {action ? <div className="mt-4">{action}</div> : null}
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
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
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
      lateByDepartment: Array.from(departmentMap.values()).filter((item) => item.late > 0).sort((a, b) => b.late - a.late).slice(0, 4),
      reviewQueue: tasks.filter((task) => task.status === "بانتظار_المراجعة"),
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

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("الكل");
    setPriorityFilter("الكل");
    setAssigneeFilter("الكل");
    setClientFilter("الكل");
  };

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
    return (
      <article key={task.id} className="flex min-h-[218px] flex-col rounded-[8px] border border-white/[0.12] bg-black/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition-colors hover:border-[#d9a752]/35">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={(event) => openDetails(task.id, event.currentTarget)}
            className="min-w-0 flex-1 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d394]"
          >
            <span className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <PublicCodeBadge code={task.publicCode} />
              <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-black", PRIORITY_CONFIG[task.priority].className)}>
                {PRIORITY_CONFIG[task.priority].label}
              </span>
            </span>
            <strong className="block text-xs font-black leading-5 text-[#f7f4ee] line-clamp-2">{task.title}</strong>
          </button>
          {canManageTasks ? (
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" onClick={(event) => openEdit(task, event.currentTarget)} aria-label="تعديل المهمة" className="grid h-11 w-11 place-items-center rounded-[6px] text-[#d3d0c8]/70 transition-colors hover:bg-white/[0.07] hover:text-[#f2d394] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d394]">
                <Edit2 size={13} />
              </button>
              <button type="button" onClick={() => void handleDeleteTask(task.id, task.title)} aria-label="حذف المهمة" className="grid h-11 w-11 place-items-center rounded-[6px] text-[#d3d0c8]/70 transition-colors hover:bg-[#f47b43]/10 hover:text-[#ffc0a0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d394]">
                <Trash2 size={13} />
              </button>
            </div>
          ) : null}
        </div>
        {task.description ? <p className="mt-2 text-[10px] leading-5 text-[#d3d0c8]/70 line-clamp-2">{task.description}</p> : null}
        <div className="mt-auto space-y-1.5 border-t border-white/[0.09] pt-2.5 text-[10px] text-[#d3d0c8]/75">
          <div className="flex min-w-0 items-center gap-1.5">
            <UserRound size={11} className="shrink-0 text-[#f2d394]" />
            <span className="truncate">{task.assigneeName || "غير محدد"}</span>
          </div>
          {task.clientName ? (
            <div className="flex min-w-0 items-center gap-1.5">
              <Building2 size={11} className="shrink-0 text-[#9be7df]" />
              <span className="truncate">{task.clientName}</span>
            </div>
          ) : null}
          <div className={cn("flex items-center gap-1.5", overdue && "text-[#ffc0a0]")}>
            <CalendarDays size={11} className="shrink-0" />
            <span>{formatDueDate(task.dueDate)}</span>
            {overdue ? <span className="font-black">متأخرة</span> : null}
          </div>
        </div>
        <select
          aria-label={`تغيير حالة ${task.title}`}
          className={cn(INPUT_CLASS, "mt-3 py-0")}
          value={task.status}
          onChange={(event) => void moveTask(task.id, event.target.value as TaskStatus)}
        >
          {STATUS_COLUMNS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
      </article>
    );
  };

  return (
    <DashboardLayout>
      <div
        dir="rtl"
        className="relative isolate -m-premium-3 min-h-full overflow-hidden bg-[#07101a] p-3 pb-[max(24px,env(safe-area-inset-bottom))] font-[Tajawal,'IBM_Plex_Sans_Arabic','Segoe_UI',Tahoma,sans-serif] text-[#f7f4ee] sm:-m-premium-4 sm:p-4 lg:-m-premium-6 lg:p-5"
      >
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(4,12,21,0.34),transparent_28%_72%,rgba(4,9,14,0.32)),linear-gradient(180deg,rgba(2,6,12,0.08),transparent_40%,rgba(2,6,12,0.28))]" />
        <div className="mx-auto w-full max-w-[1600px] space-y-3">
          <header className={cn(EXECUTIVE_GLASS, "min-h-[72px] px-3 py-3 sm:px-4")}>
            <div className="relative z-10 grid items-center gap-3 md:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[minmax(210px,0.7fr)_minmax(280px,1.3fr)_auto]">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] border border-[#d9a752]/42 bg-[#905e1c]/28 text-[#f2d394] shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]">
                  <CheckSquare size={19} />
                </span>
                <div className="min-w-0">
                  <h1 className="text-lg font-black leading-tight text-[#f7f4ee] sm:text-xl">إدارة المهام</h1>
                  <p className="mt-0.5 truncate text-[10px] text-[#d3d0c8]/75 sm:text-xs">مساحة تشغيل العمل ضمن نطاقك الحالي</p>
                </div>
              </div>

              <label className="relative min-w-0">
                <span className="sr-only">البحث في المهام</span>
                <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#d3d0c8]/60" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ابحث عن مهمة أو عميل أو مكلّف..."
                  className={cn(INPUT_CLASS, "pr-9")}
                />
              </label>

              <div className="flex min-w-0 flex-wrap items-center gap-2 md:col-span-2 xl:col-span-1 xl:justify-end">
                <button
                  type="button"
                  aria-label="فتح مرشحات المهام"
                  onClick={(event) => {
                    rememberTrigger(event.currentTarget);
                    setFiltersOpen(true);
                  }}
                  className="relative inline-flex min-h-11 items-center gap-2 rounded-[7px] border border-white/[0.16] bg-white/[0.06] px-3 text-[11px] font-black text-[#f7f4ee] transition-colors hover:bg-white/[0.10] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d394] xl:hidden"
                >
                  <SlidersHorizontal size={14} />
                  <span className="hidden sm:inline">المرشحات</span>
                  {hasActiveFilters ? (
                    <>
                      <i className="h-1.5 w-1.5 rounded-full bg-[#36b7b4]" aria-hidden="true" />
                      <span className="sr-only">توجد مرشحات نشطة</span>
                    </>
                  ) : null}
                </button>
                <div className="flex min-h-11 items-center rounded-[7px] border border-white/[0.14] bg-black/20" role="group" aria-label="طريقة عرض المهام">
                  <button type="button" onClick={() => setView("kanban")} aria-label="عرض كانبان" aria-pressed={view === "kanban"} className={cn("grid h-11 w-11 place-items-center rounded-[6px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d394]", view === "kanban" ? "bg-[#36b7b4] text-[#06131a]" : "text-[#d3d0c8]/75 hover:bg-white/[0.07] hover:text-white")}>
                    <Columns size={15} />
                  </button>
                  <button type="button" onClick={() => setView("list")} aria-label="عرض قائمة" aria-pressed={view === "list"} className={cn("grid h-11 w-11 place-items-center rounded-[6px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d394]", view === "list" ? "bg-[#36b7b4] text-[#06131a]" : "text-[#d3d0c8]/75 hover:bg-white/[0.07] hover:text-white")}>
                    <List size={15} />
                  </button>
                </div>
                <Link href="/tasks/my-desk" className="inline-flex min-h-11 items-center gap-2 rounded-[7px] border border-[#d9a752]/35 bg-[#905e1c]/22 px-3 text-[11px] font-black text-[#f2d394] transition-colors hover:bg-[#905e1c]/32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d394]">
                  <Radar size={14} />
                  <span className="hidden sm:inline">المكتب الذكي</span>
                </Link>
                {canManageTasks ? (
                  <button type="button" onClick={(event) => openAdd(event.currentTarget)} className="inline-flex min-h-11 items-center gap-2 rounded-[7px] border border-[#36b7b4]/45 bg-[#36b7b4] px-3.5 text-[11px] font-black text-[#06131a] shadow-[0_8px_22px_rgba(54,183,180,0.18)] transition-colors hover:bg-[#54c8c4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d394]">
                    <Plus size={14} />
                    مهمة جديدة
                  </button>
                ) : null}
              </div>
            </div>
          </header>

          <div className="grid gap-3 xl:grid-cols-[184px_minmax(0,1fr)_204px] xl:items-start 2xl:grid-cols-[212px_minmax(0,1fr)_228px]">
            <aside className="order-1 xl:sticky xl:top-3">
              <MetricStrip stats={stats} />
            </aside>

            <aside className="order-2 hidden xl:order-3 xl:block xl:sticky xl:top-3">
              <ExecutiveGlass className="p-3.5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <strong className="block text-sm font-black">أدوات العرض</strong>
                    <span className="text-[10px] text-[#d3d0c8]/70">تصفية مساحة العمل</span>
                  </div>
                  <Filter size={16} className="text-[#f2d394]" />
                </div>
                <FilterControls {...filterControlProps} compact />
              </ExecutiveGlass>
            </aside>

            <div className="order-3 min-w-0 space-y-3 xl:order-2">
              {!loading && tasks.length > 0 ? (
                <TaskDigitalTwin stats={stats} operationalScope={managerCommand} />
              ) : null}

              <ExecutiveGlass>
                <div className="flex min-h-[58px] flex-wrap items-center justify-between gap-3 border-b border-white/[0.12] px-4 py-3">
                  <div>
                    <strong className="block text-sm font-black">مساحة تنفيذ المهام</strong>
                    <span className="text-[10px] text-[#d3d0c8]/70">{filteredTasks.length} من {tasks.length} مهمة</span>
                  </div>
                  {hasActiveFilters ? (
                    <button type="button" onClick={resetFilters} className="inline-flex min-h-11 items-center gap-1.5 rounded-[6px] border border-white/[0.14] bg-white/[0.05] px-2.5 text-[10px] font-black text-[#d3d0c8] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d394]">
                      <RotateCcw size={12} />
                      مسح التصفية
                    </button>
                  ) : (
                    <span className="text-[10px] text-[#d3d0c8]/55">عرض العمل الحالي</span>
                  )}
                </div>

              {loading ? (
                <WorkspaceState icon={<LoaderCircle size={22} className="animate-spin" />} title="جاري تحميل المهام" note="يتم تجهيز مساحة العمل الحالية." />
              ) : error ? (
                <WorkspaceState
                  icon={<AlertTriangle size={22} />}
                  title="تعذر تحميل المهام"
                  note="تحقق من الاتصال ثم أعد المحاولة."
                  action={<button type="button" onClick={() => void refetch()} className="inline-flex min-h-11 items-center gap-2 rounded-[7px] border border-[#d9a752]/40 bg-[#905e1c]/28 px-3 text-[11px] font-black text-[#f2d394] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d394]"><RotateCcw size={13} />إعادة المحاولة</button>}
                />
              ) : tasks.length === 0 ? (
                <WorkspaceState
                  icon={<Inbox size={22} />}
                  title="لا توجد مهام بعد"
                  note="ابدأ بإنشاء مهمة لتنظيم العمل ومتابعته."
                  action={canManageTasks ? <button type="button" onClick={(event) => openAdd(event.currentTarget)} className="inline-flex min-h-11 items-center gap-2 rounded-[7px] bg-[#36b7b4] px-3 text-[11px] font-black text-[#06131a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d394]"><Plus size={13} />مهمة جديدة</button> : undefined}
                />
              ) : filteredTasks.length === 0 ? (
                <WorkspaceState
                  icon={<Search size={22} />}
                  title="لا توجد نتائج مطابقة"
                  note="غيّر البحث أو المرشحات لعرض مهام أخرى."
                  action={<button type="button" onClick={resetFilters} className="inline-flex min-h-11 items-center gap-2 rounded-[7px] border border-white/[0.16] bg-white/[0.06] px-3 text-[11px] font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d394]"><RotateCcw size={13} />إعادة الضبط</button>}
                />
              ) : view === "kanban" ? (
                  <div className="overflow-x-auto overscroll-x-contain p-2.5 sm:p-3">
                  <div className="flex min-w-max">
                    {STATUS_COLUMNS.map((column, columnIndex) => {
                      const columnTasks = filteredTasks.filter((task) => task.status === column.key);
                      return (
                        <section key={column.key} className={cn("w-[272px] shrink-0 px-2 sm:w-[260px] lg:w-[272px] lg:px-2.5", columnIndex > 0 && "border-r border-white/[0.10]")}>
                          <header className="mb-3 flex min-h-9 items-center justify-between gap-2 border-b border-white/[0.10] pb-2">
                            <span className="flex items-center gap-2 text-[11px] font-black">
                              <i className="h-2 w-2 rounded-full" style={{ backgroundColor: column.color }} />
                              {column.label}
                            </span>
                            <span className="min-w-6 rounded-full bg-white/[0.07] px-1.5 py-0.5 text-center text-[9px] tabular-nums text-[#d3d0c8]">{columnTasks.length}</span>
                          </header>
                          <div className="space-y-2.5">
                            {columnTasks.map(renderTaskCard)}
                            {!columnTasks.length ? (
                              <div className="flex min-h-24 items-center justify-center rounded-[7px] border border-dashed border-white/[0.14] bg-black/10 px-3 text-center text-[10px] text-[#d3d0c8]/55">
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
                <div className="divide-y divide-white/[0.09]">
                  {filteredTasks.map((task) => {
                    const meta = statusMeta(task.status);
                    const overdue = isOverdue(task.dueDate, task.status);
                    return (
                      <article key={task.id} className="grid min-w-0 gap-3 px-3 py-3.5 transition-colors hover:bg-white/[0.025] sm:px-4 md:grid-cols-[minmax(180px,1.45fr)_minmax(120px,0.8fr)_minmax(112px,0.7fr)_auto] md:items-center xl:grid-cols-[minmax(200px,1.6fr)_minmax(130px,0.8fr)_minmax(120px,0.7fr)_auto]">
                        <button type="button" onClick={(event) => openDetails(task.id, event.currentTarget)} className="min-w-0 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d394]">
                          <span className="mb-1 flex flex-wrap items-center gap-1.5">
                            <PublicCodeBadge code={task.publicCode} />
                            <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-black", PRIORITY_CONFIG[task.priority].className)}>{PRIORITY_CONFIG[task.priority].label}</span>
                          </span>
                          <strong className="block text-xs font-black leading-5 text-[#f7f4ee] line-clamp-2 md:line-clamp-1">{task.title}</strong>
                          {task.description ? <small className="mt-1 block truncate text-[10px] text-[#d3d0c8]/65">{task.description}</small> : null}
                        </button>
                        <div className="min-w-0 space-y-1 text-[10px] text-[#d3d0c8]/75">
                          <span className="flex min-w-0 items-center gap-1.5"><UserRound size={11} className="shrink-0 text-[#f2d394]" /><span className="truncate">{task.assigneeName || "غير محدد"}</span></span>
                          <span className="flex min-w-0 items-center gap-1.5"><Building2 size={11} className="shrink-0 text-[#9be7df]" /><span className="truncate">{task.clientName || "دون عميل"}</span></span>
                        </div>
                        <div className="space-y-1.5 text-[10px]">
                          <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-black" style={{ borderColor: `${meta.color}55`, color: meta.color, backgroundColor: `${meta.color}14` }}>{meta.label}</span>
                          <span className={cn("flex items-center gap-1.5 text-[#d3d0c8]/70", overdue && "text-[#ffc0a0]")}><CalendarDays size={11} />{formatDueDate(task.dueDate)}</span>
                        </div>
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5 md:flex-nowrap md:justify-end">
                          <select aria-label={`تغيير حالة ${task.title}`} value={task.status} onChange={(event) => void moveTask(task.id, event.target.value as TaskStatus)} className={cn(INPUT_CLASS, "min-w-[138px] flex-1 py-0 md:w-auto md:flex-none")}>
                            {STATUS_COLUMNS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                          </select>
                          {canManageTasks ? (
                            <>
                              <button type="button" onClick={(event) => openEdit(task, event.currentTarget)} aria-label="تعديل المهمة" className="grid h-11 w-11 place-items-center rounded-[6px] border border-white/[0.12] bg-white/[0.04] text-[#d3d0c8] hover:text-[#f2d394] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d394]"><Edit2 size={13} /></button>
                              <button type="button" onClick={() => void handleDeleteTask(task.id, task.title)} aria-label="حذف المهمة" className="grid h-11 w-11 place-items-center rounded-[6px] border border-[#f47b43]/20 bg-[#f47b43]/5 text-[#ffc0a0] hover:bg-[#f47b43]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d394]"><Trash2 size={13} /></button>
                            </>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
              </ExecutiveGlass>
            </div>
          </div>

          {!loading && tasks.length > 0 ? (
            <details className={cn(EXECUTIVE_GLASS, "group")}>
              <summary className="flex min-h-[58px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] border border-[#d9a752]/30 bg-[#905e1c]/22 text-[#f2d394]"><Radar size={16} /></span>
                  <div>
                    <strong className="block text-xs font-black">الرؤية التشغيلية للمدير</strong>
                    <span className="text-[10px] text-[#d3d0c8]/65">ملخص هادئ من بيانات المهام والهيكل الحاليين</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="hidden text-[10px] text-[#9be7df] sm:inline">{managerCommand.reviewQueue.length} للمراجعة</span>
                  <ChevronDown size={15} className="text-[#d3d0c8]/70 transition-transform group-open:rotate-180" />
                </div>
              </summary>
              <div className="grid gap-2 border-t border-white/[0.10] p-3 sm:grid-cols-[96px_minmax(0,1fr)_minmax(0,1fr)]">
                <div className={cn(EXECUTIVE_INSET, "px-3 py-2 text-center")}>
                  <strong className="block text-base text-[#9be7df]">{managerCommand.reviewQueue.length}</strong>
                  <small className="text-[9px] text-[#d3d0c8]/65">للمراجعة</small>
                </div>
                <div className={cn(EXECUTIVE_INSET, "px-3 py-2")}>
                  <strong className="text-[10px] text-[#f2d394]">عبء الأقسام</strong>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {managerCommand.departments.length ? managerCommand.departments.map((item) => <span key={item.label} className="rounded-full bg-white/[0.06] px-2 py-1 text-[9px]">{item.label} · {item.total}</span>) : <small className="text-[9px] text-[#d3d0c8]/65">لا توجد مهام موزعة.</small>}
                  </div>
                </div>
                <div className={cn(EXECUTIVE_INSET, "px-3 py-2")}>
                  <strong className="text-[10px] text-[#ffc0a0]">تحتاج الانتباه</strong>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {managerCommand.lateByDepartment.length ? managerCommand.lateByDepartment.map((item) => <span key={item.label} className="rounded-full bg-[#f47b43]/10 px-2 py-1 text-[9px] text-[#ffc0a0]">{item.label} · {item.late}</span>) : <small className="text-[9px] text-[#d3d0c8]/65">لا توجد أقسام متأخرة.</small>}
                    {managerCommand.highLoad.map((item) => <span key={`${item.name}-${item.department}`} className="rounded-full bg-[#d9a752]/10 px-2 py-1 text-[9px] text-[#f2d394]">{item.name} · {item.count}</span>)}
                  </div>
                </div>
              </div>
            </details>
          ) : null}
        </div>
      </div>

      <ExecutiveModal
        open={filtersOpen}
        title="تصفية مساحة العمل"
        eyebrow="أدوات المهام"
        onClose={() => setFiltersOpen(false)}
        returnFocus={returnFocusRef.current}
        footer={<button type="button" onClick={() => setFiltersOpen(false)} className="min-h-11 w-full rounded-[7px] bg-[#36b7b4] text-xs font-black text-[#06131a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d394]">عرض النتائج</button>}
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
            <button type="button" onClick={() => { const task = detailsTask; setDetailsId(null); openEdit(task); }} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[7px] border border-[#d9a752]/38 bg-[#905e1c]/26 text-xs font-black text-[#f2d394] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d394]"><Edit2 size={14} />تعديل</button>
            <button type="button" onClick={() => { const task = detailsTask; setDetailsId(null); void handleDeleteTask(task.id, task.title); }} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[7px] border border-[#f47b43]/28 bg-[#f47b43]/8 text-xs font-black text-[#ffc0a0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d394]"><Trash2 size={14} />حذف</button>
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
                  <span className="text-[#f2d394]">{item.icon}</span>
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
            <button type="button" onClick={() => { setShowModal(false); resetForm(); }} disabled={saving} className="min-h-11 flex-1 rounded-[7px] border border-white/[0.16] bg-white/[0.06] text-xs font-black text-[#f7f4ee] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d394]">إلغاء</button>
            <button type="button" onClick={() => void handleSave()} disabled={saving} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[7px] bg-[#36b7b4] text-xs font-black text-[#06131a] disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d394]">
              {saving ? <LoaderCircle size={14} className="animate-spin" /> : null}
              {saving ? "جاري الحفظ" : editTask ? "حفظ التعديلات" : "إضافة المهمة"}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black text-[#f2d394]">عنوان المهمة</span>
            <input className={INPUT_CLASS} placeholder="أدخل عنوان المهمة" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black text-[#f2d394]">الوصف</span>
            <textarea className={cn(INPUT_CLASS, "min-h-20 resize-y py-2")} placeholder="وصف تفصيلي للمهمة" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1.5 block text-[10px] font-black text-[#f2d394]">الأولوية</span>
              <select className={INPUT_CLASS} value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as TaskPriority })}>
                {Object.entries(PRIORITY_CONFIG).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-[10px] font-black text-[#f2d394]">الحالة</span>
              <select className={INPUT_CLASS} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as TaskStatus })}>
                {STATUS_COLUMNS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1.5 block text-[10px] font-black text-[#f2d394]">المكلّف</span>
              <select className={INPUT_CLASS} value={form.assigneeId} onChange={(event) => { const employee = employees.find((item) => item.id === event.target.value); setForm({ ...form, assigneeId: event.target.value, assigneeName: employee?.name ?? "" }); }}>
                <option value="">اختر موظفًا</option>
                {employees.filter((employee) => employee.status === "نشط").map((employee) => <option key={employee.id} value={employee.id}>{employee.name} ({employee.department})</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-[10px] font-black text-[#f2d394]">الموعد النهائي</span>
              <input className={INPUT_CLASS} type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black text-[#f2d394]">العميل (اختياري)</span>
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
