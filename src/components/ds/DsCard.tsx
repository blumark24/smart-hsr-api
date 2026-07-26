import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type DsCardVariant = "glass" | "inset" | "task";
export type DsCardPadding = "none" | "sm" | "md";

const VARIANT_CLASS: Record<DsCardVariant, string> = {
  /** السطح الرئيسي — الزجاج التنفيذي للحاويات الكبرى */
  glass:
    "rounded-ds-md bg-[color-mix(in_srgb,var(--ds-surface-1)_96%,transparent)] " +
    "shadow-ds-2 backdrop-blur-[12px]",
  /** سطح غائر داخل البطاقات (صفوف معلومات، إحصاءات مصغّرة) */
  inset:
    "rounded-ds-sm border border-ds-border-soft bg-[color-mix(in_srgb,var(--ds-surface-2)_72%,transparent)]",
  /** بطاقة مهمة/عنصر تفاعلي مرفوع قليلًا */
  task:
    "rounded-ds-sm bg-ds-surface-3 shadow-ds-1",
};

const PADDING_CLASS: Record<DsCardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-3 sm:p-4",
};

export type DsCardProps = HTMLAttributes<HTMLElement> & {
  variant?: DsCardVariant;
  padding?: DsCardPadding;
  /** يرفع البطاقة عند المرور (يُلغى تلقائيًا مع reduced-motion) */
  hoverable?: boolean;
  as?: "div" | "section" | "article";
};

/** حاوية Design System V1 — ثلاثة أسطح قياسية بلا أي لون مكتوب يدويًا. */
export function DsCard({
  variant = "glass",
  padding = "none",
  hoverable = false,
  as: Tag = "div",
  className,
  children,
  ...rest
}: DsCardProps) {
  return (
    <Tag
      {...rest}
      className={cn(
        "relative overflow-hidden",
        VARIANT_CLASS[variant],
        PADDING_CLASS[padding],
        hoverable &&
          "transition-[background-color,transform] duration-150 hover:-translate-y-0.5 " +
          "hover:bg-[color-mix(in_srgb,var(--ds-surface-3)_86%,var(--ds-accent))] " +
          "motion-reduce:transform-none motion-reduce:transition-none",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
