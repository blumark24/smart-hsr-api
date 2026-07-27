"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Edit2,
  Trash2,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PublicCodeBadge } from "@/components/ui/PublicCodeBadge";
import type { Task } from "@/types";
import {
  EXECUTIVE_INSET,
  PRIORITY_CONFIG,
  formatDueDate,
  isOverdue,
  statusMeta,
} from "./TaskCard";
import { DrawerSection, TaskDrawer } from "./TaskDrawer";

export type TaskDetailsModalProps = {
  task: Task | null;
  canManage: boolean;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  returnFocus?: HTMLElement | null;
};

export function TaskDetailsModal({
  task,
  canManage,
  onClose,
  onEdit,
  onDelete,
  returnFocus,
}: TaskDetailsModalProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!task) setConfirmDelete(false);
  }, [task]);

  const overdue = task ? isOverdue(task.dueDate, task.status) : false;
  const meta = task ? statusMeta(task.status) : null;

  return (
    <TaskDrawer
      open={Boolean(task)}
      title={task?.title ?? "تفاصيل المهمة"}
      labelledById="task-details-title"
      headerExtra={task && meta ? (
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2 text-ds-caption font-black"
            style={{ borderColor: `${meta.color}55`, color: meta.color }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden="true" />
            {meta.label}
          </span>
          <span className={cn("inline-flex min-h-7 items-center rounded-full border px-2 text-ds-caption font-black", PRIORITY_CONFIG[task.priority].className)}>
            أولوية {PRIORITY_CONFIG[task.priority].label}
          </span>
          <PublicCodeBadge code={task.publicCode} />
        </div>
      ) : undefined}
      onClose={onClose}
      returnFocus={returnFocus}
      footer={task && canManage ? (
        confirmDelete ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="flex-1 text-ds-caption font-bold text-ds-danger">تأكيد حذف هذه المهمة نهائيًا؟</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="min-h-11 flex-1 rounded-ds-sm border border-ds-border bg-white/[0.045] px-4 text-ds-caption font-bold text-ds-text-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-teal sm:flex-none"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => onDelete(task)}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-ds-sm bg-ds-danger px-4 text-ds-caption font-black text-ds-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-teal sm:flex-none"
              >
                <Trash2 size={14} />
                حذف نهائي
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit(task)}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-ds-sm bg-ds-accent text-ds-caption font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-teal"
            >
              <Edit2 size={14} />
              تعديل المهمة
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              aria-label="حذف المهمة"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-ds-sm border border-[color-mix(in_srgb,var(--ds-danger)_30%,transparent)] bg-transparent text-ds-danger transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--ds-danger)_10%,transparent)] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-teal"
            >
              <Trash2 size={15} />
            </button>
          </div>
        )
      ) : undefined}
    >
      {task ? (
        <>
          {overdue ? (
            <div className="mb-4 flex items-center gap-2 rounded-ds-md border border-[color-mix(in_srgb,var(--ds-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--ds-danger)_8%,transparent)] px-3 py-3">
              <AlertTriangle size={15} className="shrink-0 text-ds-danger" aria-hidden="true" />
              <span className="text-ds-caption font-bold leading-5 text-ds-danger">هذه المهمة متأخرة عن موعدها.</span>
            </div>
          ) : null}

          <DrawerSection title="تفاصيل التنفيذ">
            <dl className="grid gap-2 sm:grid-cols-3">
              {[
                { label: "المسؤول", value: task.assigneeName || "غير محدد", icon: <UserRound size={14} /> },
                { label: "العميل/المشروع", value: task.clientName || "دون عميل", icon: <Building2 size={14} /> },
                { label: "الموعد النهائي", value: formatDueDate(task.dueDate), icon: <CalendarDays size={14} /> },
              ].map((item) => (
                <div key={item.label} className={cn(EXECUTIVE_INSET, "flex min-w-0 items-center gap-2 p-3")}>
                  <span className="shrink-0 text-ds-teal" aria-hidden="true">{item.icon}</span>
                  <span className="min-w-0">
                    <dt className="text-ds-caption text-ds-text-3">{item.label}</dt>
                    <dd className="truncate text-ds-caption font-bold text-ds-text-1">{item.value}</dd>
                  </span>
                </div>
              ))}
            </dl>
          </DrawerSection>

          <DrawerSection title="الوصف">
            <p className="rounded-ds-sm border border-ds-border-soft bg-ds-surface-2/50 p-3 text-ds-body leading-7 text-ds-text-2 [overflow-wrap:anywhere]">
              {task.description?.trim() || "لا يوجد وصف مضاف لهذه المهمة."}
            </p>
          </DrawerSection>
        </>
      ) : null}
    </TaskDrawer>
  );
}
