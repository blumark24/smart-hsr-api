"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { List, Radar } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageGuard from "@/components/ui/PageGuard";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useToast } from "@/contexts/ToastContext";
import { useClients, useEmployees, useTasks } from "@/hooks/useData";
import { useOrgStructure } from "@/hooks/useOrgStructure";
import { useMyWorkContext } from "@/hooks/useMyWorkContext";
import { useTenantCompanyName } from "@/hooks/useTenantCompanyName";
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
  CommandCenterLoading,
  CurrentTaskAllocation,
  TaskCommandCenter,
  isManagerScope,
} from "@/components/tasks/TaskCommandCenter";
import {
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
  const { hasPermission, userRole } = usePermissions();
  const { user } = useAuth();
  const toast = useToast();
  const company = useTenantCompanyName();
  const { context: workContext } = useMyWorkContext();
  const canManageTasks = hasPermission("manage_tasks");
  const managerScope = isManagerScope(userRole);
  const [view, setView] = useState<ViewMode>("kanban");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskFilter>("الكل");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("الكل");
  const [assigneeFilter, setAssigneeFilter] = useState("الكل");
  const [clientFilter, setClientFilter] = useState("الكل");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [smartListOpen, setSmartListOpen] = useState(false);
  const [allocationOpen, setAllocationOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const deletingTaskRef = useRef<string | null>(null);
  const tasksRef = useRef(tasks);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const smartListTriggerRef = useRef<HTMLButtonElement>(null);
  const allocationRef = useRef<HTMLElement>(null);
  tasksRef.current = tasks;
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

  const deleteTaskNow = async (taskId: string): Promise<boolean> => {
    if (deletingTaskRef.current) return false;
    deletingTaskRef.current = taskId;
    setDeletingTaskId(taskId);
    try {
      const deletedTaskId = await remove(taskId);
      if (deletedTaskId !== taskId) {
        throw new Error("تعذر التحقق من هوية المهمة المحذوفة.");
      }
      await refetch();
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      if (tasksRef.current.some((task) => task.id === taskId)) {
        throw new Error("تعذر حذف المهمة: لم تؤكد قاعدة البيانات إزالة السجل");
      }
      setDetailsId((current) => (current === taskId ? null : current));
      toast.success("تم حذف المهمة بنجاح");
      return true;
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "تعذر حذف المهمة");
      console.error("[Task Delete Error]", deleteError);
      return false;
    } finally {
      deletingTaskRef.current = null;
      setDeletingTaskId(null);
    }
  };

  // بطاقات/قوائم المهام: تأكيد سريع عبر المتصفح قبل الحذف.
  const handleDeleteTask = async (taskId: string, title: string): Promise<boolean> => {
    if (!window.confirm(`هل أنت متأكد من حذف "${title}"؟`)) return false;
    return deleteTaskNow(taskId);
  };

  const moveTask = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await update(taskId, { status: newStatus });
    } catch (moveError) {
      toast.error(moveError instanceof Error ? moveError.message : "تعذر تحديث المهمة");
      console.error("[Task Move Error]", moveError);
    }
  };

  // نطاق العرض حسب الدور: المدير يرى مهام المنشأة كاملة، والموظف يرى مهامه فقط.
  // البيانات معزولة أصلًا حسب organization_id عبر RLS؛ هذا التصفية طبقة عرض إضافية للدور.
  const baseTasks = useMemo(
    () => (managerScope ? tasks : tasks.filter((task) => Boolean(user?.id) && task.assigneeId === user?.id)),
    [managerScope, tasks, user?.id],
  );

  const stats = useMemo<TaskStats>(() => ({
    total: baseTasks.length,
    new: baseTasks.filter((task) => task.status === "جديدة").length,
    inProgress: baseTasks.filter((task) => task.status === "قيد_التنفيذ").length,
    review: baseTasks.filter((task) => task.status === "بانتظار_المراجعة").length,
    late: baseTasks.filter((task) => task.status === "متأخرة" || isOverdue(task.dueDate, task.status)).length,
    completed: baseTasks.filter((task) => task.status === "مكتملة").length,
  }), [baseTasks]);

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
    return baseTasks.filter((task) => {
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
  }, [assigneeFilter, baseTasks, clientFilter, priorityFilter, search, statusFilter]);

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

  const openCurrentAllocation = () => {
    setAllocationOpen(true);
    requestAnimationFrame(() => {
      allocationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
      label: "توزيع المهام الحالي",
      note: "ارتباط المهام المحملة بالأقسام",
      icon: <Radar size={14} />,
      onSelect: openCurrentAllocation,
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
    selectedTaskId: detailsId,
    onOpenDetails: openDetails,
    onEdit: openEdit,
    onDelete: handleDeleteTask,
    onStatusChange: (taskId: string, status: TaskStatus) => void moveTask(taskId, status),
  };

  return (
    <DashboardLayout>
      <div
        dir="rtl"
        className="relative isolate -m-premium-3 min-h-full overflow-x-clip bg-ds-bg p-3 pb-[calc(88px+env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))] font-[Tajawal,'IBM_Plex_Sans_Arabic','Segoe_UI',Tahoma,sans-serif] text-ds-text-1 sm:-m-premium-4 sm:p-4 sm:pb-6 lg:-m-premium-6 lg:p-4"
      >
        <div className="mx-auto w-full max-w-[1600px] space-y-2">
          {loading ? (
            <CommandCenterLoading />
          ) : (
            <TaskCommandCenter
              companyName={company.name}
              logoUrl={company.logoUrl}
              sectorLabel={workContext.roleLabel}
              canManage={canManageTasks}
              onAdd={openAdd}
            />
          )}

          <div className={cn(EXECUTIVE_GLASS, "!overflow-visible rounded-ds-md")}>
            <div className="relative z-10 p-2">
              <TaskToolbar
                search={search}
                onSearchChange={setSearch}
                resultCount={filteredTasks.length}
                totalCount={baseTasks.length}
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
            </div>
            <TaskStatusFilterBar
              stats={stats}
              lateFilterCount={baseTasks.filter((task) => task.status === "متأخرة").length}
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
          </div>

          <TaskWorkspaceSection
            view={view}
            loading={loading}
            hasError={Boolean(error)}
            onRetry={() => void refetch()}
            tasksCount={baseTasks.length}
            filteredTasks={filteredTasks}
            onResetFilters={resetFilters}
            onAdd={openAdd}
            {...taskItemHandlers}
          />

          {managerScope ? (
            <CurrentTaskAllocation
              departments={operationalScope.departments}
              unscopedCount={operationalScope.unscoped.length}
              totalLoaded={tasks.length}
              open={allocationOpen}
              onToggle={() => setAllocationOpen((current) => !current)}
              sectionRef={allocationRef}
            />
          ) : null}
        </div>
      </div>

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
        deleting={Boolean(detailsTask && deletingTaskId === detailsTask.id)}
        onClose={() => setDetailsId(null)}
        onEdit={(task) => { setDetailsId(null); openEdit(task); }}
        onDelete={(task) => deleteTaskNow(task.id)}
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
