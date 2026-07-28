"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  getBoardMembers,
  insertBoardMember,
  updateBoardMember,
  deleteBoardMember,
  logActivity,
  createNotification,
  resolveCurrentOrgId,
} from "@/lib/db";
import { withTimeout, withSoftTimeout } from "@/lib/asyncHelpers";
import type { Client, Task, Transaction, Employee, Project, Activity, StrategyPhase } from "@/types";
import type { BoardMember } from "@/lib/db";
import { ACTIVE_EMPLOYEE_STATUS_VALUES } from "@/lib/tenant/employeeStatus";
import type { DashboardSummary } from "@/lib/services/dashboardSummary";

// Timeout constants (ms)
const DB_WRITE_TIMEOUT  = 12_000; // INSERT/UPDATE/DELETE operations
const DB_READ_TIMEOUT   = 15_000; // SELECT / initial fetch
const REFETCH_TIMEOUT   = 6_000;  // post-write refetch (soft — resolves on expiry)
const DEFAULT_LIST_LIMIT = 50;
const DEFAULT_ACTIVITY_LIMIT = 20;
const DASHBOARD_KPI_READ_LIMIT = 500;

function taskDeletePreviewDiagnosticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname;
  return hostname.endsWith(".vercel.app") && hostname.includes("-git-");
}

export interface DataPageOptions {
  limit?: number;
  page?: number;
}

type SupabaseWriteResult = { data: unknown; error: { message: string } | null };
type CoreTenantTable = "clients" | "tasks" | "transactions" | "employees";

let cachedOrgId: string | null = null;
let cachedOrgUserId: string | null = null;
let cachedOrgIdPromise: Promise<string> | null = null;

function getReadRange(options: DataPageOptions = {}, defaultLimit = DEFAULT_LIST_LIMIT) {
  const limit = Math.max(1, Math.min(options.limit ?? defaultLimit, 500));
  const page = Math.max(0, options.page ?? 0);
  const from = page * limit;
  return { from, to: from + limit - 1, limit };
}

function formatDbWriteError(entityLabel: string, message: string): string {
  const msg = String(message ?? "").trim();
  if (/row-level security|rls policy|42501/i.test(msg)) {
    return `فشل حفظ ${entityLabel} — صلاحيات قاعدة البيانات تمنع هذه العملية. تحقق من صلاحيات حسابك أو تواصل مع الدعم.`;
  }
  if (/invalid input syntax for type date/i.test(msg)) {
    return `فشل حفظ ${entityLabel} — تاريخ غير صالح. اختر تاريخاً صحيحاً.`;
  }
  if (/violates not-null|null value in column/i.test(msg)) {
    return `فشل حفظ ${entityLabel} — حقل مطلوب ناقص في قاعدة البيانات.`;
  }
  return msg || `فشل حفظ ${entityLabel}`;
}

function clearTenantOrgCache() {
  cachedOrgId = null;
  cachedOrgUserId = null;
  cachedOrgIdPromise = null;
}

async function getCurrentSessionUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  return data.session?.user?.id ?? null;
}

async function requireTenantOrgId(): Promise<string> {
  const userId = await getCurrentSessionUserId();
  if (!userId) {
    clearTenantOrgCache();
    throw new Error("تعذر تحديد منشأتك — أعد تسجيل الدخول أو تواصل مع الدعم");
  }

  if (cachedOrgUserId && cachedOrgUserId !== userId) {
    clearTenantOrgCache();
  }

  if (cachedOrgId && cachedOrgUserId === userId) {
    return cachedOrgId;
  }

  if (cachedOrgIdPromise && cachedOrgUserId === userId) {
    return cachedOrgIdPromise;
  }

  cachedOrgUserId = userId;
  const promise = resolveCurrentOrgId()
    .then((orgId) => {
      if (!orgId) {
        clearTenantOrgCache();
        throw new Error("تعذر تحديد منشأتك — أعد تسجيل الدخول أو تواصل مع الدعم");
      }

      cachedOrgId = orgId;
      cachedOrgUserId = userId;
      return orgId;
    })
    .catch((err) => {
      clearTenantOrgCache();
      throw err;
    })
    .finally(() => {
      if (cachedOrgIdPromise === promise) {
        cachedOrgIdPromise = null;
      }
    });

  cachedOrgIdPromise = promise;
  return promise;
}

function subscribeToTenantTable(table: CoreTenantTable, refetch: () => void): () => void {
  let disposed = false;
  let channel: ReturnType<typeof supabase.channel> | null = null;
  let currentOrgId: string | null = null;
  let currentUserId: string | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let subscribePromise: Promise<void> | null = null;

  const clearRetryTimer = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const removeCurrentChannel = () => {
    if (channel) {
      void supabase.removeChannel(channel);
      channel = null;
    }
    currentOrgId = null;
  };

  const ensureSubscribed = async () => {
    if (subscribePromise) return subscribePromise;

    subscribePromise = (async () => {
      try {
        const userId = await getCurrentSessionUserId();
        if (disposed) return;

        if (!userId) {
          clearTenantOrgCache();
          currentUserId = null;
          removeCurrentChannel();
          return;
        }

        if (currentUserId && currentUserId !== userId) {
          clearTenantOrgCache();
          removeCurrentChannel();
        }
        currentUserId = userId;

        const organization_id = await requireTenantOrgId();
        if (disposed) return;

        if (channel && currentOrgId === organization_id) {
          return;
        }

        removeCurrentChannel();
        currentOrgId = organization_id;
        // Defense-in-depth: keep realtime invalidations scoped to the current tenant.
        channel = supabase
          .channel(`${table}-rt:${organization_id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table,
              filter: `organization_id=eq.${organization_id}`,
            },
            () => refetch(),
          )
          .subscribe();
      } catch (err) {
        if (!disposed) {
          console.warn(`[tenant-realtime] ${table} subscription deferred:`, err);
        }
      }
    })().finally(() => {
      subscribePromise = null;
    });

    return subscribePromise;
  };

  const scheduleSubscribe = () => {
    if (disposed) return;
    clearRetryTimer();
    retryTimer = setTimeout(() => {
      void ensureSubscribed();
    }, 0);
  };

  void ensureSubscribed();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    const nextUserId = session?.user?.id ?? null;

    if (event === "SIGNED_OUT" || !nextUserId) {
      clearTenantOrgCache();
      currentUserId = null;
      removeCurrentChannel();
      return;
    }

    if (currentUserId && currentUserId !== nextUserId) {
      clearTenantOrgCache();
      removeCurrentChannel();
    }

    currentUserId = nextUserId;
    if (
      event === "SIGNED_IN" ||
      event === "INITIAL_SESSION" ||
      event === "TOKEN_REFRESHED" ||
      event === "USER_UPDATED"
    ) {
      scheduleSubscribe();
    }
  });

  return () => {
    disposed = true;
    clearRetryTimer();
    removeCurrentChannel();
    subscription.unsubscribe();
  };
}

async function runDbWrite(
  entityLabel: string,
  query: PromiseLike<SupabaseWriteResult>,
  timeoutMessage: string,
): Promise<void> {
  const { error } = await withTimeout(query, DB_WRITE_TIMEOUT, timeoutMessage);
  if (error) throw new Error(formatDbWriteError(entityLabel, error.message));
}

function todayIsoDate(): string {
  return new Date().toISOString().split("T")[0];
}

// ─── camelCase ↔ snake_case mappers ──────────────────────────────────────────

function clientFromDB(row: Record<string, unknown>): Client {
  return {
    id:                 row.id              as string,
    name:               row.name            as string,
    phone:              row.phone           as string,
    businessType:       row.business_type   as string,
    city:               row.city            as string,
    packageType:        row.package_type    as Client["packageType"],
    contractValue:      row.contract_value  as number,
    status:             row.status          as Client["status"],
    accountManagerId:   row.account_manager_id   as string,
    accountManagerName: row.account_manager_name as string,
    notes:              row.notes           as string | undefined,
    createdAt:          (row.created_at     as string) ?? "",
    publicCode:         (row.client_code    as string | undefined) || undefined,
  };
}

function clientToDB(item: Omit<Client, "id" | "createdAt">): Record<string, unknown> {
  return {
    name:                 item.name,
    phone:                item.phone,
    business_type:        item.businessType,
    city:                 item.city,
    package_type:         item.packageType,
    contract_value:       item.contractValue,
    status:               item.status,
    account_manager_id:   item.accountManagerId,
    account_manager_name: item.accountManagerName,
    notes:                item.notes,
  };
}

function clientUpdateToDB(changes: Partial<Client>): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  if (changes.name               !== undefined) map.name                 = changes.name;
  if (changes.phone              !== undefined) map.phone                = changes.phone;
  if (changes.businessType       !== undefined) map.business_type        = changes.businessType;
  if (changes.city               !== undefined) map.city                 = changes.city;
  if (changes.packageType        !== undefined) map.package_type         = changes.packageType;
  if (changes.contractValue      !== undefined) map.contract_value       = changes.contractValue;
  if (changes.status             !== undefined) map.status               = changes.status;
  if (changes.accountManagerId   !== undefined) map.account_manager_id   = changes.accountManagerId;
  if (changes.accountManagerName !== undefined) map.account_manager_name = changes.accountManagerName;
  if (changes.notes              !== undefined) map.notes                = changes.notes;
  return map;
}

function taskFromDB(row: Record<string, unknown>): Task {
  return {
    id:              row.id             as string,
    title:           row.title          as string,
    description:     row.description    as string | undefined,
    status:          row.status         as Task["status"],
    priority:        row.priority       as Task["priority"],
    assigneeId:      row.assignee_id    as string,
    assigneeName:    row.assignee_name  as string,
    assigneeAvatar:  row.assignee_avatar as string | undefined,
    clientId:        row.client_id      as string | undefined,
    clientName:      row.client_name    as string | undefined,
    dueDate:         row.due_date       as string,
    createdAt:       (row.created_at    as string) ?? "",
    tags:            row.tags           as string[] | undefined,
    publicCode:      (row.task_code      as string | undefined) || undefined,
  };
}

function taskToDB(item: Omit<Task, "id" | "createdAt">): Record<string, unknown> {
  return {
    title:           item.title,
    description:     item.description,
    status:          item.status,
    priority:        item.priority,
    assignee_id:     item.assigneeId,
    assignee_name:   item.assigneeName,
    assignee_avatar: item.assigneeAvatar,
    client_id:       item.clientId,
    client_name:     item.clientName,
    due_date:        item.dueDate?.trim() ? item.dueDate : todayIsoDate(),
    tags:            item.tags,
  };
}

function taskUpdateToDB(changes: Partial<Task>): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  if (changes.title          !== undefined) map.title           = changes.title;
  if (changes.description    !== undefined) map.description     = changes.description;
  if (changes.status         !== undefined) map.status          = changes.status;
  if (changes.priority       !== undefined) map.priority        = changes.priority;
  if (changes.assigneeId     !== undefined) map.assignee_id     = changes.assigneeId;
  if (changes.assigneeName   !== undefined) map.assignee_name   = changes.assigneeName;
  if (changes.assigneeAvatar !== undefined) map.assignee_avatar = changes.assigneeAvatar;
  if (changes.clientId       !== undefined) map.client_id       = changes.clientId;
  if (changes.clientName     !== undefined) map.client_name     = changes.clientName;
  if (changes.dueDate        !== undefined) map.due_date        = changes.dueDate;
  if (changes.tags           !== undefined) map.tags            = changes.tags;
  return map;
}

function employeeFromDB(row: Record<string, unknown>): Employee {
  return {
    id:             row.id              as string,
    name:           row.name            as string,
    email:          row.email           as string,
    role:           row.role            as Employee["role"],
    department:     row.department      as string,
    status:         row.status          as Employee["status"],
    joinDate:       row.join_date       as string,
    performance:    row.performance     as number,
    phone:          row.phone           as string | undefined,
    tasks:          row.tasks           as number | undefined,
    completedTasks: row.completed_tasks as number | undefined,
    avatar:         row.avatar          as string | undefined,
    salary:         row.salary          as number | undefined,
    publicCode:     (row.employee_code  as string | undefined) || undefined,
    jobTitle:       (row.job_title       as string | undefined) || undefined,
  };
}

function employeeToDB(item: Omit<Employee, "id">): Record<string, unknown> {
  return {
    name:            item.name,
    email:           item.email,
    role:            item.role,
    department:      item.department,
    status:          item.status,
    join_date:       item.joinDate,
    performance:     item.performance,
    phone:           item.phone,
    tasks:           item.tasks ?? 0,
    completed_tasks: item.completedTasks ?? 0,
    avatar:          item.avatar,
    salary:          item.salary,
  };
}

function employeeUpdateToDB(changes: Partial<Employee>): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  if (changes.name           !== undefined) map.name            = changes.name;
  if (changes.email          !== undefined) map.email           = changes.email;
  if (changes.role           !== undefined) map.role            = changes.role;
  if (changes.department     !== undefined) map.department      = changes.department;
  if (changes.status         !== undefined) map.status          = changes.status;
  if (changes.joinDate       !== undefined) map.join_date       = changes.joinDate;
  if (changes.performance    !== undefined) map.performance     = changes.performance;
  if (changes.phone          !== undefined) map.phone           = changes.phone;
  if (changes.tasks          !== undefined) map.tasks           = changes.tasks;
  if (changes.completedTasks !== undefined) map.completed_tasks = changes.completedTasks;
  if (changes.avatar         !== undefined) map.avatar          = changes.avatar;
  if (changes.salary         !== undefined) map.salary          = changes.salary;
  if (changes.jobTitle       !== undefined) map.job_title       = changes.jobTitle;
  return map;
}

function projectFromDB(row: Record<string, unknown>): Project {
  return {
    id:                  row.id                   as string,
    name:                row.name                 as string,
    clientName:          row.client_name          as string,
    progress:            row.progress             as number,
    budget:              row.budget               as number,
    deadline:            row.deadline             as string,
    status:              row.status               as Project["status"],
    accountManagerName:  row.account_manager_name as string,
  };
}

function activityFromDB(row: Record<string, unknown>): Activity {
  return {
    id:          row.id          as string,
    type:        row.type        as Activity["type"],
    description: row.description as string,
    timestamp:   row.timestamp   as string,
    icon:        row.icon        as string | undefined,
  };
}

// ─── Generic async hook ───────────────────────────────────────────────────────

function useAsyncData<T>(fetcher: () => Promise<T>, fallback: T) {
  const [data, setData]       = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  // Track whether at least one successful fetch has completed.
  // On the very first load we clear to fallback on error so the empty-state UI
  // shows correctly.  On subsequent refetches (e.g. after a write) we keep the
  // existing data so optimistic entries are never wiped by a transient timeout.
  const hasLoaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await withTimeout(fetcher(), DB_READ_TIMEOUT, "انتهت مهلة تحميل البيانات — تحقق من الاتصال");
      setData(result);
      hasLoaded.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ في تحميل البيانات");
      // Only reset to empty fallback on the very first load.
      // On refetch failures, keep existing data so optimistic UI is preserved.
      if (!hasLoaded.current) {
        setData(fallback);
      }
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Refetch only when a new session is established (SIGNED_IN).
  // Firing on every onAuthStateChange event (including TOKEN_REFRESHED,
  // which Supabase emits ~hourly) would cause every active hook to re-query
  // Supabase simultaneously — the root cause of the excessive parallel fetches.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) load();
    });
    return () => subscription.unsubscribe();
  }, [load]);

  return { data, setData, loading, error, refetch: load };
}

// ─── Clients ──────────────────────────────────────────────────────────────────

const CLIENT_COLUMNS = "id, name, phone, business_type, city, package_type, contract_value, status, account_manager_id, account_manager_name, notes, created_at, client_code";
const TASK_COLUMNS = "id, title, description, status, priority, assignee_id, assignee_name, assignee_avatar, client_id, client_name, due_date, created_at, tags, task_code";
const TRANSACTION_COLUMNS = "id, type, amount, description, category, date, funds";
const EMPLOYEE_COLUMNS = "id, name, email, role, department, status, join_date, performance, phone, tasks, completed_tasks, avatar, salary, employee_code, job_title";
const PROJECT_COLUMNS = "id, name, client_name, progress, budget, deadline, status, account_manager_name";
const ACTIVITY_COLUMNS = "id, type, description, timestamp, icon";
const STRATEGY_PHASE_COLUMNS = "id, title, description, progress, budget, start_date, end_date, target_clients, current_clients, goals, status";
const AUTOMATION_COLUMNS = "id, title, enabled, last_run, run_count";
const AUTOMATION_LOG_COLUMNS = "id, rule_id, rule_title, result, status, created_at";

async function fetchClients(options?: DataPageOptions): Promise<Client[]> {
  const { from, to } = getReadRange(options);
  const organization_id = await requireTenantOrgId();
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_COLUMNS)
    .eq("organization_id", organization_id)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(clientFromDB);
}

export function useClients(options?: DataPageOptions) {
  const result = useAsyncData<Client[]>(() => fetchClients(options), []);
  const { setData, refetch } = result;

  useEffect(() => {
    return subscribeToTenantTable("clients", refetch);
  }, [refetch]);

  const insert = useCallback(async (item: Omit<Client, "id" | "createdAt">) => {
    const organization_id = await requireTenantOrgId();
    const { data, error } = await withTimeout(
      supabase
        .from("clients")
        .insert([{ ...clientToDB(item), organization_id }])
        .select("id"),
      DB_WRITE_TIMEOUT,
      "انتهت مهلة إضافة العميل",
    );
    if (error) throw new Error(formatDbWriteError("العميل", error.message));
    if (!data?.length) throw new Error("فشل حفظ العميل — لم يُنشأ أي سجل");
    await withSoftTimeout(refetch(), REFETCH_TIMEOUT);
    void logActivity("client", `تمت إضافة عميل جديد: ${item.name}`, "👤").catch(console.error);
    void createNotification("client_followup", "عميل جديد", `تمت إضافة العميل ${item.name}`, "/clients").catch(console.error);
  }, [refetch]);

  const update = useCallback(async (id: string, changes: Partial<Client>) => {
    const organization_id = await requireTenantOrgId();
    await runDbWrite(
      "العميل",
      supabase
        .from("clients")
        .update(clientUpdateToDB(changes))
        .eq("id", id)
        .eq("organization_id", organization_id),
      "انتهت مهلة تحديث العميل",
    );
    await withSoftTimeout(refetch(), REFETCH_TIMEOUT);
    void logActivity("client", "تم تحديث بيانات العميل", "✏️").catch(console.error);
  }, [refetch]);

  const remove = useCallback(async (id: string) => {
    const organization_id = await requireTenantOrgId();
    await runDbWrite(
      "العميل",
      supabase
        .from("clients")
        .delete()
        .eq("id", id)
        .eq("organization_id", organization_id),
      "انتهت مهلة حذف العميل",
    );
    await withSoftTimeout(refetch(), REFETCH_TIMEOUT);
    void logActivity("client", "تم حذف عميل", "🗑️").catch(console.error);
  }, [refetch]);

  return { ...result, insert, update, remove };
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

async function fetchTasks(options?: DataPageOptions): Promise<Task[]> {
  const { from, to } = getReadRange(options);
  const organization_id = await requireTenantOrgId();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("organization_id", organization_id)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(taskFromDB);
}

export function useTasks(options?: DataPageOptions) {
  const result = useAsyncData<Task[]>(() => fetchTasks(options), []);
  const { refetch } = result;

  useEffect(() => {
    return subscribeToTenantTable("tasks", refetch);
  }, [refetch]);

  const insert = useCallback(async (item: Omit<Task, "id" | "createdAt">) => {
    const organization_id = await requireTenantOrgId();
    const { data, error } = await withTimeout(
      supabase
        .from("tasks")
        .insert([{ ...taskToDB(item), organization_id }])
        .select("id"),
      DB_WRITE_TIMEOUT,
      "انتهت مهلة إضافة المهمة",
    );
    if (error) throw new Error(formatDbWriteError("المهمة", error.message));
    if (!data?.length) throw new Error("فشل حفظ المهمة — لم يُنشأ أي سجل");
    await withSoftTimeout(refetch(), REFETCH_TIMEOUT);
    void logActivity("task", `تمت إضافة مهمة جديدة: ${item.title}`, "✅").catch(console.error);
    void createNotification("task_due", "مهمة جديدة", `تمت إضافة المهمة: ${item.title}`, "/tasks").catch(console.error);
  }, [refetch]);

  const update = useCallback(async (id: string, changes: Partial<Task>) => {
    const organization_id = await requireTenantOrgId();
    const patch = { ...taskUpdateToDB(changes) };
    if (changes.dueDate !== undefined && !String(changes.dueDate).trim()) {
      patch.due_date = todayIsoDate();
    }
    await runDbWrite(
      "المهمة",
      supabase
        .from("tasks")
        .update(patch)
        .eq("id", id)
        .eq("organization_id", organization_id),
      "انتهت مهلة تحديث المهمة",
    );
    await withSoftTimeout(refetch(), REFETCH_TIMEOUT);
    void logActivity("task", `تم تحديث حالة المهمة${changes.status ? `: ${changes.status}` : ""}`, "🔄").catch(console.error);
  }, [refetch]);

  const remove = useCallback(async (id: string) => {
    const organization_id = await requireTenantOrgId();
    const { data, error } = await withTimeout(
      supabase
        .from("tasks")
        .delete()
        .eq("id", id)
        .eq("organization_id", organization_id)
        .select("id"),
      DB_WRITE_TIMEOUT,
      "انتهت مهلة حذف المهمة",
    );

    if (taskDeletePreviewDiagnosticsEnabled()) {
      console.info("[Task Delete Preview]", {
        taskId: id,
        organization_id,
        data: data?.map((row) => ({ id: row.id })) ?? null,
        error: error
          ? {
              code: error.code,
              message: error.message,
              details: error.details,
              hint: error.hint,
            }
          : null,
      });
    }

    if (error) throw new Error(formatDbWriteError("المهمة", error.message));
    if (!data?.length) {
      throw new Error("لم تُحذف المهمة — السجل غير موجود أو لا تملك صلاحية حذفه.");
    }
    if (data.length !== 1 || data[0].id !== id) {
      throw new Error("تعذر التحقق من حذف المهمة بصورة آمنة.");
    }

    await withSoftTimeout(refetch(), REFETCH_TIMEOUT);
    void logActivity("task", "تم حذف مهمة", "🗑️").catch(console.error);
    return data[0].id;
  }, [refetch]);

  return { ...result, insert, update, remove };
}

// ─── Transactions ─────────────────────────────────────────────────────────────

async function fetchTransactions(options?: DataPageOptions): Promise<Transaction[]> {
  const { from, to } = getReadRange(options);
  const organization_id = await requireTenantOrgId();
  const { data, error } = await supabase
    .from("transactions")
    .select(TRANSACTION_COLUMNS)
    .eq("organization_id", organization_id)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);
  return (data ?? []) as Transaction[];
}

export function useTransactions(options?: DataPageOptions) {
  const result = useAsyncData<Transaction[]>(() => fetchTransactions(options), []);
  const { refetch } = result;

  useEffect(() => {
    return subscribeToTenantTable("transactions", refetch);
  }, [refetch]);

  const insert = useCallback(async (item: Omit<Transaction, "id">) => {
    const organization_id = await requireTenantOrgId();
    const { data, error } = await withTimeout(
      supabase
        .from("transactions")
        .insert([{ ...item, organization_id }])
        .select("id"),
      DB_WRITE_TIMEOUT,
      "انتهت مهلة إضافة المعاملة",
    );
    if (error) throw new Error(formatDbWriteError("المعاملة", error.message));
    if (!data?.length) throw new Error("فشل حفظ المعاملة — لم يُنشأ أي سجل");
    await withSoftTimeout(refetch(), REFETCH_TIMEOUT);
    void logActivity(
      "finance",
      `${item.type === "دخل" ? "دخل" : "مصروف"} جديد: ${item.description} (${item.amount} SAR)`,
      item.type === "دخل" ? "💰" : "💸",
    ).catch(console.error);
    void createNotification(
      "invoice_due",
      "معاملة مالية جديدة",
      `${item.type}: ${item.description} — ${item.amount} SAR`,
      "/finance",
    ).catch(console.error);
  }, [refetch]);

  const update = useCallback(async (id: string, changes: Partial<Omit<Transaction, "id">>) => {
    const organization_id = await requireTenantOrgId();
    await runDbWrite(
      "المعاملة",
      supabase
        .from("transactions")
        .update(changes)
        .eq("id", id)
        .eq("organization_id", organization_id),
      "انتهت مهلة تحديث المعاملة",
    );
    await withSoftTimeout(refetch(), REFETCH_TIMEOUT);
    void logActivity("finance", "تم تحديث معاملة مالية", "✏️").catch(console.error);
  }, [refetch]);

  const remove = useCallback(async (id: string) => {
    const organization_id = await requireTenantOrgId();
    await runDbWrite(
      "المعاملة",
      supabase
        .from("transactions")
        .delete()
        .eq("id", id)
        .eq("organization_id", organization_id),
      "انتهت مهلة حذف المعاملة",
    );
    await withSoftTimeout(refetch(), REFETCH_TIMEOUT);
    void logActivity("finance", "تم حذف معاملة مالية", "🗑️").catch(console.error);
  }, [refetch]);

  return { ...result, insert, update, remove };
}

// ─── Employees ────────────────────────────────────────────────────────────────

async function fetchEmployees(options?: DataPageOptions): Promise<Employee[]> {
  const { from, to } = getReadRange(options);
  const organization_id = await requireTenantOrgId();
  const { data, error } = await supabase
    .from("employees")
    .select(EMPLOYEE_COLUMNS)
    .eq("organization_id", organization_id)
    .in("status", [...ACTIVE_EMPLOYEE_STATUS_VALUES])
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(employeeFromDB);
}

export function useEmployees(options?: DataPageOptions) {
  const result = useAsyncData<Employee[]>(() => fetchEmployees(options), []);
  const { refetch } = result;

  useEffect(() => {
    return subscribeToTenantTable("employees", refetch);
  }, [refetch]);

  const insert = useCallback(async (item: Omit<Employee, "id">) => {
    const organization_id = await requireTenantOrgId();
    const { error } = await withTimeout(
      Promise.resolve(supabase.from("employees").insert([{ ...employeeToDB(item), organization_id }])),
      DB_WRITE_TIMEOUT, "انتهت مهلة إضافة الموظف"
    );
    if (error) throw new Error(error.message);
    await withSoftTimeout(refetch(), REFETCH_TIMEOUT);
    logActivity("employee", `تمت إضافة موظف جديد: ${item.name}`, "👥");
  }, [refetch]);

  const update = useCallback(async (id: string, changes: Partial<Employee>) => {
    const organization_id = await requireTenantOrgId();
    const { error } = await withTimeout(
      Promise.resolve(
        supabase
          .from("employees")
          .update(employeeUpdateToDB(changes))
          .eq("id", id)
          .eq("organization_id", organization_id),
      ),
      DB_WRITE_TIMEOUT, "انتهت مهلة تحديث الموظف"
    );
    if (error) throw new Error(error.message);
    await withSoftTimeout(refetch(), REFETCH_TIMEOUT);
    logActivity("employee", "تم تحديث بيانات موظف", "✏️");
  }, [refetch]);

  const remove = useCallback(async (id: string) => {
    const organization_id = await requireTenantOrgId();
    const { error } = await withTimeout(
      Promise.resolve(
        supabase
          .from("employees")
          .delete()
          .eq("id", id)
          .eq("organization_id", organization_id),
      ),
      DB_WRITE_TIMEOUT, "انتهت مهلة حذف الموظف"
    );
    if (error) throw new Error(error.message);
    await withSoftTimeout(refetch(), REFETCH_TIMEOUT);
    logActivity("employee", "تم حذف موظف", "🗑️");
  }, [refetch]);

  return { ...result, insert, update, remove };
}

// ─── Org profile-id set (employee ↔ profile linkage) ──────────────────────────
// Returns the set of profiles.id visible to the caller. The profiles SELECT
// RLS policy is org-scoped (organization_id = current_org_id()), so this set
// contains ONLY profiles inside the caller's own organization. An employee is
// "linked" when employees.id is present here; cross-tenant rows can never leak
// in, and matching is strictly by id (never by email).
async function fetchOrgProfileIds(): Promise<string[]> {
  const { data, error } = await supabase.from("profiles").select("id").eq("is_active", true);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

export function useOrgProfileIds() {
  const { data, loading, error, refetch } = useAsyncData<string[]>(fetchOrgProfileIds, []);
  const ids = useMemo(() => new Set(data), [data]);
  return { ids, loading, error, refetch };
}

// ─── Projects ─────────────────────────────────────────────────────────────────

async function fetchProjects(options?: DataPageOptions): Promise<Project[]> {
  const { from, to } = getReadRange(options);
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .order("deadline", { ascending: true })
    .range(from, to);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(projectFromDB);
}

export function useProjects(options?: DataPageOptions) {
  return useAsyncData<Project[]>(() => fetchProjects(options), []);
}

// ─── Activities ───────────────────────────────────────────────────────────────

async function fetchActivities(options?: DataPageOptions): Promise<Activity[]> {
  const { from, to } = getReadRange(options, DEFAULT_ACTIVITY_LIMIT);
  const { data, error } = await supabase
    .from("activities")
    .select(ACTIVITY_COLUMNS)
    .order("timestamp", { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(activityFromDB);
}

export function useActivities(options?: DataPageOptions) {
  return useAsyncData<Activity[]>(() => fetchActivities(options), []);
}

// ─── Board Members ────────────────────────────────────────────────────────────

export function useBoardMembers(enabled = true) {
  const [data, setData] = useState<BoardMember[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  const load = useCallback(async () => {
    if (!enabled) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await withTimeout(getBoardMembers(), DB_READ_TIMEOUT, "انتهت مهلة تحميل البيانات — تحقق من الاتصال");
      setData(result);
      hasLoaded.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ في تحميل البيانات");
      if (!hasLoaded.current) setData([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!enabled) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) load();
    });
    return () => subscription.unsubscribe();
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled) return;
    const ch = supabase
      .channel("board-members-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "board_members" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [enabled, load]);

  const refetch = load;

  const insert = useCallback(async (item: Omit<BoardMember, "id">) => {
    const newMember = await withTimeout(insertBoardMember(item), DB_WRITE_TIMEOUT, "انتهت مهلة إضافة عضو مجلس الإدارة");
    await withSoftTimeout(refetch(), REFETCH_TIMEOUT);
    logActivity("employee", `تمت إضافة عضو مجلس: ${item.name}`, "🏛️");
    return newMember;
  }, [refetch]);

  const update = useCallback(async (id: string, changes: Partial<Omit<BoardMember, "id">>) => {
    await withTimeout(updateBoardMember(id, changes), DB_WRITE_TIMEOUT, "انتهت مهلة تحديث عضو مجلس الإدارة");
    await withSoftTimeout(refetch(), REFETCH_TIMEOUT);
  }, [refetch]);

  const remove = useCallback(async (id: string) => {
    await withTimeout(deleteBoardMember(id), DB_WRITE_TIMEOUT, "انتهت مهلة حذف عضو مجلس الإدارة");
    await withSoftTimeout(refetch(), REFETCH_TIMEOUT);
  }, [refetch]);

  return { data, setData, loading, error, refetch, insert, update, remove };
}

// ─── Strategy Phases ─────────────────────────────────────────────────────────

function strategyPhaseFromDB(row: Record<string, unknown>): StrategyPhase {
  return {
    id:             row.id              as number,
    title:          row.title           as string,
    description:    row.description     as string,
    progress:       row.progress        as number,
    budget:         row.budget          as number,
    startDate:      row.start_date      as string,
    endDate:        row.end_date        as string,
    targetClients:  row.target_clients  as number,
    currentClients: row.current_clients as number,
    goals:          (row.goals          as string[]) ?? [],
    status:         row.status          as StrategyPhase["status"],
  };
}

function strategyPhaseUpdateToDB(changes: Partial<StrategyPhase>): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  if (changes.title          !== undefined) map.title           = changes.title;
  if (changes.description    !== undefined) map.description     = changes.description;
  if (changes.progress       !== undefined) map.progress        = changes.progress;
  if (changes.budget         !== undefined) map.budget          = changes.budget;
  if (changes.startDate      !== undefined) map.start_date      = changes.startDate;
  if (changes.endDate        !== undefined) map.end_date        = changes.endDate;
  if (changes.targetClients  !== undefined) map.target_clients  = changes.targetClients;
  if (changes.currentClients !== undefined) map.current_clients = changes.currentClients;
  if (changes.goals          !== undefined) map.goals           = changes.goals;
  if (changes.status         !== undefined) map.status          = changes.status;
  map.updated_at = new Date().toISOString();
  return map;
}

async function fetchStrategyPhases(): Promise<StrategyPhase[]> {
  // Try ordering by sort_order; fall back to id if column doesn't exist yet
  const { data, error } = await supabase
    .from("strategy_phases")
    .select(STRATEGY_PHASE_COLUMNS)
    .order("sort_order", { ascending: true });

  if (error) {
    if (error.message.includes("sort_order")) {
      const { data: fallback, error: fallbackError } = await supabase
        .from("strategy_phases")
        .select(STRATEGY_PHASE_COLUMNS)
        .order("id", { ascending: true });
      if (fallbackError) throw new Error(fallbackError.message);
      return ((fallback ?? []) as Record<string, unknown>[]).map(strategyPhaseFromDB);
    }
    throw new Error(error.message);
  }
  return ((data ?? []) as Record<string, unknown>[]).map(strategyPhaseFromDB);
}

export function useStrategyPhases() {
  const result = useAsyncData<StrategyPhase[]>(fetchStrategyPhases, []);
  const { refetch } = result;

  useEffect(() => {
    const ch = supabase
      .channel("strategy-phases-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "strategy_phases" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  const update = useCallback(async (id: number, changes: Partial<StrategyPhase>) => {
    const { error } = await withTimeout(
      Promise.resolve(supabase.from("strategy_phases").update(strategyPhaseUpdateToDB(changes)).eq("id", id)),
      DB_WRITE_TIMEOUT, "انتهت مهلة تحديث المرحلة"
    );
    if (error) throw new Error(error.message);
    await withSoftTimeout(refetch(), REFETCH_TIMEOUT);
  }, [refetch]);

  return { ...result, update };
}

// ─── Dashboard KPI ────────────────────────────────────────────────────────────

export interface DashboardKPI {
  activeClients: number;
  completedTasksPct: number;
  incompleteTasks: number;
  netProfit: number;
  overdueTasks: number;
}

export function useDashboardKPI() {
  const [kpi, setKpi]         = useState<DashboardKPI>({ activeClients: 0, completedTasksPct: 0, incompleteTasks: 0, netProfit: 0, overdueTasks: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const compute = useCallback(async () => {
    try {
      const [clients, tasks, transactions] = await Promise.all([
        fetchClients({ limit: DASHBOARD_KPI_READ_LIMIT }),
        fetchTasks({ limit: DASHBOARD_KPI_READ_LIMIT }),
        fetchTransactions({ limit: DASHBOARD_KPI_READ_LIMIT }),
      ]);

      const today             = new Date();
      today.setHours(0, 0, 0, 0);
      const activeClients     = clients.filter((c) => c.status === "نشط").length;
      const completed         = tasks.filter((t) => t.status === "مكتملة").length;
      const completedTasksPct = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
      const incompleteTasks   = tasks.filter((t) => t.status !== "مكتملة").length;
      // overdue = explicitly labelled متأخرة, OR not complete with a past due-date
      const overdueTasks      = tasks.filter((t) => t.status === "متأخرة" || (t.status !== "مكتملة" && t.dueDate && new Date(t.dueDate) < today)).length;
      const totalIncome       = transactions.filter((t) => t.type === "دخل").reduce((s, t) => s + t.amount, 0);
      const totalExpense      = transactions.filter((t) => t.type === "مصروف").reduce((s, t) => s + t.amount, 0);

      setKpi({ activeClients, completedTasksPct, incompleteTasks, netProfit: totalIncome - totalExpense, overdueTasks });
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ في تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { compute(); }, [compute]);

  useEffect(() => {
    const ch = supabase
      .channel("kpi-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" },      () => compute())
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" },        () => compute())
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => compute())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [compute]);

  return { kpi, loading, error };
}

async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error("لم يتم تسجيل الدخول — يرجى تحديث الصفحة وإعادة المحاولة");
  }

  const response = await fetch("/api/tenant/dashboard-summary", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload?.error === "string" ? payload.error : "تعذر تحميل ملخص لوحة التحكم");
  }
  return payload as DashboardSummary;
}

export function useDashboardSummary() {
  const result = useAsyncData<DashboardSummary | null>(fetchDashboardSummary, null);
  const { refetch } = result;
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const scheduleRefetch = () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => {
        refetchTimer.current = null;
        void refetch();
      }, 750);
    };

    const ch = supabase
      .channel("dashboard-summary-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "employees" }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "activities" }, scheduleRefetch)
      .subscribe();
    return () => {
      if (refetchTimer.current) {
        clearTimeout(refetchTimer.current);
        refetchTimer.current = null;
      }
      supabase.removeChannel(ch);
    };
  }, [refetch]);

  return result;
}

// ─── Automations ──────────────────────────────────────────────────────────────

export interface AutomationRecord {
  id:        string;
  title:     string;
  enabled:   boolean;
  lastRun:   string | null;
  runCount:  number;
}

function automationFromDB(row: Record<string, unknown>): AutomationRecord {
  return {
    id:       row.id       as string,
    title:    row.title    as string,
    enabled:  row.enabled  as boolean,
    lastRun:  row.last_run as string | null,
    runCount: row.run_count as number,
  };
}

async function fetchAutomations(options?: DataPageOptions): Promise<AutomationRecord[]> {
  const { from, to } = getReadRange(options);
  const { data, error } = await supabase
    .from("automations")
    .select(AUTOMATION_COLUMNS)
    .order("id")
    .range(from, to);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(automationFromDB);
}

export function useAutomations(options?: DataPageOptions) {
  const result = useAsyncData<AutomationRecord[]>(() => fetchAutomations(options), []);
  const { refetch } = result;

  useEffect(() => {
    const ch = supabase
      .channel("automations-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "automations" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  const toggle = useCallback(async (id: string, enabled: boolean) => {
    const { error } = await withTimeout(
      Promise.resolve(supabase.from("automations").update({ enabled, updated_at: new Date().toISOString() }).eq("id", id)),
      DB_WRITE_TIMEOUT, "انتهت مهلة تحديث الأتمتة"
    );
    if (error) throw new Error(error.message);
    await withSoftTimeout(refetch(), REFETCH_TIMEOUT);
  }, [refetch]);

  const updateRunStats = useCallback(async (id: string, currentCount: number, logEntry: { rule_title: string; result: string; status: "success" | "warning" | "error" }) => {
    const { error } = await withTimeout(
      Promise.resolve(supabase.from("automations").update({
        last_run: new Date().toISOString(),
        run_count: currentCount + 1,
        updated_at: new Date().toISOString(),
      }).eq("id", id)),
      DB_WRITE_TIMEOUT, "انتهت مهلة تسجيل الأتمتة"
    );
    if (error) throw new Error(error.message);
    // Log entry is fire-and-forget — don't block on it
    supabase.from("automation_logs").insert([{
      rule_id:    id,
      rule_title: logEntry.rule_title,
      result:     logEntry.result,
      status:     logEntry.status,
    }]);
    await withSoftTimeout(refetch(), REFETCH_TIMEOUT);
  }, [refetch]);

  return { ...result, toggle, updateRunStats };
}

// ─── Automation Logs ──────────────────────────────────────────────────────────

export interface AutomationLog {
  id:        string;
  ruleId:    string;
  ruleTitle: string;
  result:    string;
  status:    "success" | "warning" | "error";
  createdAt: string;
}

async function fetchAutomationLogs(options?: DataPageOptions): Promise<AutomationLog[]> {
  const { from, to } = getReadRange(options, 30);
  const { data, error } = await supabase
    .from("automation_logs")
    .select(AUTOMATION_LOG_COLUMNS)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id:        row.id         as string,
    ruleId:    row.rule_id    as string,
    ruleTitle: row.rule_title as string,
    result:    row.result     as string,
    status:    row.status     as "success" | "warning" | "error",
    createdAt: row.created_at as string,
  }));
}

export function useAutomationLogs(options?: DataPageOptions) {
  const result = useAsyncData<AutomationLog[]>(() => fetchAutomationLogs(options), []);
  const { refetch } = result;

  useEffect(() => {
    const ch = supabase
      .channel("auto-logs-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "automation_logs" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  return result;
}
