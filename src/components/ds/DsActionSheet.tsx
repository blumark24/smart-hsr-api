"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type DsActionSheetItem = {
  id: string;
  label: string;
  note?: string;
  icon: ReactNode;
  /** يظهر العنصر كنشط مع علامة تأكيد */
  active?: boolean;
  /** رابط تنقّل — يتقدم على onSelect عند وجوده */
  href?: string;
  onSelect?: () => void;
  /** تلوين تحذيري لإجراءات الحذف */
  danger?: boolean;
};

export type DsActionSheetProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  items: DsActionSheetItem[];
  onClose: () => void;
  /** زر الفتح — يُستخدم لتجاهل نقره الخارجي واستعادة التركيز إليه */
  returnFocus: HTMLElement | null;
};

/**
 * قائمة إجراءات Design System V1 — Bottom Sheet على الجوال وPopover
 * من md فأعلى. role="menu" مع تنقّل أسهم/Home/End، إغلاق بالنقر الخارجي
 * وEscape، واستعادة التركيز. البديل الرسمي لقوائم <details>.
 */
export function DsActionSheet({ open, title, subtitle, items, onClose, returnFocus }: DsActionSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const previousOverflow = document.body.style.overflow;
    if (isMobile) document.body.style.overflow = "hidden";

    const frame = requestAnimationFrame(() => {
      const preferred = panel.querySelector<HTMLElement>("[data-active='true']")
        ?? panel.querySelector<HTMLElement>("[role='menuitem']");
      preferred?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      const menuItems = Array.from(panel.querySelectorAll<HTMLElement>("[role='menuitem']"))
        .filter((element) => element.tabIndex !== -1 && element.offsetParent !== null);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (!menuItems.length) return;
        event.preventDefault();
        const currentIndex = menuItems.indexOf(document.activeElement as HTMLElement);
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const nextIndex = currentIndex < 0
          ? 0
          : (currentIndex + direction + menuItems.length) % menuItems.length;
        menuItems[nextIndex]?.focus();
      } else if (event.key === "Home" || event.key === "End") {
        if (!menuItems.length) return;
        event.preventDefault();
        menuItems[event.key === "Home" ? 0 : menuItems.length - 1]?.focus();
      } else if (event.key === "Tab" && isMobile) {
        const focusable = Array.from(panel.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href], input:not([type='hidden']):not([hidden]), select, textarea, [tabindex]:not([tabindex='-1'])",
        )).filter((element) => element.tabIndex !== -1 && element.offsetParent !== null);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    const onOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panel.contains(target) && !returnFocus?.contains(target)) closeRef.current();
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onOutsideClick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onOutsideClick);
      if (isMobile) document.body.style.overflow = previousOverflow;
      requestAnimationFrame(() => returnFocus?.focus());
    };
  }, [open, returnFocus]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-end backdrop-blur-[7px]",
        "bg-[color-mix(in_srgb,var(--ds-bg)_70%,transparent)]",
        "md:absolute md:inset-auto md:start-0 md:top-[calc(100%+6px)] md:block md:bg-transparent md:backdrop-blur-none",
      )}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="menu"
        aria-label={title}
        className={cn(
          "flex max-h-[78svh] w-full flex-col overflow-hidden rounded-t-ds-lg border border-ds-border",
          "bg-ds-surface-1 shadow-ds-3",
          "animate-in slide-in-from-bottom-2 duration-150 motion-reduce:animate-none",
          "md:w-[296px] md:rounded-ds-md md:zoom-in-95",
        )}
      >
        <div className="sticky top-0 flex shrink-0 items-center justify-between gap-3 border-b border-ds-border-soft bg-ds-surface-1 px-4 py-3">
          <div>
            <strong className="block text-ds-heading font-black text-ds-text-1">{title}</strong>
            {subtitle ? <span className="text-ds-caption text-ds-text-3">{subtitle}</span> : null}
          </div>
          <button
            type="button"
            aria-label="إغلاق القائمة"
            onClick={onClose}
            className={cn(
              "grid h-11 w-11 place-items-center rounded-ds-sm text-ds-text-2",
              "hover:bg-white/[0.055] hover:text-ds-text-1",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-ring",
            )}
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 pb-[max(8px,env(safe-area-inset-bottom))]">
          {items.map((item) => {
            const itemClassName = cn(
              "flex min-h-12 w-full items-center gap-3 rounded-ds-sm px-3 py-2 text-start",
              "transition-colors duration-150 motion-reduce:transition-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-ring",
              item.active
                ? "bg-[color-mix(in_srgb,var(--ds-accent)_16%,transparent)] text-ds-text-1"
                : item.danger
                  ? "text-ds-danger hover:bg-[color-mix(in_srgb,var(--ds-danger)_10%,transparent)]"
                  : "text-ds-text-1 hover:bg-white/[0.055]",
            );
            const content = (
              <>
                <span
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-ds-sm bg-white/[0.045]",
                    item.active && "bg-[color-mix(in_srgb,var(--ds-accent)_18%,transparent)]",
                  )}
                >
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-ds-caption font-bold">{item.label}</strong>
                  {item.note ? <small className="mt-0.5 block truncate text-ds-caption text-ds-text-3">{item.note}</small> : null}
                </span>
                {item.active ? <CheckCircle2 size={14} className="shrink-0 text-ds-teal" aria-hidden="true" /> : null}
              </>
            );
            if (item.href) {
              return (
                <Link key={item.id} href={item.href} role="menuitem" className={itemClassName} onClick={onClose}>
                  {content}
                </Link>
              );
            }
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                data-active={item.active ? "true" : undefined}
                aria-current={item.active ? "true" : undefined}
                onClick={() => {
                  item.onSelect?.();
                  onClose();
                }}
                className={itemClassName}
              >
                {content}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
