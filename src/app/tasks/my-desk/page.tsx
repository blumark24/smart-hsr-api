"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  Bell,
  BriefcaseBusiness,
  Building2,
  CheckSquare,
  ChevronLeft,
  FileText,
  Home,
  Landmark,
  LayoutGrid,
  Menu,
  MoreHorizontal,
  Play,
  Search,
  Send,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import PageGuard from "@/components/ui/PageGuard";
import { parseTaskDueDateInRiyadh, TaskWorkspace } from "@/components/tasks/TaskWorkspace";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useToast } from "@/contexts/ToastContext";
import { useTasks } from "@/hooks/useData";
import { useTaskWorkflow } from "@/hooks/useTaskWorkflow";
import { isLegacyOverdue, isTaskOverdue } from "@/lib/tasks/taskStatus";
import type { Task } from "@/types";
import "./twin-desk.css";

function parseDueDate(dueDate: string | undefined) {
  const timestamp = parseTaskDueDateInRiyadh(dueDate);
  return timestamp === null ? null : new Date(timestamp);
}

const riyadhDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Riyadh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const TASK_STATUS_LABELS: Record<string, string> = {
  جديدة: "جديدة",
  new: "جديدة",
  قيد_التنفيذ: "قيد التنفيذ",
  "قيد التنفيذ": "قيد التنفيذ",
  in_progress: "قيد التنفيذ",
  موقوفة: "موقوفة",
  paused: "موقوفة",
  بانتظار_المراجعة: "بانتظار المراجعة",
  "بانتظار المراجعة": "بانتظار المراجعة",
  pending_review: "بانتظار المراجعة",
  طلب_تعديل: "طلب تعديل",
  "طلب تعديل": "طلب تعديل",
  revision_requested: "طلب تعديل",
  مكتملة: "مكتملة",
  completed: "مكتملة",
  ملغاة: "ملغاة",
  cancelled: "ملغاة",
  متأخرة: "متأخرة",
  overdue: "متأخرة",
};

const TASK_PRIORITY_LABELS: Record<string, string> = {
  عاجلة: "عاجلة",
  urgent: "عاجلة",
  عالية: "عالية",
  high: "عالية",
  متوسطة: "متوسطة",
  medium: "متوسطة",
  normal: "متوسطة",
  منخفضة: "منخفضة",
  low: "منخفضة",
};

function taskStatusLabel(status: unknown) {
  const key = String(status ?? "").trim().toLowerCase();
  return TASK_STATUS_LABELS[key] ?? "حالة غير محددة";
}

function taskPriorityLabel(priority: unknown) {
  const key = String(priority ?? "").trim().toLowerCase();
  return TASK_PRIORITY_LABELS[key] ?? "أولوية غير محددة";
}

function daysUntil(dueDate: string | undefined) {
  const target = parseDueDate(dueDate);
  if (!target) return Number.NaN;
  const targetDay = Date.parse(`${riyadhDateFormatter.format(target)}T00:00:00Z`);
  const todayDay = Date.parse(`${riyadhDateFormatter.format(new Date())}T00:00:00Z`);
  return Number.isNaN(targetDay) || Number.isNaN(todayDay) ? Number.NaN : Math.round((targetDay - todayDay) / 86400000);
}

function dueText(task: Task | null) {
  if (!task) return "لا توجد مهمة نشطة";
  if (!task.dueDate?.trim()) return "بلا موعد محدد";
  const diff = daysUntil(task.dueDate);
  if (!Number.isFinite(diff)) return "تاريخ غير صالح";
  const status = task.status as string;
  if (status === "مكتملة" || status === "ملغاة") return status;
  if (diff < 0) return `متأخرة ${Math.abs(diff)} يوم`;
  if (diff === 0) return "تنتهي اليوم";
  if (diff === 1) return "غدًا";
  return `خلال ${diff} يوم`;
}

function formatTaskTime(task: Task) {
  const target = parseDueDate(task.dueDate);
  if (!target) return "--:--";
  return target.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Riyadh" });
}

function statusProgress(status: string | undefined) {
  switch (status) {
    case "مكتملة":
      return 100;
    case "بانتظار_المراجعة":
      return 75;
    case "قيد_التنفيذ":
      return 50;
    case "موقوفة":
      return 35;
    case "طلب_تعديل":
      return 60;
    case "جديدة":
    case "متأخرة":
      return 18;
    default:
      return 0;
  }
}

function workdayLabel() {
  return new Intl.DateTimeFormat("ar-SA", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
}
type DeskPanel = "menu" | "search" | "notifications" | "tasks" | "clients" | "employees" | "organization" | "finance" | "reports" | "assistant" | "settings" | "documents";
type DeskPanelPermission = "manage_tasks" | "manage_clients" | "view_employees" | "manage_tenant_settings" | "manage_finance" | "manage_reports" | "manage_settings";
type TaskInsight = {
  pending: Task[];
  doing: Task[];
  review: Task[];
  dueSoon: Task[];
  late: Task[];
};
const DESK_PANEL_META: Record<DeskPanel, {
  label: string;
  href?: string;
  description: string;
  permission?: DeskPanelPermission;
}> = {
  menu: { label: "قائمة المكتب", description: "تنقل سريع إلى الأقسام المتاحة لحسابك الحالي." },
  search: { label: "البحث داخل المكتب", description: "البحث داخل المكتب غير متاح حاليًا." },
  notifications: { label: "التنبيهات", description: "ملخص مباشر للمهام الشخصية التي تحتاج انتباهك." },
  tasks: {
    label: "المهام",
    href: "/tasks",
    description: "تابع مهامك الحالية وانتقل سريعًا إلى الأولويات والاستحقاقات.",
    permission: "manage_tasks",
  },
  clients: {
    label: "العملاء",
    href: "/clients",
    description: "انتقل إلى مساحة العملاء المتاحة ضمن نطاق عملك.",
    permission: "manage_clients",
  },
  employees: {
    label: "الموظفون",
    href: "/employees",
    description: "افتح دليل الموظفين والفرق المتاحة ضمن نطاقك الإداري.",
    permission: "view_employees",
  },
  organization: {
    label: "الهيكل الإداري",
    href: "/org",
    description: "استعرض هيكل المنشأة وعلاقات الإدارات والفرق.",
    permission: "manage_tenant_settings",
  },
  finance: {
    label: "المالية",
    href: "/finance",
    description: "انتقل إلى مساحة المتابعة المالية المتاحة لحسابك.",
    permission: "manage_finance",
  },
  reports: {
    label: "التقارير",
    href: "/reports",
    description: "افتح مركز التقارير لاستعراض الملخصات المتاحة.",
    permission: "manage_reports",
  },
  assistant: {
    label: "المساعد الذكي",
    href: "/ai",
    description: "ابدأ من المساعد الذكي لدعم عملك اليومي.",
  },
  settings: {
    label: "الإعدادات",
    href: "/settings",
    description: "افتح إعدادات حسابك ومساحة العمل المتاحة لك.",
    permission: "manage_settings",
  },
  documents: {
    label: "المستندات",
    description: "ستظهر المستندات المرتبطة بمهامك هنا عند توفر مصدر بيانات مصرح به.",
  },
};
function panelScope(role: string | undefined, department: string) {
  const normalizedRole = role?.trim().toLowerCase();
  if (normalizedRole === "employee") return "المهام والبيانات الشخصية المسموح بها لحسابك.";
  if (normalizedRole === "manager" || normalizedRole === "department_manager" || normalizedRole === "مدير_قسم") {
    return "فريق " + (department || "إدارتك") + " والمهام الواقعة ضمن نطاقها.";
  }
  if (normalizedRole === "organization_manager" || normalizedRole === "owner" || normalizedRole === "tenant_owner") {
    return "بيانات المنشأة الحالية فقط.";
  }
  if (normalizedRole === "defense_manager" || normalizedRole === "attack_manager" || normalizedRole === "finance_manager") {
    return "النطاق الإداري المرتبط بدور " + (department || "حسابك") + ".";
  }
  return "مساحة العمل المتاحة لحسابك الحالي.";
}

type DeskExperience = {
  variant: "employee" | "department" | "organization" | "owner";
  title: string;
  subtitle: string;
  roleLabel: string;
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "مالك المنصة",
  owner: "مالك المنصة",
  tenant_owner: "مدير المنشأة",
  organization_manager: "مدير المنشأة",
  department_manager: "مدير الإدارة",
  manager: "مدير الإدارة",
  employee: "موظف",
  board_member: "عضو مجلس الإدارة",
  defense_manager: "مدير وكالة الدفاع",
  attack_manager: "مدير وكالة الهجوم",
  finance_manager: "مدير مالي",
};

function getDeskExperience(rawRole: string | undefined, effectiveRole: string | null): DeskExperience {
  const normalized = rawRole?.trim().toLowerCase() ?? "";
  if (normalized === "super_admin" || normalized === "owner") return { variant: "owner", title: "مكتب المالك", subtitle: "مركز قيادة Blumark24 OS", roleLabel: ROLE_LABELS[normalized] };
  if (normalized === "organization_manager" || normalized === "tenant_owner") return { variant: "organization", title: "المكتب التنفيذي", subtitle: "إدارة المنشأة الحالية ضمن صلاحياتك", roleLabel: ROLE_LABELS[normalized] };
  if (normalized === "department_manager" || normalized === "manager") return { variant: "department", title: "مكتب مدير الإدارة", subtitle: "مساحة فريقك ومهام إدارتك", roleLabel: ROLE_LABELS[normalized] };
  const role = effectiveRole ?? normalized;
  return { variant: "employee", title: "مكتبي", subtitle: "مساحة عملك الشخصية", roleLabel: ROLE_LABELS[role] ?? "مستخدم" };
}

function GlassCard({ title, action, children, className }: { title: string; action?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`td-glass-card ${className ?? ""}`}>
      <div className="td-card-head">
        <strong>{title}</strong>
        {action ? <span>{action}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Metric({ value, label }: { value: number | string; label: string }) {
  return (
    <span>
      <strong>{value}</strong>
      <small>{label}</small>
    </span>
  );
}

function EmptyLine({ title, note }: { title: string; note: string }) {
  return (
    <div className="td-empty-line">
      <strong>{title}</strong>
      <small>{note}</small>
    </div>
  );
}

function ExecutiveHeader({ employeeName, department, alertCount, experience, onOpenPanel }: { employeeName: string; department: string; alertCount: number; experience: DeskExperience; onOpenPanel: (panel: DeskPanel, trigger: HTMLElement) => void }) {
  return (
    <header className="td-command">
      <div className="td-title-block">
        <button type="button" className="td-menu-button" aria-label="فتح قائمة المكتب" onClick={(event) => onOpenPanel("menu", event.currentTarget)}><Menu size={18} /></button>
        <span>
          <strong>{experience.title}</strong>
          <small>{experience.subtitle}</small>
        </span>
      </div>

      <div className="td-greeting">
        <strong>صباح الخير، {employeeName}</strong>
        <span>{department || "مساحة عملك الخاصة"}</span>
      </div>

      <div className="td-command-actions">
        <button type="button" className="td-search-pill" aria-label="فتح البحث داخل المكتب" onClick={(event) => onOpenPanel("search", event.currentTarget)}><Search size={15} />البحث داخل المكتب</button>
        <button type="button" className="td-icon-circle" aria-label="فتح تنبيهات المهام الشخصية" onClick={(event) => onOpenPanel("notifications", event.currentTarget)}><Bell size={15} />{alertCount > 0 ? <i>{alertCount}</i> : null}</button>
        <Link href="/tasks" className="td-top-button"><ChevronLeft size={15} />المهام</Link>
      </div>
    </header>
  );
}

function GreetingCard({ employeeName, department }: { employeeName: string; department: string }) {
  return (
    <section className="td-greeting-card">
      <strong>صباح الخير، {employeeName}</strong>
      <span>{workdayLabel()}</span>
      <small>{department || "مساحة عملك الخاصة"}</small>
    </section>
  );
}

function TaskCard({
  pending,
  doing,
  late,
  currentTask,
  taskLoadError,
  onRetryTasks,
  retrying,
  progress,
  startDisabled,
  submitDisabled,
  startBusy,
  submitBusy,
  workflowHint,
  onStart,
  onDone,
}: {
  pending: number;
  doing: number;
  late: number;
  currentTask: Task | null;
  taskLoadError?: boolean;
  onRetryTasks: () => void;
  retrying: boolean;
  progress: number;
  startDisabled: boolean;
  submitDisabled: boolean;
  startBusy: boolean;
  submitBusy: boolean;
  workflowHint?: string;
  onStart: () => void;
  onDone: () => void;
}) {
  return (
    <GlassCard title="مهامي" action="عرض الكل" className="td-task-card">
      <div className="td-task-metrics">
        <Metric value={pending} label="بانتظارك" />
        <Metric value={doing} label="قيد التنفيذ" />
        <Metric value={late} label="متأخرة" />
      </div>
      {taskLoadError ? (
        <div className="td-empty-line" role="alert">
          <strong>{"تعذر تحميل المهام"}</strong>
          <button type="button" onClick={onRetryTasks} disabled={retrying}>
            {retrying ? "جارٍ الإعادة" : "إعادة المحاولة"}
          </button>
        </div>
      ) : currentTask ? (
        <div className="td-current-task">
          <span>الأولوية الحالية</span>
          <strong>{currentTask.title}</strong>
          <small>{dueText(currentTask)}</small>
          <div className="td-task-progress"><i style={{ width: `${progress}%` }} /></div>
          <div className="td-task-actions">
            <button type="button" disabled={startDisabled} aria-disabled={startDisabled} aria-busy={startBusy} title={workflowHint} onClick={onStart}><Play size={13} />{startBusy ? "جارٍ البدء" : "ابدأ"}</button>
            <button type="button" disabled={submitDisabled} aria-disabled={submitDisabled} aria-busy={submitBusy} onClick={onDone}><Send size={13} />{submitBusy ? "جارٍ الإرسال" : "تم"}</button>
          </div>
          {workflowHint ? <small>{workflowHint}</small> : null}
        </div>
      ) : (
        <EmptyLine title="لا توجد مهام شخصية" note="ستظهر هنا المهام المسندة لك فقط." />
      )}
      <Link href="/tasks" className="td-card-link">الانتقال إلى لوحة المهام <ChevronLeft size={15} /></Link>
    </GlassCard>
  );
}

function CalendarCard({ schedule }: { schedule: Task[] }) {
  return (
    <GlassCard title="تقويم اليوم" action="أقرب الاستحقاقات" className="td-calendar-card">
      {schedule.length ? (
        <div className="td-agenda-list">
          {schedule.map((task) => (
            <div className="td-agenda-item" key={task.id}>
              <time>{formatTaskTime(task)}</time>
              <span><strong>{task.title}</strong><small>{dueText(task)}</small></span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyLine title="لا توجد مواعيد مرتبطة بمهامك" note="سيظهر هنا أقرب استحقاق عند وجود مهمة مسندة لك." />
      )}
    </GlassCard>
  );
}

function AnnouncementCard({ alertCount }: { alertCount: number }) {
  return (
    <GlassCard title="الإعلانات" action="متابعة" className="td-announcement-card">
      {alertCount > 0 ? (
        <div className="td-announcement">
          <strong>لديك عناصر تحتاج الانتباه اليوم</strong>
          <p>هناك {alertCount} تنبيه مرتبط بمهامك الشخصية فقط، دون عرض بيانات أي عضو آخر.</p>
        </div>
      ) : (
        <EmptyLine title="لا توجد إعلانات تشغيلية" note="لا توجد تنبيهات مرتبطة بمهامك الآن." />
      )}
    </GlassCard>
  );
}

function QuickPanelButton({ panel, icon, label, tone, onOpen }: { panel: DeskPanel; icon: ReactNode; label: string; tone: "blue" | "gold" | "orange" | "cyan" | "silver" | "slate"; onOpen: (panel: DeskPanel, trigger: HTMLElement) => void }) {
  return <button type="button" className={`td-quick-link ${tone}`} aria-label={label} onClick={(event) => onOpen(panel, event.currentTarget)}><span>{icon}</span><b>{label}</b></button>;
}

function QuickAccessCard({ onOpen }: { onOpen: (panel: DeskPanel, trigger: HTMLElement) => void }) {
  return (
    <GlassCard title="وصول سريع" className="td-quick-card">
      <div className="td-quick-grid">
        <QuickPanelButton panel="tasks" icon={<CheckSquare size={18} />} label="المهام" tone="blue" onOpen={onOpen} />
        <QuickPanelButton panel="clients" icon={<BriefcaseBusiness size={18} />} label="العملاء" tone="cyan" onOpen={onOpen} />
        <QuickPanelButton panel="employees" icon={<Users size={18} />} label="الموظفون" tone="orange" onOpen={onOpen} />
        <QuickPanelButton panel="organization" icon={<Building2 size={18} />} label="الهيكل الإداري" tone="gold" onOpen={onOpen} />
        <QuickPanelButton panel="finance" icon={<Landmark size={18} />} label="المالية" tone="silver" onOpen={onOpen} />
        <QuickPanelButton panel="reports" icon={<FileText size={18} />} label="التقارير" tone="cyan" onOpen={onOpen} />
        <QuickPanelButton panel="assistant" icon={<Sparkles size={18} />} label="المساعد الذكي" tone="blue" onOpen={onOpen} />
        <QuickPanelButton panel="settings" icon={<Settings size={18} />} label="الإعدادات" tone="slate" onOpen={onOpen} />
      </div>
    </GlassCard>
  );
}

function PanelMetrics({ items }: { items: Array<{ label: string; value: number; tone?: "attention" | "active" | "review" }> }) {
  return (
    <div className="td-panel-kpi-grid">
      {items.map((item) => (
        <div key={item.label} className={`td-panel-kpi ${item.tone ?? ""}`}>
          <strong>{item.value}</strong>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function PanelEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="td-panel-empty">
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

function PanelActionLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <Link href={href} className="td-panel-action-link">
      <span>{icon}</span>
      <strong>{label}</strong>
      <ChevronLeft size={15} aria-hidden="true" />
    </Link>
  );
}

function panelIcon(panel: DeskPanel) {
  switch (panel) {
    case "tasks":
      return <CheckSquare size={17} />;
    case "clients":
      return <BriefcaseBusiness size={17} />;
    case "employees":
      return <Users size={17} />;
    case "organization":
      return <Building2 size={17} />;
    case "finance":
      return <Landmark size={17} />;
    case "reports":
      return <FileText size={17} />;
    case "assistant":
      return <Sparkles size={17} />;
    case "settings":
      return <Settings size={17} />;
    case "notifications":
      return <Bell size={17} />;
    default:
      return <LayoutGrid size={17} />;
  }
}

function PanelSwitchButton({ panel, label, onOpen }: { panel: DeskPanel; label: string; onOpen: (panel: DeskPanel, trigger: HTMLElement) => void }) {
  return (
    <button type="button" className="td-panel-switch-button" onClick={(event) => onOpen(panel, event.currentTarget)}>
      <span>{panelIcon(panel)}</span>
      <strong>{label}</strong>
      <ChevronLeft size={15} aria-hidden="true" />
    </button>
  );
}

function TaskPanelList({ tasks }: { tasks: Task[] }) {
  if (!tasks.length) {
    return <PanelEmptyState title="لا توجد مهام ظاهرة" description="ستظهر هنا المهام المسندة إلى حسابك عند توفرها." />;
  }

  return (
    <ul className="td-panel-task-list">
      {tasks.map((task) => (
        <li key={task.id}>
          <div>
            <strong>{task.title}</strong>
            <span>{dueText(task)}</span>
          </div>
          <div className="td-panel-task-meta">
            <span>{taskStatusLabel(task.status)}</span>
            {task.priority ? <b>{taskPriorityLabel(task.priority)}</b> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function SmartPanel({
  panel,
  task,
  tasks,
  taskInsight,
  scope,
  userId,
  userRole,
  workflow,
  onTaskRefresh,
  hasPermission,
  experience,
  notificationCount,
  onOpenPanel,
  dialogRef,
  closeButtonRef,
  onClose,
}: {
  panel: DeskPanel;
  scope: string;
  hasPermission: (permission: DeskPanelPermission) => boolean;
  experience: DeskExperience;
  notificationCount: number;
  tasks: Task[];
  taskInsight: TaskInsight;
  onOpenPanel: (panel: DeskPanel, trigger: HTMLElement) => void;
  dialogRef: RefObject<HTMLElement>;
  closeButtonRef: RefObject<HTMLButtonElement>;
  task: Task | null;
  userId?: string;
  userRole?: string;
  workflow: {
    isBusy: boolean;
    start: (taskId: string) => Promise<void>;
    submitForReview: (taskId: string, note: string) => Promise<void>;
  };
  onTaskRefresh?: () => Promise<unknown>;
  onClose: () => void;
}) {
  const meta = DESK_PANEL_META[panel];
  const allowed = !meta.permission || hasPermission(meta.permission);
  const panelDescriptionId = "my-desk-panel-description";
  const recentTasks = [...tasks]
    .sort((left, right) => {
      const priorityOrder = { عاجلة: 0, عالية: 1, متوسطة: 2, منخفضة: 3 };
      const priorityDiff = priorityOrder[left.priority] - priorityOrder[right.priority];
      return priorityDiff || Date.parse(right.createdAt) - Date.parse(left.createdAt);
    })
    .slice(0, 3);
  const notificationTasks = Array.from(
    new Map(
      [...taskInsight.late, ...taskInsight.dueSoon, ...taskInsight.review].map((item) => [item.id, item]),
    ).values(),
  ).slice(0, 3);
  const availablePanels = (["tasks", "clients", "employees", "organization", "finance", "reports", "assistant", "settings"] as DeskPanel[])
    .filter((item) => {
      const itemMeta = DESK_PANEL_META[item];
      return !itemMeta.permission || hasPermission(itemMeta.permission);
    });
  const suggestedPanels = availablePanels.filter((item) => ["tasks", "clients", "reports", "assistant"].includes(item)).slice(0, 4);

  const renderPanelContent = () => {
    if (!allowed) {
      return <PanelEmptyState title="هذه المساحة غير متاحة" description="يمكنك متابعة الأدوات الظاهرة في قائمة المكتب والعودة إليها في أي وقت." />;
    }

    switch (panel) {
      case "tasks":
        return (
          <>
            <PanelMetrics
              items={[
                { label: "كل المهام", value: tasks.length },
                { label: "جديدة", value: taskInsight.pending.length },
                { label: "قيد التنفيذ", value: taskInsight.doing.length, tone: "active" },
                { label: "بانتظار المراجعة", value: taskInsight.review.length, tone: "review" },
                { label: "متأخرة", value: taskInsight.late.length, tone: "attention" },
              ]}
            />
            <section className="td-panel-section">
              <div className="td-panel-section-head">
                <h3>الأولوية الآن</h3>
                <span>حتى 3 مهام</span>
              </div>
              <TaskPanelList tasks={recentTasks} />
            </section>
            <div className="td-panel-action-grid">
              <PanelActionLink href="/tasks" icon={<CheckSquare size={17} />} label="مهمة جديدة" />
              <PanelActionLink href="/tasks" icon={<LayoutGrid size={17} />} label="عرض كل المهام" />
            </div>
            {task ? (
              <details className="td-panel-task-workspace">
                <summary>إدارة المهمة الحالية</summary>
                <TaskWorkspace task={task} userId={userId} userRole={userRole} workflow={workflow} onTaskRefresh={onTaskRefresh} />
              </details>
            ) : null}
          </>
        );
      case "notifications":
        return (
          <>
            <PanelMetrics
              items={[
                { label: "متأخرة", value: taskInsight.late.length, tone: "attention" },
                { label: "قريبة الاستحقاق", value: taskInsight.dueSoon.length, tone: "active" },
                { label: "بانتظار المراجعة", value: taskInsight.review.length, tone: "review" },
              ]}
            />
            {notificationCount === 0 ? (
              <PanelEmptyState title="لا توجد تنبيهات حالية" description="مهامك لا تحتاج إلى إجراء عاجل الآن." />
            ) : (
              <section className="td-panel-section">
                <div className="td-panel-section-head">
                  <h3>مهام تحتاج انتباهك</h3>
                  <span>{notificationCount} تنبيه</span>
                </div>
                <TaskPanelList tasks={notificationTasks} />
              </section>
            )}
            <div className="td-panel-action-grid">
              <PanelActionLink href="/tasks" icon={<CheckSquare size={17} />} label="فتح المهام" />
            </div>
          </>
        );
      case "menu":
        return (
          <div className="td-panel-switch-grid">
            {availablePanels.map((item) => (
              <PanelSwitchButton key={item} panel={item} label={DESK_PANEL_META[item].label} onOpen={onOpenPanel} />
            ))}
          </div>
        );
      case "search":
        return (
          <>
            <PanelEmptyState title="البحث غير متاح حاليًا" description="استخدم أقسام الوصول السريع للوصول إلى مساحة العمل المطلوبة." />
            <div className="td-panel-switch-grid">
              {suggestedPanels.map((item) => (
                <PanelSwitchButton key={item} panel={item} label={DESK_PANEL_META[item].label} onOpen={onOpenPanel} />
              ))}
            </div>
          </>
        );
      case "clients":
        return (
          <>
            <PanelEmptyState title="ملخص العملاء غير محمّل هنا" description="افتح مساحة العملاء لعرض السجلات المتاحة وتحديثها." />
            <div className="td-panel-action-grid">
              <PanelActionLink href="/clients" icon={<BriefcaseBusiness size={17} />} label="فتح إدارة العملاء" />
            </div>
          </>
        );
      case "employees":
        return (
          <>
            <PanelEmptyState title="دليل الفريق في مساحته المخصصة" description="انتقل إلى الموظفين أو الهيكل الإداري لمتابعة فريقك." />
            <div className="td-panel-action-grid">
              <PanelActionLink href="/employees" icon={<Users size={17} />} label="فتح الموظفين" />
              <PanelActionLink href="/org" icon={<Building2 size={17} />} label="الهيكل الإداري" />
            </div>
          </>
        );
      case "organization":
        return (
          <>
            <PanelEmptyState title="هيكل منشأتك في صفحة واحدة" description="افتح الهيكل الإداري لاستعراض الإدارات والفرق المتاحة." />
            <div className="td-panel-action-grid">
              <PanelActionLink href="/org" icon={<Building2 size={17} />} label="فتح الهيكل الإداري" />
            </div>
          </>
        );
      case "finance":
        return (
          <>
            <PanelEmptyState title="البيانات المالية غير محمّلة هنا" description="انتقل إلى المالية لاستعراض المعلومات المتاحة لحسابك." />
            <div className="td-panel-action-grid">
              <PanelActionLink href="/finance" icon={<Landmark size={17} />} label="فتح المالية" />
            </div>
          </>
        );
      case "reports":
        return (
          <>
            <PanelEmptyState title="التقارير في مركزها المخصص" description="افتح التقارير لاستعراض الملخصات المتوفرة لحسابك." />
            <div className="td-panel-action-grid">
              <PanelActionLink href="/reports" icon={<FileText size={17} />} label="فتح التقارير" />
            </div>
          </>
        );
      case "assistant":
        return (
          <>
            <PanelEmptyState title="مساعدك الذكي جاهز في مساحته" description="استخدم المساعد لصياغة الأفكار وتنظيم العمل من صفحة المساعد." />
            <div className="td-panel-action-grid">
              <PanelActionLink href="/ai" icon={<Sparkles size={17} />} label="فتح المساعد الذكي" />
            </div>
          </>
        );
      case "settings":
        return (
          <>
            <PanelEmptyState title="إعداداتك في مكان واحد" description="انتقل إلى إعدادات مساحة العمل أو حدّث ملفك الشخصي." />
            <div className="td-panel-action-grid">
              <PanelActionLink href="/settings" icon={<Settings size={17} />} label="إعدادات مساحة العمل" />
              <PanelActionLink href="/profile" icon={<Users size={17} />} label="الملف الشخصي" />
            </div>
          </>
        );
      case "documents":
        return <PanelEmptyState title="لا توجد مستندات مرتبطة" description="ستظهر هنا الملفات المرتبطة بمهامك عند توفرها." />;
    }
  };

  return (
    <div
      className="td-panel-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="td-smart-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="my-desk-panel-title"
        aria-describedby={panelDescriptionId}
      >
        <header className="td-smart-panel-head">
          <div>
            <small>My Desk</small>
            <h2 id="my-desk-panel-title">{meta.label}</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="td-smart-panel-close"
            aria-label="إغلاق النافذة"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="td-smart-panel-context" id={panelDescriptionId}>
          <span className="td-smart-panel-role">{experience.roleLabel}</span>
          <p>{scope}</p>
        </div>

        <div className="td-smart-panel-content">
          <p className="td-panel-intro">{meta.description}</p>
          {renderPanelContent()}
        </div>

        <footer className="td-smart-panel-actions">
          {allowed && meta.href ? (
            <Link href={meta.href} className="td-smart-panel-primary" onClick={onClose}>
              فتح {meta.label}
            </Link>
          ) : null}
          <button type="button" className="td-smart-panel-secondary" onClick={onClose}>إغلاق</button>
        </footer>
      </section>
    </div>
  );
}

function DocumentsCard() {
  return (
    <GlassCard title="المستندات" className="td-documents-card">
      <EmptyLine title="لا توجد مستندات مرتبطة بمهامك" note="لن نعرض مستندات وهمية. ستظهر الملفات هنا عند ربطها بمهامك." />
    </GlassCard>
  );
}

function ExecutiveOfficeScene() {
  return (
    <section className="td-office-scene" aria-label="مكتب Blumark24 OS التنفيذي الذكي">
      <div className="td-office-overlay" />
      <div className="td-brand-wall" aria-label="Blumark24 OS">
        <span className="td-brand-mark">B</span>
        <strong>Blumark24 OS</strong>
        <small>مكتب تنفيذي ذكي</small>
      </div>
    </section>
  );
}

function DockMoreMenu({
  open,
  onClose,
  triggerRef,
  items,
}: {
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement>;
  items: DeskPanel[];
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const firstLink = menuRef.current?.querySelector<HTMLAnchorElement>("a");
    firstLink?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  return (
    <>
      <button type="button" className="td-more-backdrop" aria-label="إغلاق قائمة المزيد" onClick={onClose} />
      <div className="td-more-menu" id="my-desk-more-menu" ref={menuRef} role="menu" aria-label="المزيد">
        {items.length ? items.map((item) => {
          const meta = DESK_PANEL_META[item];
          return meta.href ? <Link key={item} href={meta.href} role="menuitem" onClick={onClose}>{meta.label}</Link> : null;
        }) : <p className="td-more-empty">لا توجد أقسام إضافية متاحة.</p>}
      </div>
    </>
  );
}

function BottomTwinNav({ moreItems }: { moreItems: DeskPanel[] }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const closeMoreMenu = () => setMoreOpen(false);

  return (
    <>
      <DockMoreMenu open={moreOpen} onClose={closeMoreMenu} triggerRef={moreTriggerRef} items={moreItems} />
      <nav className="td-bottom-nav" aria-label="تنقل My Desk">
        <Link href="/dashboard"><Home size={16} />الرئيسية</Link>
        <Link href="/tasks"><LayoutGrid size={16} />المهام</Link>
        <Link href="/tasks/my-desk" className="td-nav-logo on" aria-label="مكتبي">B</Link>
        <Link href="/clients"><BriefcaseBusiness size={16} />العملاء</Link>
        <Link href="/reports" className="td-desktop-dock-link"><FileText size={16} />التقارير</Link>
        <Link href="/settings" className="td-desktop-dock-link"><Settings size={16} />الإعدادات</Link>
        <button
          ref={moreTriggerRef}
          type="button"
          className="td-mobile-more-button"
          aria-label="المزيد"
          aria-expanded={moreOpen}
          aria-controls="my-desk-more-menu"
          onClick={() => setMoreOpen((isOpen) => !isOpen)}
        >
          <MoreHorizontal size={16} />المزيد
        </button>
      </nav>
    </>
  );
}

export default function MyTwinDeskPage() {
  const { data: tasks, loading, error: tasksError, refetch: refetchTasks } = useTasks();
  const workflow = useTaskWorkflow();
  const { user } = useAuth();
  const toast = useToast();
  const { hasPermission, userRole: effectiveRole } = usePermissions();
  const [activePanel, setActivePanel] = useState<DeskPanel | null>(null);
  const panelTriggerRef = useRef<HTMLElement | null>(null);
  const panelDialogRef = useRef<HTMLElement>(null);
  const panelCloseButtonRef = useRef<HTMLButtonElement>(null);
  const experience = getDeskExperience(user?.role, effectiveRole);

  const openPanel = (panel: DeskPanel, trigger: HTMLElement) => {
    panelTriggerRef.current = trigger;
    setActivePanel(panel);
  };

  const switchPanel = (panel: DeskPanel) => setActivePanel(panel);
  const closePanel = () => setActivePanel(null);

  useEffect(() => {
    if (!activePanel) {
      const trigger = panelTriggerRef.current;
      if (trigger) requestAnimationFrame(() => trigger.focus());
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = requestAnimationFrame(() => panelCloseButtonRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActivePanel(null);
      if (event.key !== "Tab" || !panelDialogRef.current) return;
      const focusable = Array.from(
        panelDialogRef.current.querySelectorAll<HTMLElement>(
          "a[href], button:not(:disabled), textarea, input:not([type='hidden']):not([hidden]), select, [tabindex]:not([tabindex=\"-1\"])",
        ),
      ).filter((element) => element.tabIndex !== -1 && element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [activePanel]);

  const myTasks = useMemo(
    () => (user?.id ? tasks.filter((task) => task.assigneeId === user.id) : []),
    [tasks, user?.id],
  );

  const insight = useMemo(() => {
    const active = myTasks.filter((task) => !["مكتملة", "ملغاة"].includes(task.status as string));
    const late = active.filter((task) => isTaskOverdue(task) || isLegacyOverdue(task));
    const review = active.filter((task) => task.status === "بانتظار_المراجعة");
    const doing = active.filter((task) => task.status === "قيد_التنفيذ");
    const dueSoon = active.filter((task) => {
      const diff = daysUntil(task.dueDate);
      return Number.isFinite(diff) && diff >= 0 && diff <= 2;
    });
    const pending = active.filter((task) => task.status === "جديدة");
    const currentTask = late[0] ?? active.find((task) => task.priority === "عاجلة" || task.priority === "عالية") ?? dueSoon[0] ?? doing[0] ?? active[0] ?? null;
    return { late, review, doing, dueSoon, pending, currentTask };
  }, [myTasks]);

  const currentTask = insight.currentTask;
  const employeeName = user?.name?.trim() || user?.email?.split("@")[0] || "الموظف";
  const department = user?.department?.trim() || "";
  const progress = statusProgress(currentTask?.status);
  const alertCount = insight.late.length + insight.dueSoon.length + insight.review.length;
  const schedule = [currentTask, ...insight.dueSoon.filter((task) => task.id !== currentTask?.id)].filter(Boolean).slice(0, 3) as Task[];
  const scope = panelScope(user?.role, department);
  const moreItems = (Object.keys(DESK_PANEL_META) as DeskPanel[]).filter((panel) => {
    const meta = DESK_PANEL_META[panel];
    return !["menu", "search", "notifications", "tasks", "clients"].includes(panel) && !!meta.href && (!meta.permission || hasPermission(meta.permission));
  });

  // My Desk is intentionally personal; team management will live in a separate workspace.

  const startWork = async () => {
    if (!currentTask) return;
    try {
      await workflow.start(currentTask.id);
      toast.success("تم بدء العمل على المهمة");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر بدء المهمة");
    }
  };

  const sendDone = async () => {
    if (!currentTask) return;
    if (!window.confirm("هل تريد إرسال المهمة للمراجعة؟ ستتاح ملاحظات المراجعة بعد تفعيل سير العمل الآمن.")) return;
    const note = window.prompt("أضف ملاحظة الإرسال للمراجع");
    if (!note?.trim()) return;
    try {
      await workflow.submitForReview(currentTask.id, note.trim());
      toast.success("تم إرسال العمل للمراجعة");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إرسال المهمة للمراجعة");
    }
  };

  const currentTaskIsLegacyOverdue = !!currentTask && isLegacyOverdue(currentTask);
  const startDisabled = !currentTask || workflow.isBusy || !workflow.capabilities.start || currentTask.status !== "جديدة" || currentTaskIsLegacyOverdue;
  const submitDisabled = !currentTask || workflow.isBusy || !workflow.capabilities.submitForReview || currentTask.status !== "قيد_التنفيذ";
  const workflowHint = currentTaskIsLegacyOverdue ? "تحتاج ترحيل آمن عبر سير العمل الجديد." : undefined;

  return (
    <PageGuard permission="manage_tasks" immersive>
      <main className="twindesk" dir="rtl">
        {loading ? (
          <div className="td-loading"><span className="td-nav-logo">B</span><strong>جاري تحميل مكتبك التنفيذي...</strong></div>
        ) : (
          <section className="td-desk-shell">
            <ExecutiveHeader employeeName={employeeName} department={department} alertCount={alertCount} experience={experience} onOpenPanel={openPanel} />
            <div className="td-office-layout">
              <aside className="td-side-stack td-left-stack">
                <GreetingCard employeeName={employeeName} department={department} />
                <TaskCard
                  pending={insight.pending.length}
                  doing={insight.doing.length}
                  late={insight.late.length}
                  currentTask={currentTask}
                  taskLoadError={Boolean(tasksError)}
                  onRetryTasks={() => void refetchTasks()}
                  retrying={loading}
                  progress={progress}
                  startDisabled={startDisabled}
                  submitDisabled={submitDisabled}
                  startBusy={workflow.isActionPending("start")}
                  submitBusy={workflow.isActionPending("submitForReview")}
                  workflowHint={workflowHint}
                  onStart={startWork}
                  onDone={sendDone}
                />
                <CalendarCard schedule={schedule} />
              </aside>

              <ExecutiveOfficeScene />

              <aside className="td-side-stack td-right-stack">
                <AnnouncementCard alertCount={alertCount} />
                <QuickAccessCard onOpen={openPanel} />
                <DocumentsCard />
              </aside>
            </div>
            <BottomTwinNav moreItems={moreItems} />
            {activePanel ? (
              <SmartPanel
                panel={activePanel}
                scope={scope}
                hasPermission={hasPermission}
                tasks={myTasks}
                taskInsight={insight}
                experience={experience}
                notificationCount={alertCount}
                onOpenPanel={switchPanel}
                task={currentTask}
                userId={user?.id}
                userRole={user?.role}
                workflow={workflow}
                dialogRef={panelDialogRef}
                closeButtonRef={panelCloseButtonRef}
                onTaskRefresh={refetchTasks}
                onClose={closePanel}
              />
            ) : null}
          </section>
        )}
      </main>
    </PageGuard>
  );
}
