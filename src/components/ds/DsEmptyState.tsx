import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DsEmptyStateTone = "neutral" | "danger";

const ICON_TONE_CLASS: Record<DsEmptyStateTone, string> = {
  neutral:
    "bg-[color-mix(in_srgb,var(--ds-accent-teal)_10%,transparent)] " +
    "text-[color-mix(in_srgb,var(--ds-accent-teal)_75%,var(--ds-text-1))]",
  danger:
    "bg-[color-mix(in_srgb,var(--ds-danger)_10%,transparent)] text-ds-danger",
};

export type DsEmptyStateProps = {
  icon: ReactNode;
  title: string;
  /** سطر توضيحي صادق — يُمنع عرض أرقام أو نشاط غير حقيقي */
  note: string;
  /** زر إجراء اختياري (يظهر حسب الصلاحية لدى المستدعي) */
  action?: ReactNode;
  tone?: DsEmptyStateTone;
  className?: string;
};

/**
 * حالة فراغ/خطأ Design System V1 — قالب موحّد للحالات الثلاث
 * (فارغ، خطأ، لا نتائج) مع أيقونة وعنوان وسطر واحد وإجراء اختياري.
 */
export function DsEmptyState({ icon, title, note, action, tone = "neutral", className }: DsEmptyStateProps) {
  return (
    <div className={cn("flex min-h-[220px] flex-col items-center justify-center px-5 py-8 text-center", className)}>
      <span className={cn("mb-4 grid h-12 w-12 place-items-center rounded-ds-md", ICON_TONE_CLASS[tone])}>
        {icon}
      </span>
      <strong className="text-ds-heading font-black text-ds-text-1">{title}</strong>
      <p className="mt-2 max-w-sm text-ds-body leading-6 text-ds-text-3">{note}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
