"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * غلاف نافذة المهام المركزية. يوفّر قفل تمرير الخلفية، حصر التركيز،
 * Escape، الإغلاق خارج النافذة، وإعادة التركيز للمشغّل.
 */
export function TaskDrawer({
  open,
  title,
  subtitle,
  headerExtra,
  children,
  footer,
  onClose,
  returnFocus,
  labelledById = "task-drawer-title",
}: {
  open: boolean;
  title: string;
  subtitle?: ReactNode;
  headerExtra?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  returnFocus?: HTMLElement | null;
  labelledById?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
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
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          "a[href],button:not(:disabled),textarea:not(:disabled),input:not([type='hidden']):not([hidden]):not(:disabled),select:not(:disabled),[tabindex]:not([tabindex='-1'])",
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
        "fixed inset-0 z-50 flex items-center justify-center p-3",
        "bg-[#02070d]/72 backdrop-blur-[4px] animate-in fade-in duration-200 motion-reduce:animate-none",
      )}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledById}
        className={cn(
          "flex max-h-[calc(100svh-24px)] w-[calc(100vw-24px)] flex-col overflow-hidden rounded-ds-lg border border-ds-border bg-[#0b1927] shadow-ds-3",
          "animate-in fade-in zoom-in-95 duration-200 motion-reduce:animate-none",
          "sm:w-[min(540px,calc(100vw-40px))]",
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-ds-border-strong bg-[#0b1927] px-4 py-3.5 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 id={labelledById} className="truncate text-[16px] font-black leading-6 text-[#f6f8fb]">{title}</h2>
            {subtitle ? <div className="mt-1">{subtitle}</div> : null}
            {headerExtra ? <div className="mt-2.5">{headerExtra}</div> : null}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="إغلاق"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-ds-sm text-ds-text-2 transition-colors hover:bg-ds-surface-3 hover:text-ds-text-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-teal"
          >
            <X size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">{children}</div>
        {footer ? (
          <footer className="shrink-0 border-t border-ds-border-strong bg-[#0b1927] px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-5">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

/** عنوان قسم داخل نافذة المهمة. */
export function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4 last:mb-0">
      <h3 className="mb-2.5 text-[10.5px] font-black uppercase tracking-wide text-[#7d91a4]">{title}</h3>
      {children}
    </section>
  );
}
