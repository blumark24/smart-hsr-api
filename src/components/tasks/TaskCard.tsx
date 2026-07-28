"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Building2,
  CalendarDays,
  CircleDot,
  Edit2,
  LoaderCircle,
  MoreHorizontal,
  Trash2,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task, TaskPriority, TaskStatus } from "@/types";

export const STATUS_COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: "جديدة", label: "جديدة", color: "var(--ds-info)" },
  { key: "قيد_التنفيذ", label: "قيد التنفيذ", color: "var(--ds-warn)" },
  { key: "بانتظار_المراجعة", label: "بانتظار المراجعة", color: "var(--ds-review)" },
  { key: "مكتملة", label: "مكتملة", color: "var(--ds-success)" },
  { key: "متأخرة", label: "متأخرة", color: "var(--ds-danger)" },
];

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; className: string }> = {
  عاجلة: { label: "عاجلة", className: "border-[color-mix(in_srgb,var(--ds-danger)_45%,transparent)] bg-[color-mix(in_srgb,var(--ds-danger)_12%,transparent)] text-ds-danger" },
  عالية: { label: "عالية", className: "border-[color-mix(in_srgb,var(--ds-warn)_40%,transparent)] bg-[color-mix(in_srgb,var(--ds-warn)_12%,transparent)] text-ds-warn" },
  متوسطة: { label: "متوسطة", className: "border-[color-mix(in_srgb,var(--ds-review)_35%,transparent)] bg-[color-mix(in_srgb,var(--ds-review)_10%,transparent)] text-ds-review" },
  منخفضة: { label: "منخفضة", className: "border-ds-border bg-white/[0.05] text-ds-text-2" },
};

const PRIORITY_DOT: Record<TaskPriority, string> = {
  عاجلة: "bg-ds-danger",
  عالية: "bg-ds-warn",
  متوسطة: "bg-ds-review",
  منخفضة: "bg-ds-text-3",
};

export const EXECUTIVE_GLASS =
  "relative overflow-hidden rounded-ds-md bg-ds-surface-1 shadow-ds-2 backdrop-blur-[12px]";

export const EXECUTIVE_INSET =
  "rounded-ds-sm border border-ds-border-soft bg-ds-surface-2/70";

export const INPUT_CLASS =
  "min-h-11 w-full rounded-ds-sm border border-[#29425a] bg-[#07111b] px-3 text-ds-body text-[#f6f8fb] caret-[#f6f8fb] " +
  "outline-none [color-scheme:dark] transition-colors duration-150 placeholder:text-[#8d9baa] " +
  "focus:border-[#22d3ee] focus:ring-2 focus:ring-[#22d3ee]/20 " +
  "[&>option]:bg-[#07111b] [&>option]:text-[#f6f8fb]";

export type ViewMode = "kanban" | "list";
export type TaskFilter = TaskStatus | "الكل";
export type PriorityFilter = TaskPriority | "الكل";
export type TaskStats = {
  total: number;
  new: number;
  inProgress: number;
  review: number;
  late: number;
  completed: number;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("ar-SA", {
  timeZone: "Asia/Riyadh",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDueDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATE_FORMATTER.format(date);
}

export function isOverdue(dueDate: string, status: TaskStatus) {
  if (status === "مكتملة") return false;
  const due = new Date(dueDate);
  return !Number.isNaN(due.getTime()) && due < new Date();
}

export function statusMeta(status: TaskStatus) {
  return STATUS_COLUMNS.find((column) => column.key === status)
    ?? { key: status, label: status, color: "var(--ds-text-2)" };
}

export function ExecutiveGlass({
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

export type TaskItemHandlers = {
  canManage: boolean;
  selectedTaskId?: string | null;
  onOpenDetails: (taskId: string, trigger: HTMLElement) => void;
  onEdit: (task: Task, trigger: HTMLElement) => void;
  onDelete: (taskId: string, title: string) => Promise<boolean>;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
};

export function TaskActionsMenu({
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
  onDelete: () => Promise<boolean>;
  onStatusChange: (status: TaskStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 240 });
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (deleting) return;
      event.preventDefault();
      setOpen(false);
      requestAnimationFrame(() => triggerRef.current?.focus());
    };
    const onOutsideClick = (event: MouseEvent) => {
      if (deleting) return;
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const onResize = () => {
      if (!deleting) setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    document.addEventListener("mousedown", onOutsideClick);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("mousedown", onOutsideClick);
    };
  }, [deleting, open]);

  const finish = (action: () => void) => {
    if (deleting) return;
    setOpen(false);
    action();
  };

  const toggleMenu = () => {
    if (deleting) return;
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 12;
    const width = Math.min(240, window.innerWidth - margin * 2);
    const estimatedHeight = 236;
    const left = Math.min(
      Math.max(margin, rect.right - width),
      window.innerWidth - width - margin,
    );
    const top = rect.bottom + 4 + estimatedHeight <= window.innerHeight - margin
      ? rect.bottom + 4
      : Math.max(margin, rect.top - estimatedHeight - 4);
    setMenuPosition({ top, left, width });
    setOpen(true);
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    const deleted = await onDelete();
    setDeleting(false);
    if (deleted) setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`إجراءات ${task.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggleMenu}
        className="grid h-11 w-11 place-items-center rounded-ds-sm text-ds-text-3 transition-colors duration-150 hover:bg-white/[0.055] hover:text-ds-text-1 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-teal"
      >
        <MoreHorizontal size={17} />
      </button>
      {open && typeof document !== "undefined" ? createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={`إجراءات ${task.title}`}
          dir="rtl"
          style={menuPosition}
          className="fixed z-[80] max-h-[calc(100svh-24px)] overflow-y-auto rounded-ds-md border border-ds-border bg-ds-surface-1 p-1 shadow-ds-2"
        >
          <button
            type="button"
            role="menuitem"
            disabled={deleting}
            onClick={() => finish(() => {
              if (triggerRef.current) onOpen(triggerRef.current);
            })}
            className="flex min-h-10 w-full items-center gap-2 rounded-ds-sm px-2.5 text-right text-ds-caption font-bold text-ds-text-1 disabled:opacity-60 hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-teal"
          >
            <CircleDot size={14} />
            عرض التفاصيل
          </button>
          <label className="block px-2 py-1">
            <span className="mb-1 block text-[11px] text-ds-text-3">تغيير الحالة</span>
            <select
              aria-label={`تغيير حالة ${task.title}`}
              value={task.status}
              disabled={deleting}
              onChange={(event) => finish(() => onStatusChange(event.target.value as TaskStatus))}
              className="min-h-10 w-full rounded-ds-sm border border-ds-border bg-ds-surface-2 px-2 text-ds-caption text-ds-text-1 outline-none [color-scheme:dark] disabled:opacity-60 focus:border-ds-accent focus:ring-2 focus:ring-ds-teal/15"
            >
              {STATUS_COLUMNS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>
          {canManage ? (
            <>
              <button
                type="button"
                role="menuitem"
                disabled={deleting}
                onClick={() => finish(() => {
                  if (triggerRef.current) onEdit(triggerRef.current);
                })}
                className="flex min-h-10 w-full items-center gap-2 rounded-ds-sm px-2.5 text-right text-ds-caption font-bold text-ds-text-1 disabled:opacity-60 hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-teal"
              >
                <Edit2 size={14} />
                تعديل
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="flex min-h-10 w-full items-center gap-2 rounded-ds-sm px-2.5 text-right text-ds-caption font-bold text-ds-danger disabled:cursor-wait disabled:opacity-60 hover:bg-[color-mix(in_srgb,var(--ds-danger)_10%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-teal"
              >
                {deleting ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <Trash2 size={14} />}
                {deleting ? "جاري الحذف" : "حذف"}
              </button>
            </>
          ) : null}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

export function TaskCard({
  task,
  canManage,
  selectedTaskId,
  onOpenDetails,
  onEdit,
  onDelete,
  onStatusChange,
}: { task: Task } & TaskItemHandlers) {
  const overdue = isOverdue(task.dueDate, task.status);
  const meta = statusMeta(task.status);
  const selected = selectedTaskId === task.id;

  return (
    <article
      className={cn(
        "flex min-h-[156px] flex-col rounded-ds-md border border-ds-border-soft bg-ds-surface-3 p-3",
        "transition-[border-color,background-color] duration-150 motion-reduce:transition-none",
        "hover:border-ds-border-strong hover:bg-[color-mix(in_srgb,var(--ds-surface-3)_94%,var(--ds-accent))]",
        selected && "border-ds-teal/60 ring-1 ring-ds-teal/20",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          aria-current={selected ? "true" : undefined}
          onClick={(event) => onOpenDetails(task.id, event.currentTarget)}
          className="min-w-0 flex-1 rounded-ds-sm text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-teal"
        >
          <strong className="block text-ds-heading font-black leading-6 text-ds-text-1 line-clamp-2 [overflow-wrap:anywhere]">
            {task.title}
          </strong>
        </button>
        <TaskActionsMenu
          task={task}
          canManage={canManage}
          onOpen={(trigger) => onOpenDetails(task.id, trigger)}
          onEdit={(trigger) => onEdit(task, trigger)}
          onDelete={() => onDelete(task.id, task.title)}
          onStatusChange={(status) => onStatusChange(task.id, status)}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span
          className="inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2 text-ds-caption font-bold"
          style={{ borderColor: `${meta.color}55`, color: meta.color }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden="true" />
          {meta.label}
        </span>
        <span className="inline-flex items-center gap-1.5 text-ds-caption text-ds-text-3">
          <span className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_DOT[task.priority])} aria-hidden="true" />
          أولوية {PRIORITY_CONFIG[task.priority].label}
        </span>
      </div>

      {task.clientName ? (
        <div className="mt-2 flex min-w-0 items-center gap-2 text-ds-caption text-ds-text-2">
          <Building2 size={13} className="shrink-0 text-ds-text-3" aria-hidden="true" />
          <span className="truncate">{task.clientName}</span>
        </div>
      ) : null}

      <div className="mt-auto grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 pt-3 text-ds-caption text-ds-text-2">
        <span className="flex min-w-0 items-center gap-2">
          <UserRound size={13} className="shrink-0 text-ds-text-3" aria-hidden="true" />
          <span className="truncate">{task.assigneeName || "غير محدد"}</span>
        </span>
        <span className={cn("flex items-center gap-1.5 whitespace-nowrap", overdue && "font-bold text-ds-danger")}>
          <CalendarDays size={13} aria-hidden="true" />
          {formatDueDate(task.dueDate)}
        </span>
      </div>
    </article>
  );
}
