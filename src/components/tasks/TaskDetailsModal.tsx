"use client";

import { Building2, CalendarDays, CircleDot, Edit2, Trash2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { PublicCodeBadge } from "@/components/ui/PublicCodeBadge";
import type { Task } from "@/types";
import {
  EXECUTIVE_INSET,
  PRIORITY_CONFIG,
  formatDueDate,
  statusMeta,
} from "./TaskCard";
import { ExecutiveModal } from "./TaskFormModal";

export type TaskDetailsModalProps = {
  task: Task | null;
  canManage: boolean;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  returnFocus?: HTMLElement | null;
};

/** نافذة تفاصيل المهمة — نفس المحتوى والأزرار السابقة حرفيًا. */
export function TaskDetailsModal({
  task,
  canManage,
  onClose,
  onEdit,
  onDelete,
  returnFocus,
}: TaskDetailsModalProps) {
  return (
    <ExecutiveModal
      open={Boolean(task)}
      title={task?.title ?? "تفاصيل المهمة"}
      eyebrow="مساحة تنفيذ المهام"
      onClose={onClose}
      returnFocus={returnFocus}
      footer={task && canManage ? (
        <div className="flex gap-2">
          <button type="button" onClick={() => onEdit(task)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[7px] border border-white/[0.10] bg-white/[0.045] text-xs font-bold text-[#e4e9ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]"><Edit2 size={14} />تعديل</button>
          <button type="button" onClick={() => onDelete(task)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[7px] border border-[#d95b49]/24 bg-[#d95b49]/8 text-xs font-bold text-[#ff9d8a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]"><Trash2 size={14} />حذف</button>
        </div>
      ) : undefined}
    >
      {task ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <span className={cn("rounded-full border px-2 py-1 text-[10px] font-black", PRIORITY_CONFIG[task.priority].className)}>{PRIORITY_CONFIG[task.priority].label}</span>
            <span className="rounded-full border px-2 py-1 text-[10px] font-black" style={{ borderColor: `${statusMeta(task.status).color}55`, color: statusMeta(task.status).color }}>{statusMeta(task.status).label}</span>
            <PublicCodeBadge code={task.publicCode} />
          </div>
          {task.description ? <p className="text-xs leading-6 text-ds-text-2">{task.description}</p> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { label: "المكلّف", value: task.assigneeName || "غير محدد", icon: <UserRound size={13} /> },
              { label: "العميل", value: task.clientName || "دون عميل", icon: <Building2 size={13} /> },
              { label: "الموعد النهائي", value: formatDueDate(task.dueDate), icon: <CalendarDays size={13} /> },
              { label: "الحالة", value: statusMeta(task.status).label, icon: <CircleDot size={13} /> },
            ].map((item) => (
              <div key={item.label} className={cn(EXECUTIVE_INSET, "flex items-center gap-2.5 px-3 py-2.5")}>
                <span className="text-ds-teal">{item.icon}</span>
                <span className="min-w-0"><small className="block text-[9px] text-ds-text-3">{item.label}</small><strong className="block truncate text-[11px]">{item.value}</strong></span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </ExecutiveModal>
  );
}
