"use client";

import { Building2, CalendarDays, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/types";
import {
  PRIORITY_CONFIG,
  TaskActionsMenu,
  formatDueDate,
  isOverdue,
  statusMeta,
  type TaskItemHandlers,
} from "./TaskCard";

const PRIORITY_DOT = {
  عاجلة: "bg-ds-danger",
  عالية: "bg-ds-warn",
  متوسطة: "bg-ds-review",
  منخفضة: "bg-ds-text-3",
} as const;

export function TaskListRows({
  tasks,
  canManage,
  selectedTaskId,
  onOpenDetails,
  onEdit,
  onDelete,
  onStatusChange,
}: { tasks: Task[] } & TaskItemHandlers) {
  return (
    <div>
      <div className="hidden min-h-10 grid-cols-[minmax(220px,1.5fr)_minmax(120px,0.7fr)_minmax(130px,0.8fr)_minmax(120px,0.7fr)_minmax(92px,0.5fr)_44px] items-center gap-3 border-b border-ds-border-soft px-4 text-ds-caption font-bold text-ds-text-3 md:grid">
        <span>المهمة</span>
        <span>الحالة</span>
        <span>المسؤول</span>
        <span>الموعد</span>
        <span>الأولوية</span>
        <span className="sr-only">الإجراءات</span>
      </div>

      <div className="divide-y divide-ds-border-soft">
        {tasks.map((task) => {
          const meta = statusMeta(task.status);
          const overdue = isOverdue(task.dueDate, task.status);
          const selected = selectedTaskId === task.id;

          return (
            <article
              key={task.id}
              className={cn(
                "relative grid min-w-0 gap-3 px-3 py-3 transition-colors duration-150 motion-reduce:transition-none sm:px-4",
                "hover:bg-white/[0.025]",
                "md:min-h-16 md:grid-cols-[minmax(220px,1.5fr)_minmax(120px,0.7fr)_minmax(130px,0.8fr)_minmax(120px,0.7fr)_minmax(92px,0.5fr)_44px] md:items-center",
                selected && "bg-[color-mix(in_srgb,var(--ds-accent)_10%,transparent)]",
              )}
            >
              <button
                type="button"
                aria-current={selected ? "true" : undefined}
                onClick={(event) => onOpenDetails(task.id, event.currentTarget)}
                className="min-w-0 pe-12 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-teal md:pe-0"
              >
                <strong className="block text-ds-heading font-black leading-6 text-ds-text-1 line-clamp-2 [overflow-wrap:anywhere] md:truncate">
                  {task.title}
                </strong>
                {task.clientName ? (
                  <span className="mt-1 flex min-w-0 items-center gap-1.5 text-ds-caption text-ds-text-3">
                    <Building2 size={12} className="shrink-0" aria-hidden="true" />
                    <span className="truncate">{task.clientName}</span>
                  </span>
                ) : null}
              </button>

              <span
                className="inline-flex min-h-7 w-fit items-center gap-1.5 rounded-full border px-2 text-ds-caption font-bold"
                style={{ borderColor: `${meta.color}55`, color: meta.color }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden="true" />
                {meta.label}
              </span>

              <span className="flex min-w-0 items-center gap-2 text-ds-caption text-ds-text-2">
                <UserRound size={13} className="shrink-0 text-ds-text-3" aria-hidden="true" />
                <span className="truncate">{task.assigneeName || "غير محدد"}</span>
              </span>

              <span className={cn("flex items-center gap-2 whitespace-nowrap text-ds-caption text-ds-text-2", overdue && "font-bold text-ds-danger")}>
                <CalendarDays size={13} className="shrink-0" aria-hidden="true" />
                {formatDueDate(task.dueDate)}
              </span>

              <span className="inline-flex items-center gap-1.5 text-ds-caption text-ds-text-3">
                <span className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_DOT[task.priority])} aria-hidden="true" />
                {PRIORITY_CONFIG[task.priority].label}
              </span>

              <div className="absolute end-3 top-2 md:static md:justify-self-end">
                <TaskActionsMenu
                  task={task}
                  canManage={canManage}
                  onOpen={(trigger) => onOpenDetails(task.id, trigger)}
                  onEdit={(trigger) => onEdit(task, trigger)}
                  onDelete={() => onDelete(task.id, task.title)}
                  onStatusChange={(status) => onStatusChange(task.id, status)}
                />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
