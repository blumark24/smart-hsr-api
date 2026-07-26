"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BriefcaseBusiness, List, Plus, Radar } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageGuard from "@/components/ui/PageGuard";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useToast } from "@/contexts/ToastContext";
import { useClients, useEmployees, useTasks } from "@/hooks/useData";
import { useOrgStructure } from "@/hooks/useOrgStructure";
import { cn } from "@/lib/utils";
import { createOrgScopeResolver } from "@/lib/org/orgScopeResolver";
import {
  EXECUTIVE_GLASS,
  isOverdue,
  type PriorityFilter,
  type TaskFilter,
  type TaskStats,
  type ViewMode,
} from "@/components/tasks/TaskCard";
import { TaskWorkspaceSection } from "@/components/tasks/TaskBoard";
import {
  OperationalOverviewModal,
  TaskFiltersModal,
  TaskStatusFilterBar,
  TaskToolbar,
  buildOperationalScope,
  type FilterControlsProps,
  type SmartListItem,
} from "@/components/tasks/TaskFiltersPanel";
import { TaskFormModal, type TaskFormState } from "@/components/tasks/TaskFormModal";
import { TaskDetailsModal } from "@/components/tasks/TaskDetailsModal";
import type { Task, TaskStatus } from "@/types";

function TasksContent() {
  const { data: tasks, loading, error, refetch, insert, update, remove } = useTasks();
  const { data: clients } = useClients();
  const { data: employees } = useEmployees();
  const { data: orgSnapshot } = useOrgStructure(true);
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const toast = useToast();
  const canManageTasks = hasPermission("manage_tasks");
  const [view, setView] = useState<ViewMode>("kanban");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskFilter>("الكل");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("الكل");
  const [assigneeFilter, setAssigneeFilter] = useState("الكل");
  const [clientFilter, setClientFilter] = useState("الكل");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [smartListOpen, setSmartListOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const smartListTriggerRef = useRef<HTMLButtonElement>(null);
  const [form, setForm] = useState<TaskFormState>({
    title: "",
    description: "",
    status: "جديدة",
    priority: "متوسطة",
    assigneeId: "",
    assigneeName: "",
    clientId: "",
    clientName: "",
    dueDate: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setView("list");
  }, []);

  const rememberTrigger = (trigger?: HTMLElement | null) => {
    if (trigger) returnFocusRef.current = trigger;
  };

  const resetForm = () => {
    setForm({
      title: "",
      description: "",
      status: "جديدة",
      priority: "متوسطة",
      assigneeId: "",
      assigneeName: "",
      clientId: "",
      clientName: "",
      dueDate: new Date().toISOString().split("T")[0],
    });
    setEditTask(null);
  };

  const openAdd = (trigger?: HTMLElement | null) => {
    rememberTrigger(trigger);
    resetForm();
    setShowModal(true);
  };

  const openEdit = (task: Task, trigger?: HTMLElement | null) => {
    rememberTrigger(trigger);
    setEditTask(task);
    setForm({
      title: task.title,
      description: task.description ?? "",
      status: task.status,
      priority: task.priority,
      assigneeId: task.assigneeId,
      assigneeName: task.assigneeName,
      clientId: task.clientId ?? "",
      clientName: task.clientName ?? "",
      dueDate: task.dueDate,
    });
    setShowModal(true);
  };

  const openDetails = (taskId: string, trigger?: HTMLElement | null) => {
    rememberTrigger(trigger);
    setDetailsId(taskId);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("عنوان المهمة مطلوب");
      return;
    }
    setSaving(true);
    try {
      const assigneeId = form.assigneeId || user?.id || "";
      const assigneeName = form.assigneeName || user?.email || "";
      const payload = {
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        assigneeId,
        assigneeName,
        clientId: form.clientId || undefined,
        clientName: form.clientName || undefined,
        dueDate: form.dueDate,
      };
      if (editTask) {
        await update(editTask.id, payload);
        toast.success("تم تحديث المهمة بنجاح");
      } else {
        await insert(payload);
        toast.success("تمت إضافة المهمة بنجاح");
      }
      setShowModal(false);
      resetForm();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "تعذر حفظ المهمة");
      console.error("[Task Save Error]", saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async (taskId: string, title: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف "${title}"؟`)) return;
    try {
      await remove(taskId);
      toast.success("تم حذف المهمة بنجاح");
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "تعذر حذف المهمة");
      console.error("[Task Delete Error]", deleteError);
    }
  };

  const moveTask = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await update(taskId, { status: newStatus });
    } catch (moveError) {
      toast.error(moveError instanceof Error ? moveError.message : "تعذر تحديث المهمة");
      console.error("[Task Move Error]", moveError);
    }
  };

  const stats = useMemo<TaskStats>(() => ({
    total: tasks.length,
    new: tasks.filter((task) => task.status === "جديدة").length,
    inProgress: tasks.filter((task) => task.status === "قيد_التنفيذ").length,
    review: tasks.filter((task) => task.status === "بانتظار_المراجعة").length,
    late: tasks.filter((task) => task.status === "متأخرة" || isOverdue(task.dueDate, task.status)).length,
    completed: tasks.filter((task) => task.status === "مكتملة").length,
  }), [tasks]);

  const orgResolver = useMemo(
    () => createOrgScopeResolver(orgSnapshot, employees),
    [orgSnapshot, employees],
  );

  const operationalScope = useMemo(
    () => buildOperationalScope(tasks, orgResolver),
    [orgResolver, tasks],
  );

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ar");
    return tasks.filter((task) => {
      const matchesSearch = !query
        || task.title.toLocaleLowerCase("ar").includes(query)
        || (task.description ?? "").toLocaleLowerCase("ar").includes(query)
        || (task.assigneeName ?? "").toLocaleLowerCase("ar").includes(query)
        || (task.clientName ?? "").toLocaleLowerCase("ar").includes(query)
        || (task.publicCode ?? "").toLocaleLowerCase("ar").includes(query);
      return matchesSearch
        && (statusFilter === "الكل" || task.status === statusFilter)
        && (priorityFilter === "الكل" || task.priority === priorityFilter)
        && (assigneeFilter === "الكل" || task.assigneeId === assigneeFilter)
        && (clientFilter === "الكل" || task.clientId === clientFilter);
    });
  }, [assigneeFilter, clientFilter, priorityFilter, search, statusFilter, tasks]);

  const hasActiveFilters = Boolean(search.trim())
    || statusFilter !== "الكل"
    || priorityFilter !== "الكل"
    || assigneeFilter !== "الكل"
    || clientFilter !== "الكل";
  const activeFilterCount = [
    statusFilter !== "الكل",
    priorityFilter !== "الكل",
    assigneeFilter !== "الكل",
    clientFilter !== "الكل",
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("الكل");
    setPriorityFilter("الكل");
    setAssigneeFilter("الكل");
    setClientFilter("الكل");
  };

  const openMySmartList = () => {
    resetFilters();
    if (user?.id) setAssigneeFilter(user.id);
    setView("list");
  };

  const openAdvancedFilters = (trigger?: HTMLElement | null) => {
    rememberTrigger(trigger ?? smartListTriggerRef.current);
    requestAnimationFrame(() => setFiltersOpen(true));
  };

  const openOperationalOverview = () => {
    rememberTrigger(smartListTriggerRef.current);
    requestAnimationFrame(() => setInsightsOpen(true));
  };

  const smartListItems: SmartListItem[] = [
    {
      id: "smart-list",
      label: "القائمة الذكية",
      note: user?.id ? "مهامك المكلّفة في عرض مركّز" : "عرض مركّز للمهام",
      icon: <List size={14} />,
      active: view === "list" && Boolean(user?.id) && assigneeFilter === user?.id,
      onSelect: openMySmartList,
    },
    {
      id: "insights",
      label: "نظرة تشغيلية",
      note: "ملخص الأحمال والتوزيع الحالي",
      icon: <Radar size={14} />,
      onSelect: openOperationalOverview,
    },
  ];

  const filterControlProps: FilterControlsProps = {
    status: statusFilter,
    priority: priorityFilter,
    assignee: assigneeFilter,
    client: clientFilter,
    employees,
    clients,
    hasActiveFilters,
    onStatusChange: setStatusFilter,
    onPriorityChange: setPriorityFilter,
    onAssigneeChange: setAssigneeFilter,
    onClientChange: setClientFilter,
    onReset: resetFilters,
  };

  const detailsTask = detailsId ? tasks.find((task) => task.id === detailsId) ?? null : null;

  const taskItemHandlers = {
    canManage: canManageTasks,
    onOpenDetails: openDetails,
    onEdit: openEdit,
    onDelete: (taskId: string, title: string) => void handleDeleteTask(taskId, title),
    onStatusChange: (taskId: string, status: TaskStatus) => void moveTask(taskId, status),
  };

  return (
    <DashboardLayout>
      <div
        dir="rtl"
        className="relative isolate -m-premium-3 min-h-full overflow-x-clip bg-[#040c16] p-3 pb-[max(88px,env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))] font-[Tajawal,'IBM_Plex_Sans_Arabic','Segoe_UI',Tahoma,sans-serif] text-[#f6f8fb] sm:-m-premium-4 sm:p-4 sm:pb-6 lg:-m-premium-6 lg:p-5"
      >
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_80%_0%,rgba(20,122,210,0.18),transparent_34%),linear-gradient(180deg,#071525_0%,#040c16_48%,#030a12_100%)]" />
        <div className="mx-auto w-full max-w-[1480px] space-y-3">
          <header className={cn(EXECUTIVE_GLASS, "!overflow-visible p-3 sm:p-4")}>
            <div className="relative z-10 space-y-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 md:grid-cols-[minmax(220px,1fr)_minmax(250px,330px)_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-1 rounded-full bg-[#25bdf2]" aria-hidden="true" />
                    <h1 className="text-xl font-black leading-tight text-white sm:text-2xl">المهام</h1>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-5 text-[#9badbd]">مساحة التنفيذ اليومية لمتابعة العمل بوضوح.</p>
                  <p className="mt-1 hidden text-[10px] font-bold text-[#66cfff] sm:block">
                    {tasks.length} مهمة ضمن نطاقك · {stats.inProgress} قيد التنفيذ · {stats.late} متأخرة
                  </p>
                </div>

                <Link
                  href="/tasks/my-desk"
                  className={cn(
                    "group col-span-2 row-start-2 flex min-h-[72px] items-center gap-3 overflow-hidden rounded-[10px] px-3.5 py-3 md:col-span-1 md:row-start-auto",
                    "bg-[linear-gradient(125deg,#1268cc_0%,#168fd6_58%,#27b9d3_100%)] text-white",
                    "shadow-[0_12px_34px_rgba(24,135,218,0.28),inset_0_1px_0_rgba(255,255,255,0.24)]",
                    "transition-[transform,filter] duration-200 hover:-translate-y-0.5 hover:brightness-110 motion-reduce:transform-none motion-reduce:transition-none",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9eeaff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#081522]",
                  )}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[9px] bg-white/[0.14] shadow-[inset_0_1px_0_rgba(255,255,255,0.20)]">
                    <BriefcaseBusiness size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm font-black">المكتب الذكي</strong>
                    <small className="mt-0.5 block text-[10px] font-bold text-white/75">مساحة عملك اليومية</small>
                  </span>
                  <ArrowLeft size={17} className="shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
                </Link>

                {canManageTasks ? (
                  <button
                    type="button"
                    onClick={(event) => openAdd(event.currentTarget)}
                    aria-label="مهمة جديدة"
                    className="col-start-2 row-start-1 inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-[8px] bg-[#227ee8] px-3 text-xs font-black text-white shadow-[0_8px_20px_rgba(34,126,232,0.24)] transition-[background-color,transform] duration-150 hover:bg-[#3490f2] active:translate-y-px motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8bd5ff] md:col-start-auto md:row-start-auto"
                  >
                    <Plus size={16} />
                    <span className="hidden min-[360px]:inline">مهمة جديدة</span>
                  </button>
                ) : <span />}
              </div>

              <TaskToolbar
                search={search}
                onSearchChange={setSearch}
                activeFilterCount={activeFilterCount}
                onOpenFilters={openAdvancedFilters}
                view={view}
                onViewChange={setView}
                smartListOpen={smartListOpen}
                onSmartListToggle={() => setSmartListOpen((current) => !current)}
                onSmartListClose={() => setSmartListOpen(false)}
                smartListItems={smartListItems}
                smartListTriggerRef={smartListTriggerRef}
              />

              <div className="sm:hidden">
                <span className="text-[10px] font-bold text-[#66cfff]">
                  {tasks.length} مهمة · {stats.inProgress} قيد التنفيذ · {stats.late} متأخرة
                </span>
              </div>
            </div>
          </header>

          <TaskStatusFilterBar
            stats={stats}
            lateFilterCount={tasks.filter((task) => task.status === "متأخرة").length}
            statusFilter={statusFilter}
            priorityFilter={priorityFilter}
            assigneeFilter={assigneeFilter}
            clientFilter={clientFilter}
            search={search}
            employees={employees}
            clients={clients}
            hasActiveFilters={hasActiveFilters}
            onStatusChange={setStatusFilter}
            onPriorityChange={setPriorityFilter}
            onAssigneeChange={setAssigneeFilter}
            onClientChange={setClientFilter}
            onSearchClear={() => setSearch("")}
            onResetAll={resetFilters}
          />

          <TaskWorkspaceSection
            view={view}
            loading={loading}
            hasError={Boolean(error)}
            onRetry={() => void refetch()}
            tasksCount={tasks.length}
            filteredTasks={filteredTasks}
            onResetFilters={resetFilters}
            onAdd={openAdd}
            {...taskItemHandlers}
          />
        </div>
      </div>

      <OperationalOverviewModal
        open={insightsOpen}
        stats={stats}
        operationalScope={operationalScope}
        onClose={() => setInsightsOpen(false)}
        returnFocus={returnFocusRef.current}
      />

      <TaskFiltersModal
        open={filtersOpen}
        activeFilterCount={activeFilterCount}
        controls={filterControlProps}
        onClose={() => setFiltersOpen(false)}
        returnFocus={returnFocusRef.current}
      />

      <TaskDetailsModal
        task={detailsTask}
        canManage={canManageTasks}
        onClose={() => setDetailsId(null)}
        onEdit={(task) => { setDetailsId(null); openEdit(task); }}
        onDelete={(task) => { setDetailsId(null); void handleDeleteTask(task.id, task.title); }}
        returnFocus={returnFocusRef.current}
      />

      <TaskFormModal
        open={showModal}
        editTask={editTask}
        form={form}
        saving={saving}
        employees={employees}
        clients={clients}
        onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
        onClose={() => { setShowModal(false); resetForm(); }}
        onSave={() => void handleSave()}
        returnFocus={returnFocusRef.current}
      />
    </DashboardLayout>
  );
}

export default function TasksPage() {
  return (
    <PageGuard permission="manage_tasks">
      <TasksContent />
    </PageGuard>
  );
}
