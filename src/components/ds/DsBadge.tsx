import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type DsBadgeTone = "info" | "warn" | "review" | "success" | "danger" | "neutral";

/**
 * الخلفية والحد شفافان عبر color-mix على متغيرات التوكنز —
 * لا يوجد أي hex مكتوب داخل المكوّن.
 */
const TONE_CLASS: Record<DsBadgeTone, string> = {
  info:
    "text-ds-info border-[color-mix(in_srgb,var(--ds-info)_40%,transparent)] " +
    "bg-[color-mix(in_srgb,var(--ds-info)_12%,transparent)]",
  warn:
    "text-ds-warn border-[color-mix(in_srgb,var(--ds-warn)_40%,transparent)] " +
    "bg-[color-mix(in_srgb,var(--ds-warn)_12%,transparent)]",
  review:
    "text-ds-review border-[color-mix(in_srgb,var(--ds-review)_40%,transparent)] " +
    "bg-[color-mix(in_srgb,var(--ds-review)_12%,transparent)]",
  success:
    "text-ds-success border-[color-mix(in_srgb,var(--ds-success)_40%,transparent)] " +
    "bg-[color-mix(in_srgb,var(--ds-success)_12%,transparent)]",
  danger:
    "text-ds-danger border-[color-mix(in_srgb,var(--ds-danger)_40%,transparent)] " +
    "bg-[color-mix(in_srgb,var(--ds-danger)_12%,transparent)]",
  neutral: "text-ds-text-2 border-ds-border bg-white/[0.05]",
};

const DOT_CLASS: Record<DsBadgeTone, string> = {
  info: "bg-ds-info",
  warn: "bg-ds-warn",
  review: "bg-ds-review",
  success: "bg-ds-success",
  danger: "bg-ds-danger",
  neutral: "bg-ds-text-3",
};

export type DsBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: DsBadgeTone;
  /** يعرض نقطة ملوّنة قبل النص (مفيد لحالات المهام) */
  dot?: boolean;
};

/** رقاقة حالة/أولوية Design System V1. */
export function DsBadge({ tone = "neutral", dot = false, className, children, ...rest }: DsBadgeProps) {
  return (
    <span
      {...rest}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-ds-caption font-bold",
        TONE_CLASS[tone],
        className,
      )}
    >
      {dot ? <i aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", DOT_CLASS[tone])} /> : null}
      {children}
    </span>
  );
}
