"use client";

import { type ReactNode } from "react";
import { CalendarDays, CircleDot, Edit2, MoreHorizontal, Trash2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task, TaskPriority, TaskStatus } from "@/types";

/**
 * الأسس المشتركة لمساحة عمل المهام (المرحلة 3 — تفكيك بنيوي بلا تغيير بصري):
 * الثوابت والأنواع والمساعدات وبطاقة المهمة، منقولة حرفيًا من صفحة /tasks.
 */

export const STATUS_COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: "جديدة", label: "جديدة", color: "#3c8cff" },
  { key: "قيد_التنفيذ", label: "قيد التنفيذ", color: "#d9a752" },
  { key: "بانتظار_المراجعة", label: "بانتظار المراجعة", color: "#36b7b4" },
  { key: "مكتملة", label: "مكتملة", color: "#5cc68b" },
  { key: "متأخرة", label: "متأخرة", color: "#f47b43" },
];

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; className: string }> = {
  عاجلة: { label: "عاجلة", className: "border-[#f47b43]/45 bg-[#f47b43]/12 text-[#ffc0a0]" },
  عالية: { label: "عالية", className: "border-[#d9a752]/40 bg-[#d9a752]/12 text-[#f2d394]" },
  متوسطة: { label: "متوسطة", className: "border-[#36b7b4]/35 bg-[#36b7b4]/10 text-[#9be7df]" },
  منخفضة: { label: "منخفضة", className: "border-white/15 bg-white/[0.05] text-[#d3d0c8]" },
};

export const EXECUTIVE_GLASS =
  "relative overflow-hidden rounded-[10px] bg-[#0b1927]/96 " +
  "shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-[12px]";

export const EXECUTIVE_INSET =
  "rounded-[8px] border border-white/[0.08] bg-[#07111b]/72";

export const INPUT_CLASS =
  "min-h-11 w-full rounded-[8px] border border-white/[0.10] bg-[#07111b]/80 px-3 text-xs text-[#f6f8fb] " +
  "outline-none transition-colors duration-150 placeholder:text-[#8d9baa] focus:border-[#4d9cff]/70 focus:ring-2 focus:ring-[#4d9cff]/15";

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
    ?? { key: status, label: status, color: "#d3d0c8" };
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

/** الاستدعاءات المشتركة لبطاقات وصفوف المهام — ملكية الحالة تبقى في الصفحة. */
export type TaskItemHandlers = {
  canManage: boolean;
  onOpenDetails: (taskId: string, trigger: HTMLElement) => void;
  onEdit: (task: Task, trigger: HTMLElement) => void;
  onDelete: (taskId: string, title: string) => void;
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

/** بطاقة المهمة في عرض Kanban — نفس مخرجات renderTaskCard السابقة حرفيًا. */
export function TaskCard({
  task,
  canManage,
  onOpenDetails,
  onEdit,
  onDelete,
  onStatusChange,
}: { task: Task } & TaskItemHandlers) {
  const overdue = isOverdue(task.dueDate, task.status);
  const meta = statusMeta(task.status);
  return (
    <article className="flex min-h-[132px] flex-col rounded-[8px] bg-[#102235] p-3 shadow-[0_8px_20px_rgba(0,0,0,0.16)] transition-[background-color,transform] duration-150 hover:-translate-y-0.5 hover:bg-[#142a40] motion-reduce:transform-none motion-reduce:transition-none">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={(event) => onOpenDetails(task.id, event.currentTarget)}
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
          <strong className="block text-[13px] font-black leading-5 text-[#f6f8fb] line-clamp-2">{task.title}</strong>
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
      <div className="mt-auto flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 pt-3 text-[10px] text-[#9ba9b7]">
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
}
