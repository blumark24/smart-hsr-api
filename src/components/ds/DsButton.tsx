"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type DsButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type DsButtonSize = "md" | "icon";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-ring";

const VARIANT_CLASS: Record<DsButtonVariant, string> = {
  primary:
    "bg-ds-accent text-white font-black shadow-ds-1 " +
    "hover:brightness-110 active:translate-y-px motion-reduce:transform-none",
  secondary:
    "border border-ds-border bg-white/[0.045] text-ds-text-1 font-bold hover:bg-white/[0.07]",
  ghost:
    "text-ds-text-2 hover:bg-white/[0.055] hover:text-ds-text-1",
  danger:
    "border border-[color-mix(in_srgb,var(--ds-danger)_24%,transparent)] " +
    "bg-[color-mix(in_srgb,var(--ds-danger)_8%,transparent)] text-ds-danger font-bold " +
    "hover:bg-[color-mix(in_srgb,var(--ds-danger)_14%,transparent)]",
};

const SIZE_CLASS: Record<DsButtonSize, string> = {
  md: "min-h-11 gap-2 px-4",
  icon: "h-11 w-11 shrink-0",
};

export type DsButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: DsButtonVariant;
  size?: DsButtonSize;
  /** يعطّل الزر ويعرض مؤشر تحميل مكان الأيقونة */
  loading?: boolean;
  icon?: ReactNode;
};

/**
 * زر Design System V1 — أهداف لمس 44px، حلقة تركيز موحّدة،
 * انتقالات تحترم prefers-reduced-motion، وألوان عبر التوكنز فقط.
 */
export const DsButton = forwardRef<HTMLButtonElement, DsButtonProps>(
  function DsButton(
    { variant = "primary", size = "md", loading = false, icon, className, children, disabled, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={rest.type ?? "button"}
        disabled={disabled || loading}
        {...rest}
        className={cn(
          "inline-flex items-center justify-center rounded-ds-sm text-ds-label",
          "transition-[background-color,filter,transform] duration-150 motion-reduce:transition-none",
          "disabled:pointer-events-none disabled:opacity-55",
          FOCUS_RING,
          VARIANT_CLASS[variant],
          SIZE_CLASS[size],
          className,
        )}
      >
        {loading ? <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : icon}
        {size === "icon" ? null : children}
      </button>
    );
  },
);
