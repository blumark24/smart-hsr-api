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
    <div className="flex min-h-[220px] h-full flex-col items-center justify-center px-5 py-8 text-center">
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-ds-md bg-ds-accent/10 text-ds-teal">
        {icon}
      </span>
      <strong className="text-ds-heading font-black text-ds-text-1">{title}</strong>
      <p className="mt-2 max-w-sm text-ds-body leading-6 text-ds-text-3">{note}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function TaskBoard({
  tasks,
  canManage,
  selectedTaskId,
  onOpenDetails,
  onEdit,
  onDelete,
  onStatusChange,
}: { tasks: Task[] } & TaskItemHandlers) {
  return (
    <div className="h-full snap-x snap-mandatory scroll-px-2 overflow-x-auto overscroll-x-contain [scrollbar-color:var(--ds-border)_transparent]">
      <div className="flex h-full min-w-max items-stretch gap-2 p-2 sm:gap-3 sm:p-3">
        {STATUS_COLUMNS.map((column) => {
          const columnTasks = tasks.filter((task) => task.status === column.key);
          return (
            <section
              key={column.key}
              aria-labelledby={`task-column-${column.key}`}
              className="flex w-[272px] shrink-0 snap-start flex-col overflow-hidden rounded-ds-md border border-ds-border-soft bg-ds-surface-2/60 sm:w-[280px] xl:w-[288px] 2xl:min-w-[280px] 2xl:flex-1"
            >
              <header className="sticky top-0 z-10 flex min-h-11 shrink-0 items-center justify-between gap-2 border-b border-ds-border-soft bg-ds-surface-2 px-3">
                <span id={`task-column-${column.key}`} className="flex min-w-0 items-center gap-2 text-ds-caption font-bold text-ds-text-1">
                  <i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: column.color }} aria-hidden="true" />
                  <span className="truncate">{column.label}</span>
                </span>
                <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-ds-caption tabular-nums text-ds-text-3">
                  {columnTasks.length}
                </span>
              </header>

              <div className="min-h-0 flex-1 space-y-2 p-2 lg:overflow-y-auto lg:overscroll-contain">
                {columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    canManage={canManage}
                    selectedTaskId={selectedTaskId}
                    onOpenDetails={onOpenDetails}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onStatusChange={onStatusChange}
                  />
                ))}
                {!columnTasks.length ? (
                  <div className="flex min-h-16 items-center justify-center border-t border-dashed border-ds-border-soft px-3 text-center text-ds-caption text-ds-text-3">
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
  selectedTaskId,
  onOpenDetails,
  onEdit,
  onDelete,
  onStatusChange,
}: TaskWorkspaceSectionProps) {
  const handlers = {
    canManage,
    selectedTaskId,
    onOpenDetails,
    onEdit,
    onDelete,
    onStatusChange,
  };

  return (
    <ExecutiveGlass className="border border-ds-border-soft lg:h-[calc(100svh-220px)] lg:min-h-[480px] lg:max-h-[820px]">
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-ds-border-soft px-3 sm:px-4">
        <div className="min-w-0">
          <strong className="block text-ds-body font-black text-ds-text-1">
            {view === "kanban" ? "لوحة المهام" : "قائمة المهام"}
          </strong>
          <span className="block truncate text-ds-caption text-ds-text-3">
            {filteredTasks.length} من {tasksCount} مهمة محملة
          </span>
        </div>
        <span className="text-ds-caption font-bold text-ds-text-3">
          {view === "kanban" ? "Kanban" : "List"}
        </span>
      </div>

      <div className="lg:h-[calc(100%-44px)] lg:overflow-hidden">
        {loading ? (
          <WorkspaceState icon={<LoaderCircle size={22} className="animate-spin motion-reduce:animate-none" />} title="جاري تحميل المهام" note="يتم تجهيز مساحة العمل الحالية." />
        ) : hasError ? (
          <WorkspaceState
            icon={<AlertTriangle size={22} />}
            title="تعذر تحميل المهام"
            note="تحقق من الاتصال ثم أعد المحاولة."
            action={<button type="button" onClick={onRetry} className="inline-flex min-h-11 items-center gap-2 rounded-ds-sm border border-ds-border bg-white/[0.045] px-3 text-ds-caption font-bold text-ds-text-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-teal"><RotateCcw size={13} />إعادة المحاولة</button>}
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
                className="inline-flex min-h-11 items-center gap-2 rounded-ds-sm bg-ds-accent px-4 text-ds-caption font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-teal"
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
            action={<button type="button" onClick={onResetFilters} className="inline-flex min-h-11 items-center gap-2 rounded-ds-sm border border-ds-border bg-white/[0.045] px-3 text-ds-caption font-bold text-ds-text-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-teal"><RotateCcw size={13} />إعادة الضبط</button>}
          />
        ) : view === "kanban" ? (
          <TaskBoard tasks={filteredTasks} {...handlers} />
        ) : (
          <div className="h-full overflow-y-auto overscroll-contain">
            <TaskListRows tasks={filteredTasks} {...handlers} />
          </div>
        )}
      </div>
    </ExecutiveGlass>
  );
}
