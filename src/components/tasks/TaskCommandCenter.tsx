"use client";

import Link from "next/link";
import { useState, type RefObject } from "react";
import {
  Building2,
  ChevronDown,
  Home,
  Layers,
  Loader2,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/contexts/PermissionsContext";

export function isManagerScope(role: UserRole | null): boolean {
  if (!role) return false;
  return role !== "employee";
}

function companyInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("ar");
}

function CompanyLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const [broken, setBroken] = useState(false);
  const initials = companyInitials(name);

  if (logoUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        onError={() => setBroken(true)}
        className="h-9 w-9 shrink-0 rounded-ds-sm border border-ds-border bg-white object-contain p-1"
      />
    );
  }

  return (
    <span
      className="grid h-9 w-9 shrink-0 place-items-center rounded-ds-sm border border-ds-border bg-ds-surface-3 text-ds-teal"
      aria-hidden="true"
    >
      {initials ? <span className="text-ds-heading font-black">{initials}</span> : <Building2 size={17} />}
    </span>
  );
}

export type TaskCommandCenterProps = {
  companyName: string;
  logoUrl: string | null;
  sectorLabel: string | null;
  canManage: boolean;
  onAdd: (trigger: HTMLElement) => void;
};

/** رأس مساحة العمل فقط؛ تبقى المهام أول محتوى تشغيلي بعد أدواتها مباشرة. */
export function TaskCommandCenter({
  companyName,
  logoUrl,
  sectorLabel,
  canManage,
  onAdd,
}: TaskCommandCenterProps) {
  return (
    <header className="flex min-h-[80px] flex-col justify-center gap-3 rounded-ds-lg border border-ds-border-soft bg-ds-surface-1 px-3 py-3 shadow-ds-2 sm:min-h-[84px] sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <CompanyLogo name={companyName} logoUrl={logoUrl} />
        <div className="min-w-0">
          <h1 className="text-ds-display font-black leading-8 text-ds-text-1">المهام</h1>
          <p className="flex min-w-0 items-center gap-2 text-ds-caption text-ds-text-3">
            <span className="truncate font-bold text-ds-text-2">{companyName}</span>
            {sectorLabel ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{sectorLabel}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <Link
          href="/tasks/my-desk"
          className={cn(
            "inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-ds-sm border border-ds-border bg-ds-surface-3 px-3",
            "text-ds-body font-black text-ds-text-1 transition-colors duration-150 motion-reduce:transition-none",
            "hover:border-[color-mix(in_srgb,var(--ds-accent-teal)_38%,var(--ds-border))] hover:bg-[color-mix(in_srgb,var(--ds-surface-3)_88%,var(--ds-accent))]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-teal sm:flex-none",
          )}
        >
          <Home size={16} className="shrink-0 text-ds-teal" aria-hidden="true" />
          <span className="min-w-0">
            <strong className="block truncate">المكتب الذكي</strong>
            <small className="block truncate text-ds-caption font-medium text-ds-text-3">مساحة عملك اليومية</small>
          </span>
        </Link>

        {canManage ? (
          <button
            type="button"
            onClick={(event) => onAdd(event.currentTarget)}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-ds-sm bg-ds-accent px-4 text-ds-body font-black text-white shadow-ds-1 transition-colors duration-150 hover:brightness-110 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-teal"
          >
            <Plus size={16} aria-hidden="true" />
            مهمة جديدة
          </button>
        ) : null}
      </div>
    </header>
  );
}

export type AllocationDepartment = {
  label: string;
  total: number;
  inProgress: number;
  review: number;
  late: number;
};

export type CurrentTaskAllocationProps = {
  departments: AllocationDepartment[];
  unscopedCount: number;
  totalLoaded: number;
  open: boolean;
  onToggle: () => void;
  sectionRef: RefObject<HTMLElement>;
};

/** توزيع حالي للمهام المحملة، لا يمثل انتقالًا زمنيًا أو سعة تشغيلية. */
export function CurrentTaskAllocation({
  departments,
  unscopedCount,
  totalLoaded,
  open,
  onToggle,
  sectionRef,
}: CurrentTaskAllocationProps) {
  const hasData = departments.length > 0;

  return (
    <section
      ref={sectionRef}
      aria-labelledby="current-task-allocation-title"
      className="overflow-hidden rounded-ds-md border border-ds-border-soft bg-ds-surface-1"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="current-task-allocation-content"
        className="flex min-h-12 w-full items-center justify-between gap-3 px-3 text-right transition-colors duration-150 hover:bg-white/[0.035] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ds-teal sm:px-4"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-ds-sm bg-ds-surface-3 text-ds-teal" aria-hidden="true">
            <Layers size={15} />
          </span>
          <span className="min-w-0">
            <strong id="current-task-allocation-title" className="block truncate text-ds-heading font-black text-ds-text-1">
              توزيع المهام الحالي
            </strong>
            <small className="block truncate text-ds-caption text-ds-text-3">
              {hasData ? `${departments.length} أقسام · ${totalLoaded} مهمة محملة` : "ملخص ارتباط المهام بالأقسام"}
            </small>
          </span>
        </span>
        <ChevronDown
          size={17}
          className={cn("shrink-0 text-ds-text-3 transition-transform duration-150 motion-reduce:transition-none", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div id="current-task-allocation-content" className="border-t border-ds-border-soft">
          {hasData ? (
            <>
              <div className="hidden grid-cols-[minmax(180px,1fr)_repeat(4,minmax(72px,auto))] gap-3 border-b border-ds-border-soft px-4 py-2 text-ds-caption font-bold text-ds-text-3 md:grid">
                <span>القسم</span>
                <span>المهام</span>
                <span>قيد التنفيذ</span>
                <span>للمراجعة</span>
                <span>متأخرة</span>
              </div>
              <div className="divide-y divide-ds-border-soft">
                {departments.map((department) => (
                  <div
                    key={department.label}
                    className="grid gap-2 px-3 py-3 md:grid-cols-[minmax(180px,1fr)_repeat(4,minmax(72px,auto))] md:items-center md:gap-3 md:px-4"
                  >
                    <strong className="truncate text-ds-body text-ds-text-1">{department.label}</strong>
                    <div className="grid grid-cols-4 gap-2 text-center md:contents">
                      {[
                        { label: "المهام", value: department.total, tone: "text-ds-text-1" },
                        { label: "قيد التنفيذ", value: department.inProgress, tone: "text-ds-text-2" },
                        { label: "للمراجعة", value: department.review, tone: "text-ds-text-2" },
                        { label: "متأخرة", value: department.late, tone: department.late ? "text-ds-danger" : "text-ds-text-2" },
                      ].map((item) => (
                        <span key={item.label} className={cn("text-ds-caption tabular-nums", item.tone)}>
                          <span className="block font-black">{item.value}</span>
                          <span className="mt-1 block text-[11px] font-normal text-ds-text-3 md:sr-only">{item.label}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {unscopedCount > 0 ? (
                  <div className="flex items-center justify-between gap-3 px-3 py-3 text-ds-body sm:px-4">
                    <span className="text-ds-text-2">مهام غير مرتبطة بقسم</span>
                    <strong className="tabular-nums text-ds-danger">{unscopedCount}</strong>
                  </div>
                ) : null}
              </div>
              <p className="border-t border-ds-border-soft px-3 py-2 text-ds-caption leading-5 text-ds-text-3 sm:px-4">
                الأرقام ضمن المهام المحملة حاليًا وتمثل توزيعها الحالي فقط.
              </p>
            </>
          ) : (
            <p className="px-4 py-6 text-center text-ds-body leading-6 text-ds-text-3">
              لا تتوفر مهام مرتبطة بأقسام كافية لعرض التوزيع الحالي.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

export function CommandCenterLoading() {
  return (
    <header className="flex min-h-[80px] items-center justify-center gap-3 rounded-ds-lg border border-ds-border-soft bg-ds-surface-1 px-4 shadow-ds-2 sm:min-h-[84px]">
      <Loader2 size={18} className="animate-spin text-ds-teal motion-reduce:animate-none" />
      <span className="text-ds-body font-bold text-ds-text-3">جاري تجهيز مساحة المهام…</span>
    </header>
  );
}
