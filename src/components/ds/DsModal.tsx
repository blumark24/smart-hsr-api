"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type DsModalProps = {
  open: boolean;
  title: string;
  /** سطر علوي صغير فوق العنوان (سياق النافذة) */
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  /** العنصر الذي يستعيد التركيز بعد الإغلاق (زر الفتح عادة) */
  returnFocus?: HTMLElement | null;
  /** العرض الأقصى على الشاشات الكبيرة */
  maxWidthClassName?: string;
};

/**
 * نافذة Design System V1 — Bottom Sheet على الجوال ومودال مركزي من sm فأعلى.
 * Focus trap كامل، إغلاق بـ Escape، قفل تمرير الصفحة، استعادة التركيز،
 * وحركات تحترم prefers-reduced-motion.
 */
export function DsModal({
  open,
  title,
  eyebrow,
  children,
  footer,
  onClose,
  returnFocus,
  maxWidthClassName = "sm:max-w-[540px]",
}: DsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  const titleId = useId();

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
      className={cn(
        "fixed inset-0 z-50 flex items-end justify-center p-0",
        "bg-[color-mix(in_srgb,var(--ds-bg)_72%,transparent)] backdrop-blur-[5px]",
        "animate-in fade-in duration-200 motion-reduce:animate-none sm:items-center sm:p-5",
      )}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "flex max-h-[88svh] w-full flex-col overflow-hidden rounded-t-ds-lg border border-ds-border",
          "bg-ds-surface-1 shadow-ds-3",
          "animate-in slide-in-from-bottom-4 duration-200 motion-reduce:animate-none sm:rounded-ds-md sm:zoom-in-95",
          maxWidthClassName,
        )}
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-ds-border-strong px-4 py-4 sm:px-5">
          <div className="min-w-0">
            {eyebrow ? (
              <small className="block text-ds-caption font-bold text-[color-mix(in_srgb,var(--ds-accent)_55%,var(--ds-text-1))]">
                {eyebrow}
              </small>
            ) : null}
            <h2 id={titleId} className="mt-1 truncate text-ds-title font-black text-ds-text-1">{title}</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="إغلاق النافذة"
            onClick={onClose}
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-ds-sm text-ds-text-2",
              "transition-colors motion-reduce:transition-none hover:bg-white/[0.055] hover:text-ds-text-1",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-ring",
            )}
          >
            <X size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {children}
        </div>
        {footer ? (
          <footer className="shrink-0 border-t border-ds-border-strong px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-5">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
