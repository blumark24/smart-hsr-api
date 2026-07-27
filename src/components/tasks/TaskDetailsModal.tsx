"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Building2, CalendarDays, CircleDot, Edit2, FileText, History, Trash2, UserRound } from "lucide-react";
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
import { TaskDrawer, DrawerSection } from "./TaskDrawer";

export type TaskDetailsModalProps = {
  task: Task | null;
  canManage: boolean;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  returnFocus?: HTMLElement | null;
};

function EmptyBlock({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[9px] border border-dashed border-white/[0.10] bg-[#07111b]/50 px-3.5 py-3">
      <span className="text-[#7d91a4]">{icon}</span>
      <span className="text-[11px] text-[#8d9baa]">{text}</span>
    </div>
  );
}

/**
 * درج تفاصيل المهمة (UI V2) — أقسام منظمة: العنوان/الحالة/الأولوية أعلى، نظرة عامة،
 * المسؤول/العميل/الموعد، الوصف، النشاط والمرفقات (Empty State حقيقي عند غياب المصدر)،
 * ثم تعديل (بارز) وحذف (ثانوي) مع تأكيد مستقل. لا يغيّر منطق الحذف — يستدعي onDelete.
 */
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
      subtitle={task ? <span className="text-[11.5px] text-[#8d9baa]">{task.clientName || "دون عميل"}</span> : undefined}
      headerExtra={task && meta ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border px-2.5 py-1 text-[10px] font-black" style={{ borderColor: `${meta.color}55`, color: meta.color }}>{meta.label}</span>
          <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-black", PRIORITY_CONFIG[task.priority].className)}>{PRIORITY_CONFIG[task.priority].label}</span>
          <PublicCodeBadge code={task.publicCode} />
        </div>
      ) : undefined}
      onClose={onClose}
      returnFocus={returnFocus}
      footer={task && canManage ? (
        confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="flex-1 text-[11px] font-bold text-[#ff9d8a]">تأكيد حذف هذه المهمة نهائيًا؟</span>
            <button type="button" onClick={() => setConfirmDelete(false)} className="min-h-11 rounded-[9px] border border-white/[0.10] bg-white/[0.045] px-4 text-xs font-bold text-[#e4e9ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]">إلغاء</button>
            <button type="button" onClick={() => onDelete(task)} className="inline-flex min-h-11 items-center gap-2 rounded-[9px] bg-[#d0503c] px-4 text-xs font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffb0a0]"><Trash2 size={14} />حذف نهائي</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onEdit(task)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[9px] bg-[#2276e3] text-xs font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8bbcff]"><Edit2 size={14} />تعديل المهمة</button>
            <button type="button" onClick={() => setConfirmDelete(true)} aria-label="حذف المهمة" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[9px] border border-[#d95b49]/28 bg-transparent text-[#c98a80] transition-colors hover:bg-[#d95b49]/10 hover:text-[#ff9d8a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]"><Trash2 size={15} /></button>
          </div>
        )
      ) : undefined}
    >
      {task && meta ? (
        <>
          {overdue ? (
            <div className="mb-4 flex items-center gap-2.5 rounded-[10px] border border-[#e0674f]/30 bg-[#e0674f]/[0.08] px-3.5 py-2.5">
              <AlertTriangle size={15} className="shrink-0 text-[#ff9d8a]" />
              <span className="text-[11.5px] font-bold text-[#ffc0a0]">هذه المهمة متأخرة عن موعدها — يُنصح بالمتابعة العاجلة.</span>
            </div>
          ) : null}

          <DrawerSection title="نظرة عامة">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "الحالة", value: meta.label, icon: <CircleDot size={13} /> },
                { label: "الأولوية", value: PRIORITY_CONFIG[task.priority].label, icon: <AlertTriangle size={13} /> },
                { label: "الموعد النهائي", value: formatDueDate(task.dueDate), icon: <CalendarDays size={13} /> },
                { label: "المسؤول", value: task.assigneeName || "غير محدد", icon: <UserRound size={13} /> },
              ].map((item) => (
                <div key={item.label} className={cn(EXECUTIVE_INSET, "flex items-center gap-2.5 px-3 py-2.5")}>
                  <span className="text-ds-teal">{item.icon}</span>
                  <span className="min-w-0"><small className="block text-[9px] text-ds-text-3">{item.label}</small><strong className="block truncate text-[11.5px] text-[#f6f8fb]">{item.value}</strong></span>
                </div>
              ))}
            </div>
          </DrawerSection>

          <DrawerSection title="المسؤول والعميل والموعد">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                { label: "المسؤول", value: task.assigneeName || "غير محدد", icon: <UserRound size={13} /> },
                { label: "العميل/المشروع", value: task.clientName || "دون عميل", icon: <Building2 size={13} /> },
                { label: "الموعد النهائي", value: formatDueDate(task.dueDate), icon: <CalendarDays size={13} /> },
              ].map((item) => (
                <div key={item.label} className={cn(EXECUTIVE_INSET, "flex items-center gap-2.5 px-3 py-2.5")}>
                  <span className="text-ds-teal">{item.icon}</span>
                  <span className="min-w-0"><small className="block text-[9px] text-ds-text-3">{item.label}</small><strong className="block truncate text-[11.5px] text-[#f6f8fb]">{item.value}</strong></span>
                </div>
              ))}
            </div>
          </DrawerSection>

          <DrawerSection title="الوصف">
            {task.description?.trim() ? (
              <p className="rounded-[9px] border border-white/[0.07] bg-[#07111b]/50 px-3.5 py-3 text-[12px] leading-7 text-ds-text-2">{task.description}</p>
            ) : (
              <EmptyBlock icon={<FileText size={15} />} text="لا يوجد وصف مضاف لهذه المهمة." />
            )}
          </DrawerSection>

          <DrawerSection title="النشاط">
            <EmptyBlock icon={<History size={15} />} text="لا يوجد سجل نشاط متاح لهذه المهمة بعد." />
          </DrawerSection>

          <DrawerSection title="المرفقات">
            <EmptyBlock icon={<FileText size={15} />} text="لا توجد مرفقات مرتبطة بهذه المهمة." />
          </DrawerSection>
        </>
      ) : null}
    </TaskDrawer>
  );
}
