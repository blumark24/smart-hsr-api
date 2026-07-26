"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { LoaderCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Client, Employee, Task, TaskPriority, TaskStatus } from "@/types";
import { INPUT_CLASS, PRIORITY_CONFIG, STATUS_COLUMNS } from "./TaskCard";

/**
 * النافذة التنفيذية المشتركة ونموذج إضافة/تعديل المهمة
 * (المرحلة 3 — نقل حرفي بلا تغيير بصري).
 */

export function ExecutiveModal({
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

export type TaskFormState = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string;
  assigneeName: string;
  clientId: string;
  clientName: string;
  dueDate: string;
};

export type TaskFormModalProps = {
  open: boolean;
  editTask: Task | null;
  form: TaskFormState;
  saving: boolean;
  employees: Employee[];
  clients: Client[];
  onChange: (patch: Partial<TaskFormState>) => void;
  onClose: () => void;
  onSave: () => void;
  returnFocus?: HTMLElement | null;
};

/** نافذة إضافة/تعديل المهمة — الحقول كما كانت حرفيًا، والحالة مملوكة للصفحة. */
export function TaskFormModal({
  open,
  editTask,
  form,
  saving,
  employees,
  clients,
  onChange,
  onClose,
  onSave,
  returnFocus,
}: TaskFormModalProps) {
  return (
    <ExecutiveModal
      open={open}
      title={editTask ? "تعديل المهمة" : "إضافة مهمة جديدة"}
      eyebrow="مساحة تنفيذ المهام"
      onClose={onClose}
      returnFocus={returnFocus}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button type="button" onClick={onClose} disabled={saving} className="min-h-11 flex-1 rounded-[7px] border border-white/[0.10] bg-white/[0.045] text-xs font-bold text-[#e4e9ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]">إلغاء</button>
          <button type="button" onClick={onSave} disabled={saving} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[7px] bg-[#2276e3] text-xs font-black text-white disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8bbcff]">
            {saving ? <LoaderCircle size={14} className="animate-spin" /> : null}
            {saving ? "جاري الحفظ" : editTask ? "حفظ التعديلات" : "إضافة المهمة"}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-bold text-[#aeb9c5]">عنوان المهمة</span>
          <input className={INPUT_CLASS} placeholder="أدخل عنوان المهمة" value={form.title} onChange={(event) => onChange({ title: event.target.value })} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-bold text-[#aeb9c5]">الوصف</span>
          <textarea className={cn(INPUT_CLASS, "min-h-20 resize-y py-2")} placeholder="وصف تفصيلي للمهمة" value={form.description} onChange={(event) => onChange({ description: event.target.value })} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1.5 block text-[10px] font-bold text-[#aeb9c5]">الأولوية</span>
            <select className={INPUT_CLASS} value={form.priority} onChange={(event) => onChange({ priority: event.target.value as TaskPriority })}>
              {Object.entries(PRIORITY_CONFIG).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold text-[#aeb9c5]">الحالة</span>
            <select className={INPUT_CLASS} value={form.status} onChange={(event) => onChange({ status: event.target.value as TaskStatus })}>
              {STATUS_COLUMNS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1.5 block text-[10px] font-bold text-[#aeb9c5]">المكلّف</span>
            <select className={INPUT_CLASS} value={form.assigneeId} onChange={(event) => { const employee = employees.find((item) => item.id === event.target.value); onChange({ assigneeId: event.target.value, assigneeName: employee?.name ?? "" }); }}>
              <option value="">اختر موظفًا</option>
              {employees.filter((employee) => employee.status === "نشط").map((employee) => <option key={employee.id} value={employee.id}>{employee.name} ({employee.department})</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold text-[#aeb9c5]">الموعد النهائي</span>
            <input className={INPUT_CLASS} type="date" value={form.dueDate} onChange={(event) => onChange({ dueDate: event.target.value })} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-bold text-[#aeb9c5]">العميل (اختياري)</span>
          <select className={INPUT_CLASS} value={form.clientId} onChange={(event) => { const client = clients.find((item) => item.id === event.target.value); onChange({ clientId: event.target.value, clientName: client?.name ?? "" }); }}>
            <option value="">دون عميل</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name} ({client.status})</option>)}
          </select>
        </label>
      </div>
    </ExecutiveModal>
  );
}
