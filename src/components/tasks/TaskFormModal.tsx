"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, LoaderCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Client, Employee, Task, TaskPriority, TaskStatus } from "@/types";
import { INPUT_CLASS, PRIORITY_CONFIG, STATUS_COLUMNS } from "./TaskCard";
import { TaskDrawer, DrawerSection } from "./TaskDrawer";

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#02070d]/72 p-3 backdrop-blur-[4px] animate-in fade-in duration-200 motion-reduce:animate-none"
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
          "flex max-h-[calc(100svh-24px)] w-[calc(100vw-24px)] flex-col overflow-hidden rounded-ds-lg border border-ds-border",
          "bg-[#0b1927] shadow-ds-3",
          "animate-in fade-in zoom-in-95 duration-200 motion-reduce:animate-none sm:w-[min(540px,calc(100vw-40px))]",
        )}
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-ds-border-strong bg-[#0b1927] px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <small className="block text-[10px] font-bold text-ds-teal">{eyebrow}</small>
            <h2 id="tasks-executive-panel-title" className="mt-1 truncate text-lg font-black text-[#f6f8fb]">{title}</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="إغلاق النافذة"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-ds-sm text-ds-text-2 transition-colors hover:bg-ds-surface-3 hover:text-ds-text-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-teal"
          >
            <X size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {children}
        </div>
        {footer ? (
          <footer className="shrink-0 border-t border-ds-border-strong bg-[#0b1927] px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-5">
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

const FIELD_LABEL = "mb-1.5 block text-[11px] font-bold text-[#aeb9c5]";

/**
 * درج إضافة/تعديل المهمة (UI V2) — الحقول الأساسية أولًا، والثانوية داخل
 * «خيارات إضافية». نفس الحالة والـ props ومنطق الحفظ بلا تغيير؛ التحقق هنا بصري
 * فقط (يمنع النداء الفارغ ويبرز الحقل)، والحفظ الفعلي يبقى في الصفحة.
 */
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
  const [showErrors, setShowErrors] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const titleMissing = !form.title.trim();

  useEffect(() => {
    if (!open) setShowErrors(false);
  }, [open]);

  const handleSave = () => {
    if (titleMissing) {
      setShowErrors(true);
      requestAnimationFrame(() => titleRef.current?.focus());
      return;
    }
    onSave();
  };

  return (
    <TaskDrawer
      open={open}
      title={editTask ? "تعديل المهمة" : "مهمة جديدة"}
      subtitle={<span className="text-[11.5px] text-[#8d9baa]">نظّم مهمة منشأتك في خطوات واضحة</span>}
      onClose={onClose}
      returnFocus={returnFocus}
      labelledById="task-form-title"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button type="button" onClick={onClose} disabled={saving} className="min-h-11 flex-1 rounded-[9px] border border-white/[0.10] bg-white/[0.045] text-xs font-bold text-[#e4e9ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]">إلغاء</button>
          <button type="button" onClick={handleSave} disabled={saving} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[9px] bg-[#2276e3] text-xs font-black text-white disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8bbcff]">
            {saving ? <LoaderCircle size={14} className="animate-spin" /> : null}
            {saving ? "جاري الحفظ" : editTask ? "حفظ التعديلات" : "إضافة المهمة"}
          </button>
        </div>
      }
    >
      <DrawerSection title="المعلومات الأساسية">
        <div className="space-y-3">
          <label className="block">
            <span className={FIELD_LABEL}>عنوان المهمة <span className="text-[#ff9d8a]">*</span></span>
            <input
              ref={titleRef}
              type="text"
              className={cn(INPUT_CLASS, showErrors && titleMissing && "border-[#e0674f]/70 ring-2 ring-[#e0674f]/20")}
              placeholder="أدخل عنوان المهمة"
              value={form.title}
              aria-invalid={showErrors && titleMissing}
              onChange={(event) => onChange({ title: event.target.value })}
            />
            {showErrors && titleMissing ? <span className="mt-1.5 block text-[10.5px] font-bold text-[#ff9d8a]">عنوان المهمة مطلوب</span> : null}
          </label>
          <label className="block">
            <span className={FIELD_LABEL}>الوصف</span>
            <textarea className={cn(INPUT_CLASS, "min-h-20 resize-y py-2")} placeholder="ما الذي تسعى هذه المهمة لتحقيقه؟" value={form.description} onChange={(event) => onChange({ description: event.target.value })} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className={FIELD_LABEL}>المسؤول</span>
              <select className={INPUT_CLASS} value={form.assigneeId} onChange={(event) => { const employee = employees.find((item) => item.id === event.target.value); onChange({ assigneeId: event.target.value, assigneeName: employee?.name ?? "" }); }}>
                <option value="">اختر موظفًا</option>
                {employees.filter((employee) => employee.status === "نشط").map((employee) => <option key={employee.id} value={employee.id}>{employee.name} ({employee.department})</option>)}
              </select>
            </label>
            <label>
              <span className={FIELD_LABEL}>الأولوية</span>
              <select className={INPUT_CLASS} value={form.priority} onChange={(event) => onChange({ priority: event.target.value as TaskPriority })}>
                {Object.entries(PRIORITY_CONFIG).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
              </select>
            </label>
          </div>
          <label className="block">
            <span className={FIELD_LABEL}>الموعد النهائي</span>
            <input className={INPUT_CLASS} type="date" value={form.dueDate} onChange={(event) => onChange({ dueDate: event.target.value })} />
          </label>
        </div>
      </DrawerSection>

      <details className="group rounded-[10px] border border-white/[0.08] bg-[#07111b]/60">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3.5 text-[11.5px] font-black text-[#d7dee6] marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]">
          خيارات إضافية
          <ChevronDown size={15} className="text-[#8d9baa] transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <div className="space-y-3 border-t border-white/[0.07] p-3.5">
          <label className="block">
            <span className={FIELD_LABEL}>الحالة</span>
            <select className={INPUT_CLASS} value={form.status} onChange={(event) => onChange({ status: event.target.value as TaskStatus })}>
              {STATUS_COLUMNS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={FIELD_LABEL}>العميل/المشروع (اختياري)</span>
            <select className={INPUT_CLASS} value={form.clientId} onChange={(event) => { const client = clients.find((item) => item.id === event.target.value); onChange({ clientId: event.target.value, clientName: client?.name ?? "" }); }}>
              <option value="">دون عميل</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name} ({client.status})</option>)}
            </select>
          </label>
        </div>
      </details>
    </TaskDrawer>
  );
}
