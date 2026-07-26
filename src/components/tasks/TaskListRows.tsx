"use client";

import { CalendarDays, UserRound } from "lucide-react";
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

/** عرض القائمة — صفوف المهام بنفس المخرجات السابقة حرفيًا. */
export function TaskListRows({
  tasks,
  canManage,
  onOpenDetails,
  onEdit,
  onDelete,
  onStatusChange,
}: { tasks: Task[] } & TaskItemHandlers) {
  return (
    <div className="divide-y divide-white/[0.07]">
      {tasks.map((task) => {
        const meta = statusMeta(task.status);
        const overdue = isOverdue(task.dueDate, task.status);
        return (
          <article key={task.id} className="grid min-w-0 gap-3 px-3 py-3 transition-colors duration-150 hover:bg-white/[0.025] sm:px-4 md:grid-cols-[minmax(200px,1.5fr)_minmax(130px,0.8fr)_minmax(128px,0.7fr)_auto] md:items-center">
            <button type="button" onClick={(event) => onOpenDetails(task.id, event.currentTarget)} className="min-w-0 rounded-[6px] text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]">
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
  );
}
