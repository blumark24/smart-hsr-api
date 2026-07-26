"use client";

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const CONTROL_CLASS =
  "min-h-11 w-full rounded-ds-sm border border-ds-border bg-[color-mix(in_srgb,var(--ds-surface-2)_80%,transparent)] " +
  "px-3 text-ds-body text-ds-text-1 outline-none transition-colors duration-150 motion-reduce:transition-none " +
  "placeholder:text-ds-text-3 " +
  "focus:border-[color-mix(in_srgb,var(--ds-accent)_70%,transparent)] " +
  "focus:ring-2 focus:ring-[color-mix(in_srgb,var(--ds-accent)_15%,transparent)] " +
  "disabled:opacity-55 " +
  "aria-[invalid=true]:border-[color-mix(in_srgb,var(--ds-danger)_60%,transparent)]";

type FieldShellProps = {
  label: string;
  /** رسالة خطأ تظهر تحت الحقل وتُربط بـ aria-describedby */
  error?: string;
  /** نص مساعد اختياري يظهر تحت الحقل عند غياب الخطأ */
  hint?: string;
  className?: string;
};

function FieldShell({
  label,
  error,
  hint,
  className,
  controlId,
  messageId,
  children,
}: FieldShellProps & { controlId: string; messageId: string; children: ReactNode }) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={controlId} className="mb-1.5 block text-ds-caption font-bold text-ds-text-2">
        {label}
      </label>
      {children}
      {error ? (
        <p id={messageId} role="alert" className="mt-1.5 flex items-center gap-1.5 text-ds-caption text-ds-danger">
          <CircleAlert size={12} aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="mt-1.5 text-ds-caption text-ds-text-3">{hint}</p>
      ) : null}
    </div>
  );
}

function useFieldIds(explicitId: string | undefined, error: string | undefined, hint: string | undefined) {
  const generated = useId();
  const controlId = explicitId ?? `ds-field-${generated}`;
  const messageId = `${controlId}-message`;
  return {
    controlId,
    messageId,
    describedBy: error || hint ? messageId : undefined,
  };
}

export type DsInputProps = InputHTMLAttributes<HTMLInputElement> & FieldShellProps;

/** حقل نص Design System V1 — تسمية وخطأ ومساعدة مربوطة بـ ARIA تلقائيًا. */
export const DsInput = forwardRef<HTMLInputElement, DsInputProps>(function DsInput(
  { label, error, hint, className, id, ...rest },
  ref,
) {
  const ids = useFieldIds(id, error, hint);
  return (
    <FieldShell label={label} error={error} hint={hint} className={className} controlId={ids.controlId} messageId={ids.messageId}>
      <input
        ref={ref}
        id={ids.controlId}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        {...rest}
        className={CONTROL_CLASS}
      />
    </FieldShell>
  );
});

export type DsSelectProps = SelectHTMLAttributes<HTMLSelectElement> & FieldShellProps;

/** قائمة اختيار Design System V1. */
export const DsSelect = forwardRef<HTMLSelectElement, DsSelectProps>(function DsSelect(
  { label, error, hint, className, id, children, ...rest },
  ref,
) {
  const ids = useFieldIds(id, error, hint);
  return (
    <FieldShell label={label} error={error} hint={hint} className={className} controlId={ids.controlId} messageId={ids.messageId}>
      <select
        ref={ref}
        id={ids.controlId}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        {...rest}
        className={CONTROL_CLASS}
      >
        {children}
      </select>
    </FieldShell>
  );
});

export type DsTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & FieldShellProps;

/** مساحة نص Design System V1. */
export const DsTextarea = forwardRef<HTMLTextAreaElement, DsTextareaProps>(function DsTextarea(
  { label, error, hint, className, id, ...rest },
  ref,
) {
  const ids = useFieldIds(id, error, hint);
  return (
    <FieldShell label={label} error={error} hint={hint} className={className} controlId={ids.controlId} messageId={ids.messageId}>
      <textarea
        ref={ref}
        id={ids.controlId}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        {...rest}
        className={cn(CONTROL_CLASS, "min-h-20 resize-y py-2")}
      />
    </FieldShell>
  );
});
