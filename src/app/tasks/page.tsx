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
  TaskCommandCenter,
  buildTaskIntelligence,
  buildTaskSignals,
  buildTwinSnapshot,
  isManagerScope,
  type OperationalRailItem,
} from "@/components/tasks/TaskCommandCenter";
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

  const intelligence = useMemo(() => buildTaskIntelligence(baseTasks), [baseTasks]);

  const orgResolver = useMemo(
    () => createOrgScopeResolver(orgSnapshot, employees),
    [orgSnapshot, employees],
  );

  const operationalScope = useMemo(
    () => buildOperationalScope(tasks, orgResolver),
    [orgResolver, tasks],
  );

  // لقطة التوأم الرقمي والإشارات التشغيلية — للمدير فقط، ومن بيانات المنشأة الحقيقية.
  const twinSnapshot = useMemo(
    () => buildTwinSnapshot(orgSnapshot, employees, tasks, orgResolver),
    [orgSnapshot, employees, tasks, orgResolver],
  );

  const signals = useMemo(
    () => buildTaskSignals(intelligence, {
      managerScope,
      unscopedTasks: operationalScope.unscoped.length,
      topLoad: operationalScope.topEmployee
        ? { name: operationalScope.topEmployee.name, count: operationalScope.topEmployee.count }
        : null,
    }),
    [intelligence, managerScope, operationalScope],
  );

  const profileChips = useMemo(() => {
    const chips: { label: string; value: string }[] = [];
    if (workContext.orgLink) chips.push({ label: "الجهة", value: workContext.orgLink });
    if (workContext.jobTitle) chips.push({ label: "المسمى", value: workContext.jobTitle });
    if (workContext.directManager) chips.push({ label: "المدير", value: workContext.directManager });
    return chips;
  }, [workContext.orgLink, workContext.jobTitle, workContext.directManager]);

  const operationalItems = useMemo<OperationalRailItem[]>(() => (
    managerScope
      ? [
          { label: "إجمالي المهام", value: intelligence.total },
          { label: "قيد التنفيذ", value: intelligence.inProgress, tone: "info" },
          { label: "بانتظار المراجعة", value: intelligence.review },
          { label: "متأخرة", value: intelligence.late, tone: "danger" },
          { label: "مكتملة", value: intelligence.completed, tone: "success" },
          { label: "صحة العمل", value: intelligence.completionPct !== null ? `${intelligence.completionPct}%` : "—", tone: "info" },
        ]
      : [
          { label: "مهامي", value: intelligence.total },
          { label: "نشطة", value: intelligence.active, tone: "info" },
          { label: "تستحق قريبًا", value: intelligence.dueSoon },
          { label: "متأخرة", value: intelligence.late, tone: "danger" },
          { label: "مكتملة", value: intelligence.completed, tone: "success" },
          { label: "نسبة الإنجاز", value: intelligence.completionPct !== null ? `${intelligence.completionPct}%` : "—", tone: "info" },
        ]
  ), [intelligence, managerScope]);

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
          {loading ? (
            <CommandCenterLoading />
          ) : (
            <TaskCommandCenter
              managerScope={managerScope}
              companyName={company.name}
              logoUrl={company.logoUrl}
              sectorLabel={workContext.roleLabel}
              profileChips={profileChips}
              intelligence={intelligence}
              twinSnapshot={twinSnapshot}
              signals={signals}
              operationalItems={operationalItems}
              canManage={canManageTasks}
              onAdd={openAdd}
            />
          )}

          <div className={cn(EXECUTIVE_GLASS, "!overflow-visible p-2.5 sm:p-3")}>
            <div className="relative z-10">
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
            </div>
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
