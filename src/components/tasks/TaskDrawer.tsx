"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * TaskDrawer — غلاف مشترك لنوافذ المهام (UI V2):
 * - Desktop: RTL Side Drawer على حافة inline-end، والقائمة تبقى ظاهرة خلفه.
 * - Mobile: Full-screen Sheet منظم يصعد من الأسفل مع safe-area-inset-bottom.
 *
 * يوفّر: قفل تمرير الخلفية، حصر التركيز (focus-trap)، الإغلاق بـ Escape،
 * الإغلاق بالنقر خارج اللوحة، زر إغلاق 44×44، وترويسة/تذييل ثابتين.
 * لا يحتوي أي منطق مهام — عرض فقط.
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
        "fixed inset-0 z-50 flex items-end justify-center",
        "bg-[#02070d]/72 backdrop-blur-[4px] animate-in fade-in duration-200 motion-reduce:animate-none",
        // Desktop: أفتح قليلًا وبلا ضبابية قوية حتى تبقى القائمة ظاهرة خلف الدرج.
        "sm:items-stretch sm:justify-end sm:bg-[#02070d]/45 sm:backdrop-blur-[2px]",
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
          "flex w-full flex-col overflow-hidden border border-white/[0.10] bg-[#0b1621] shadow-[0_28px_80px_rgba(0,0,0,0.55)]",
          // Mobile: sheet كامل الارتفاع تقريبًا يصعد من الأسفل.
          "max-h-[94svh] rounded-t-[18px] animate-in slide-in-from-bottom-4 duration-200 motion-reduce:animate-none",
          // Desktop: درج جانبي كامل الارتفاع على حافة inline-end.
          "sm:h-full sm:max-h-none sm:w-[min(468px,92vw)] sm:rounded-none sm:border-y-0 sm:border-e-0 sm:slide-in-from-bottom-0 sm:slide-in-from-left-6",
        )}
      >
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-white/20 sm:hidden" aria-hidden="true" />
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.12] px-4 py-3.5 sm:px-5">
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
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[9px] text-[#aeb9c5] transition-colors hover:bg-white/[0.055] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]"
          >
            <X size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">{children}</div>
        {footer ? (
          <footer className="shrink-0 border-t border-white/[0.12] bg-[#0b1621] px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-5">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

/** عنوان قسم داخل الدرج. */
export function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4 last:mb-0">
      <h3 className="mb-2.5 text-[10.5px] font-black uppercase tracking-wide text-[#7d91a4]">{title}</h3>
      {children}
    </section>
  );
}
