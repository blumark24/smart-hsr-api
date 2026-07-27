"use client";

import { type ReactNode } from "react";
import { AlertTriangle, Inbox, LoaderCircle, Plus, RotateCcw, Search } from "lucide-react";
import type { Task } from "@/types";
import {
  ExecutiveGlass,
  STATUS_COLUMNS,
  TaskCard,
  type TaskItemHandlers,
  type ViewMode,
} from "./TaskCard";
import { TaskListRows } from "./TaskListRows";

/** حالة مساحة العمل (تحميل/فراغ/خطأ/لا نتائج) — منقولة حرفيًا من صفحة /tasks. */
export function WorkspaceState({
  icon,
  title,
  note,
  action,
}: {
  icon: ReactNode;
  title: string;
  note: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center px-5 py-8 text-center">
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-[10px] bg-[#2276e3]/10 text-[#8bbcff]">
        {icon}
      </span>
      <strong className="text-sm font-black text-[#f6f8fb]">{title}</strong>
      <p className="mt-2 max-w-sm text-xs leading-6 text-[#8d9baa]">{note}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** عرض Kanban — أعمدة الحالات الخمسة بتمرير أفقي snap، بنفس المخرجات السابقة. */
export function TaskBoard({
  tasks,
  canManage,
  onOpenDetails,
  onEdit,
  onDelete,
  onStatusChange,
}: { tasks: Task[] } & TaskItemHandlers) {
  return (
    <div className="snap-x snap-mandatory scroll-px-2 overflow-x-auto overscroll-x-contain p-2 sm:p-3 lg:overflow-x-visible">
      <div className="flex min-w-max items-stretch gap-2 lg:min-h-[52vh] lg:min-w-0">
        {STATUS_COLUMNS.map((column) => {
          const columnTasks = tasks.filter((task) => task.status === column.key);
          return (
            <section key={column.key} className="w-[272px] shrink-0 snap-start rounded-[9px] bg-[#07111b]/62 p-2 sm:w-[264px] lg:w-auto lg:min-w-0 lg:flex-1">
              <header className="mb-2 flex min-h-9 items-center justify-between gap-2 px-1">
                <span className="flex items-center gap-2 text-[11px] font-bold text-[#d7dee6]">
                  <i className="h-2 w-2 rounded-full" style={{ backgroundColor: column.color }} />
                  {column.label}
                </span>
                <span className="text-[10px] tabular-nums text-[#718090]">{columnTasks.length}</span>
              </header>
              <div className="space-y-2">
                {columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    canManage={canManage}
                    onOpenDetails={onOpenDetails}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onStatusChange={onStatusChange}
                  />
                ))}
                {!columnTasks.length ? (
                  <div className="flex min-h-20 items-center justify-center rounded-[8px] border border-dashed border-white/[0.08] px-3 text-center text-[10px] text-[#718090]">
                    لا توجد مهام في هذه المرحلة
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export type TaskWorkspaceSectionProps = {
  view: ViewMode;
  loading: boolean;
  hasError: boolean;
  onRetry: () => void;
  tasksCount: number;
  filteredTasks: Task[];
  onResetFilters: () => void;
  onAdd: (trigger: HTMLElement) => void;
} & TaskItemHandlers;

/**
 * قسم مساحة العمل كاملًا: الغلاف الزجاجي + شريط العنوان + الحالات الأربع
 * (تحميل/خطأ/فارغ/لا نتائج) + عرض Kanban أو القائمة — منقول حرفيًا من الصفحة،
 * والعرضان يُرسمان هنا مرة واحدة فقط.
 */
export function TaskWorkspaceSection({
  view,
  loading,
  hasError,
  onRetry,
  tasksCount,
  filteredTasks,
  onResetFilters,
  onAdd,
  canManage,
  onOpenDetails,
  onEdit,
  onDelete,
  onStatusChange,
}: TaskWorkspaceSectionProps) {
  return (
    <ExecutiveGlass>
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-white/[0.08] px-3 py-2.5 sm:px-4">
        <div>
          <strong className="block text-xs font-black text-[#f6f8fb]">{view === "kanban" ? "تدفق العمل" : "قائمة المهام"}</strong>
          <span className="text-[10px] text-[#718090]">{filteredTasks.length} من {tasksCount} مهمة</span>
        </div>
        <span className="text-[10px] text-[#8d9baa]">{view === "kanban" ? "Kanban" : "قائمة"}</span>
      </div>

      {loading ? (
        <WorkspaceState icon={<LoaderCircle size={22} className="animate-spin" />} title="جاري تحميل المهام" note="يتم تجهيز مساحة العمل الحالية." />
      ) : hasError ? (
        <WorkspaceState
          icon={<AlertTriangle size={22} />}
          title="تعذر تحميل المهام"
          note="تحقق من الاتصال ثم أعد المحاولة."
          action={<button type="button" onClick={onRetry} className="inline-flex min-h-11 items-center gap-2 rounded-[7px] border border-white/[0.10] bg-white/[0.045] px-3 text-[11px] font-bold text-[#e4e9ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]"><RotateCcw size={13} />إعادة المحاولة</button>}
        />
      ) : tasksCount === 0 ? (
        <WorkspaceState
          icon={<Inbox size={22} />}
          title="لا توجد مهام بعد"
          note="ابدأ بإنشاء مهمة لتنظيم العمل ومتابعته."
          action={canManage ? (
            <button
              type="button"
              onClick={(event) => onAdd(event.currentTarget)}
              className="inline-flex min-h-11 items-center gap-2 rounded-[8px] bg-[#227ee8] px-4 text-[11px] font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8bd5ff]"
            >
              <Plus size={14} />
              مهمة جديدة
            </button>
          ) : undefined}
        />
      ) : filteredTasks.length === 0 ? (
        <WorkspaceState
          icon={<Search size={22} />}
          title="لا توجد نتائج مطابقة"
          note="غيّر البحث أو المرشحات لعرض مهام أخرى."
          action={<button type="button" onClick={onResetFilters} className="inline-flex min-h-11 items-center gap-2 rounded-[7px] border border-white/[0.10] bg-white/[0.045] px-3 text-[11px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6aa8ff]"><RotateCcw size={13} />إعادة الضبط</button>}
        />
      ) : view === "kanban" ? (
        <TaskBoard
          tasks={filteredTasks}
          canManage={canManage}
          onOpenDetails={onOpenDetails}
          onEdit={onEdit}
          onDelete={onDelete}
          onStatusChange={onStatusChange}
        />
      ) : (
        <TaskListRows
          tasks={filteredTasks}
          canManage={canManage}
          onOpenDetails={onOpenDetails}
          onEdit={onEdit}
          onDelete={onDelete}
          onStatusChange={onStatusChange}
        />
      )}
    </ExecutiveGlass>
  );
}
