// Owner dashboard data fetching — runs client-side with anon key + RLS.
// RLS is_owner() guards all four tables; non-owners get empty results.

// PR5-D: owner queries run against the isolated owner auth client so the
// JWT they send is the owner session, never the customer session.
import { ownerSupabase as supabase } from "@/lib/supabase/ownerClient";
import {
  canCancelSubscription,
  canChangePlan,
  canSuspendSubscription,
  LIVE_SUBSCRIPTION_STATUSES,
} from "@/lib/billing/lifecycle";
import {
  assessTenantLifecycle,
  evaluateTenantLifecycleAction,
  summarizeTenantLifecycleAssessment,
} from "@/lib/owner/tenantLifecycleGuard";
import type { Accent } from "../_data";
import {
  computeMrr,
  fetchCustomerStaffCount,
  type OwnerKpiValue,
} from "./ownerTruthQueries";
import {
  classifySubscriptionLifecycle,
  SUBSCRIPTION_LIFECYCLE_LABEL_AR,
  type SubscriptionLifecycleClass,
} from "./ownerSubscriptionReconciliation";

// ─── Raw DB row types ────────────────────────────────────────────────────────

export interface DbPlan {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  sort_order: number;
}

export interface DbPlanLimit {
  plan_id: string;
  limit_key: string;
  limit_value: number;
}

export interface DbPlanFull {
  id: string;
  name: string;
  slug: string;
  price_monthly: number | null;
  price_annual: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface DbOrganization {
  id: string;
  name: string;
  slug: string | null;
  // PR5-B: customer_code is the pre-migration-014 legacy column. Production
  // has only organization_code, so we no longer SELECT customer_code anywhere
  // in src/app/owner. Kept optional on the type so any consumer reading from
  // a backup / older snapshot still type-checks, but no query references it.
  customer_code?: string | null;
  organization_code: string | null;
  owner_email: string | null;
  plan_id: string | null;
  status: "active" | "suspended" | "trial" | "cancelled";
  notes: string | null;
  is_internal: boolean;
  deleted_at: string | null;
  created_at: string;
}

export interface DbSubscription {
  id: string;
  organization_id: string;
  plan_id: string;
  status: "active" | "trialing" | "past_due" | "cancelled" | "suspended";
  billing_cycle: "monthly" | "annual" | "internal";
  started_at: string;
  ends_at: string | null;
}

// ─── Normalized display types ────────────────────────────────────────────────

export interface DisplayOrg {
  id: string;
  name: string;
  planName: string;
  planSlug: string;
  statusAr: "نشطة" | "معلقة";
  isInternal: boolean;
}

export interface DisplayPlan {
  id: string;
  name: string;
  slug: string;
  accent: Accent;
  badge: string;
  featured: boolean;
  audience: string;
  limits: string[];
}

export interface DisplaySubscription {
  id: string;
  statusAr: string;
  isActive: boolean;
  billingCycleAr: string;
  planName: string;
  startedAt: string;
}

export interface PlanLimitsValues {
  maxEmployees: number | null;
  maxAgencies: number | null;
  maxDepartments: number | null;
  maxSections: number | null;
  aiLevel: number | null;
  whatsappEnabled: number | null;
}

export interface DisplayPlanFull {
  id: string;
  name: string;
  slug: string;
  accent: Accent;
  priceMonthly: number | null;
  priceAnnual: number | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  limits: PlanLimitsValues;
}

export interface DisplayOrgFull {
  id: string;
  name: string;
  slug: string | null;
  customerCode: string | null;
  ownerEmail: string | null;
  isInternal: boolean;
  statusRaw: DbOrganization["status"];
  statusAr: string;
  planId: string | null;
  planName: string;
  planSlug: string;
  hasSubscription: boolean;
  subStatusAr: string;
  subIsActive: boolean;
  subBillingCycleAr: string;
  hasClientLogin: boolean;
  createdAt: string;
}

export interface DisplaySubscriptionFull {
  id: string;
  organizationId: string;
  orgName: string;
  orgSlug: string | null;
  isInternal: boolean;
  // Phase 4C-2 — organization lifecycle data on the owner subscription
  // read model, so archived / internal / orphaned subscriptions are
  // classified instead of silently counting as customer subscriptions.
  orgDeletedAt: string | null;
  orgStatusRaw: DbOrganization["status"] | null;
  lifecycle: SubscriptionLifecycleClass;
  lifecycleLabelAr: string;
  planId: string;
  planName: string;
  planSlug: string;
  accent: Accent;
  statusRaw: DbSubscription["status"];
  statusAr: string;
  isActive: boolean;
  billingCycleRaw: DbSubscription["billing_cycle"];
  billingCycleAr: string;
  startedAt: string;
  endsAt: string | null;
  createdAt: string;
}

export interface OwnerDashboardData {
  organizations: DisplayOrg[];
  plans: DisplayPlan[];
  activeOrgCount: number;
  mrr: OwnerKpiValue;
  staffCount: OwnerKpiValue;
  internalOrg: DisplayOrg | null;
  internalPlanLimits: Record<string, number>;
  internalSubscription: DisplaySubscription | null;
}

// ─── Static metadata maps (plan config, not from DB) ────────────────────────

const SLUG_ACCENT: Record<string, Accent> = {
  basic: "cyan",
  growth: "blue",
  advanced: "purple",
};

const SLUG_BADGE: Record<string, string> = {
  basic: "Starter",
  growth: "Most Popular",
  advanced: "Enterprise",
};

const SLUG_FEATURED: Record<string, boolean> = {
  basic: false,
  growth: true,
  advanced: false,
};

const SLUG_AUDIENCE: Record<string, string> = {
  basic: "للشركات الناشئة والفرق الصغيرة",
  growth: "للشركات المتوسطة في مرحلة التوسع",
  advanced: "للمؤسسات الكبيرة والعمليات المعقّدة",
};

// ─── Normalization helpers ───────────────────────────────────────────────────

/** DB-FOUNDATION-5 organization_code. PR5-B: the legacy customer_code
 * fallback is removed because production hasn't applied migration 014 — the
 * column doesn't exist and SELECTing it 42703s the whole orgs query. Once 014
 * lands, the fallback can be restored here without touching call sites. */
export function resolveOrganizationPublicCode(org: {
  organization_code?: string | null;
}): string | null {
  const orgCode = org.organization_code?.trim();
  return orgCode || null;
}

function limitsToStrings(limits: Record<string, number>, slug: string): string[] {
  const e = limits["max_employees"] ?? 0;
  const ag = limits["max_agencies"] ?? 0;
  const dep = limits["max_departments"] ?? 0;
  const sec = limits["max_sections"] ?? 0;
  const ai = limits["ai_level"] ?? 0;
  const wa = limits["whatsapp_enabled"] ?? 0;

  const result: string[] = [];

  if (slug === "advanced") {
    result.push(`حتى +${e} موظف`);
    result.push("وكالات متعددة");
    result.push("إدارات متعددة");
    result.push("أقسام متعددة");
  } else {
    result.push(`حتى ${e} موظف`);
    result.push(ag === 0 ? "0 وكالة" : ag === 1 ? "وكالة واحدة كحد أقصى" : `حتى ${ag} وكالات`);
    result.push(dep === 1 ? "إدارة واحدة كحد أقصى" : `حتى ${dep} إدارات`);
    result.push(`حتى ${sec} قسم`);
  }

  if (ai === 1) result.push("ذكاء اصطناعي محدود");
  else if (ai === 2) result.push("ذكاء اصطناعي متوسط");
  else if (ai >= 3) result.push("ذكاء اصطناعي كامل");

  if (wa === 1) result.push("WhatsApp Bot مفعّل");
  if (slug === "advanced") result.push("تقارير متقدمة");

  return result;
}

function normalizeOrg(org: DbOrganization, plans: DbPlan[]): DisplayOrg {
  const plan = plans.find((p) => p.id === org.plan_id);
  const status = org.status === "active" || org.status === "trial" ? "نشطة" : "معلقة";
  return {
    id: org.id,
    name: org.name,
    planName: plan?.name ?? "—",
    planSlug: plan?.slug ?? "",
    statusAr: status,
    isInternal: org.is_internal === true,
  };
}

function normalizePlan(plan: DbPlan, allLimits: DbPlanLimit[]): DisplayPlan {
  const limitMap: Record<string, number> = {};
  allLimits
    .filter((l) => l.plan_id === plan.id)
    .forEach((l) => {
      limitMap[l.limit_key] = l.limit_value;
    });

  return {
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    accent: SLUG_ACCENT[plan.slug] ?? "cyan",
    badge: SLUG_BADGE[plan.slug] ?? plan.slug,
    featured: SLUG_FEATURED[plan.slug] ?? false,
    audience: SLUG_AUDIENCE[plan.slug] ?? "",
    limits: limitsToStrings(limitMap, plan.slug),
  };
}

const ORG_STATUS_AR: Record<DbOrganization["status"], string> = {
  active:    "نشطة",
  trial:     "تجريبية",
  suspended: "معلقة",
  cancelled: "ملغاة",
};

const SUB_STATUS_AR: Record<DbSubscription["status"], string> = {
  active:    "نشطة",
  trialing:  "تجريبية",
  past_due:  "متأخرة",
  cancelled: "ملغاة",
  suspended: "معلقة",
};

const SUB_BILLING_AR: Record<DbSubscription["billing_cycle"], string> = {
  monthly: "شهري",
  annual:  "سنوي",
  internal: "داخلي",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function normalizeSubscription(sub: DbSubscription, plans: DbPlan[]): DisplaySubscription {
  const plan = plans.find((p) => p.id === sub.plan_id);
  return {
    id: sub.id,
    statusAr: SUB_STATUS_AR[sub.status] ?? sub.status,
    isActive: sub.status === "active",
    billingCycleAr: SUB_BILLING_AR[sub.billing_cycle] ?? sub.billing_cycle,
    planName: plan?.name ?? "—",
    startedAt: formatDate(sub.started_at),
  };
}

// ─── Main fetch ──────────────────────────────────────────────────────────────

export async function fetchOwnerDashboardData(): Promise<OwnerDashboardData> {
  const [orgsRes, plansRes, limitsRes, subsRes, pricingPlansRes] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, slug, owner_email, plan_id, status, notes, is_internal, deleted_at, created_at")
      .order("created_at"),
    supabase
      .from("plans")
      .select("id, name, slug, is_active, sort_order")
      .eq("is_active", true)
      .order("sort_order"),
    supabase.from("plan_limits").select("plan_id, limit_key, limit_value"),
    supabase
      .from("subscriptions")
      .select("id, organization_id, plan_id, status, billing_cycle, started_at, ends_at"),
    supabase
      .from("plans")
      .select("id, name, slug, price_monthly, price_annual, is_active, sort_order, created_at"),
  ]);

  if (orgsRes.error)  console.error("[owner] organizations fetch error:", orgsRes.error.message);
  if (plansRes.error) console.error("[owner] plans fetch error:", plansRes.error.message);
  if (limitsRes.error) console.error("[owner] plan_limits fetch error:", limitsRes.error.message);
  if (subsRes.error)  console.error("[owner] subscriptions fetch error:", subsRes.error.message);
  if (pricingPlansRes.error) console.error("[owner] plan pricing fetch error:", pricingPlansRes.error.message);

  // Exclude soft-deleted tenants from the active management surface.
  const rawOrgs  = ((orgsRes.data ?? []) as DbOrganization[]).filter((o) => !o.deleted_at);
  const rawPlans = (plansRes.data ?? []) as DbPlan[];
  const rawLimits = (limitsRes.data ?? []) as DbPlanLimit[];
  const rawSubs  = (subsRes.data  ?? []) as DbSubscription[];
  const pricingPlans = (pricingPlansRes.data ?? []) as DbPlanFull[];

  const organizations = rawOrgs.map((o) => normalizeOrg(o, rawPlans));
  const plans = rawPlans.map((p) => normalizePlan(p, rawLimits));

  const internalRaw = rawOrgs.find((o) => o.is_internal === true) ?? null;
  const internalOrg = internalRaw ? normalizeOrg(internalRaw, rawPlans) : null;

  const internalPlanLimits: Record<string, number> = {};
  if (internalRaw?.plan_id) {
    rawLimits
      .filter((l) => l.plan_id === internalRaw.plan_id)
      .forEach((l) => {
        internalPlanLimits[l.limit_key] = l.limit_value;
      });
  }

  const internalSubRaw = internalRaw
    ? rawSubs.find((s) => s.organization_id === internalRaw.id) ?? null
    : null;
  const internalSubscription = internalSubRaw
    ? normalizeSubscription(internalSubRaw, rawPlans)
    : null;

  const activeOrgCount = rawOrgs.filter(
    (o) => !o.is_internal && (o.status === "active" || o.status === "trial"),
  ).length;
  const customerOrgIds = rawOrgs.filter((o) => !o.is_internal).map((o) => o.id);
  const mrr = computeMrr(rawSubs, rawOrgs, pricingPlans);
  const staffCount = await fetchCustomerStaffCount(customerOrgIds);

  return {
    organizations,
    plans,
    activeOrgCount,
    mrr,
    staffCount,
    internalOrg,
    internalPlanLimits,
    internalSubscription,
  };
}

// ─── Plans page fetch (read model) ───────────────────────────────────────────
// Reads every plan (active and inactive) plus plan_limits key-value rows.
// Gated by is_owner() RLS — throws on plans error; limits degrade to null values.

export async function fetchPlansPage(): Promise<DisplayPlanFull[]> {
  const [plansRes, limitsRes] = await Promise.all([
    supabase
      .from("plans")
      .select("id, name, slug, price_monthly, price_annual, is_active, sort_order, created_at")
      .order("sort_order"),
    supabase.from("plan_limits").select("plan_id, limit_key, limit_value"),
  ]);

  if (plansRes.error) {
    console.error("[owner] plans page fetch error:", plansRes.error.message);
    throw new Error(plansRes.error.message);
  }
  if (limitsRes.error) console.error("[owner] plan_limits page fetch error:", limitsRes.error.message);

  const rawPlans  = (plansRes.data  ?? []) as DbPlanFull[];
  const rawLimits = (limitsRes.data ?? []) as DbPlanLimit[];

  return rawPlans.map((plan) => {
    const map: Record<string, number> = {};
    rawLimits
      .filter((l) => l.plan_id === plan.id)
      .forEach((l) => {
        map[l.limit_key] = l.limit_value;
      });
    const pick = (key: string): number | null => (key in map ? map[key] : null);

    return {
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      accent: SLUG_ACCENT[plan.slug] ?? "cyan",
      priceMonthly: plan.price_monthly,
      priceAnnual: plan.price_annual,
      isActive: plan.is_active,
      sortOrder: plan.sort_order,
      createdAt: formatDate(plan.created_at),
      limits: {
        maxEmployees:    pick("max_employees"),
        maxAgencies:     pick("max_agencies"),
        maxDepartments:  pick("max_departments"),
        maxSections:     pick("max_sections"),
        aiLevel:         pick("ai_level"),
        whatsappEnabled: pick("whatsapp_enabled"),
      },
    };
  });
}

// ─── Organizations page fetch ────────────────────────────────────────────────

// PR5-A: surfaces the Supabase organizations query error instead of silently
// returning an empty list. Carries only the safe PostgREST `code` + `message`
// (no auth tokens, no row data) so the owner-only diagnostic banner can show
// a real cause when the list looks empty in production.
export class OrganizationsFetchError extends Error {
  readonly code: string;
  constructor(code: string | null | undefined, message: string) {
    super(message);
    this.name = "OrganizationsFetchError";
    this.code = code && code.trim() ? code : "unknown";
  }
}

export async function fetchOrganizationsPage(): Promise<DisplayOrgFull[]> {
  const [orgsRes, plansRes, subsRes, linksRes] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        // PR5-B: customer_code removed — production lacks the column (42703).
        "id, name, slug, owner_email, plan_id, status, notes, is_internal, deleted_at, created_at, organization_code",
      )
      .order("created_at"),
    supabase
      .from("plans")
      .select("id, name, slug")
      .eq("is_active", true),
    supabase
      .from("subscriptions")
      .select("organization_id, plan_id, status, billing_cycle"),
    // Linked client logins (profiles.organization_id). Wrapped so a project
    // that has not yet applied migration 010 (missing column) degrades to
    // "no links" instead of failing the whole organizations list.
    supabase
      .from("profiles")
      .select("organization_id")
      .not("organization_id", "is", null),
  ]);

  // PR5-A: a failing organizations query was previously logged and then
  // hidden behind an empty array, which is why /owner/organizations rendered
  // "0" while the DB had rows. Raise it so the page can show why.
  if (orgsRes.error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[owner] orgs page fetch error:", orgsRes.error);
    }
    throw new OrganizationsFetchError(orgsRes.error.code, orgsRes.error.message);
  }
  if (plansRes.error) console.error("[owner] plans page fetch error:", plansRes.error.message);
  if (subsRes.error)  console.error("[owner] subs page fetch error:", subsRes.error.message);
  if (linksRes.error) console.warn("[owner] client-login links fetch skipped:", linksRes.error.message);

  // Soft-deleted tenants are hidden from the owner management list; their rows
  // remain in the DB and can be restored by clearing deleted_at.
  const rawOrgs  = ((orgsRes.data ?? []) as DbOrganization[]).filter((o) => !o.deleted_at);
  const rawPlans = (plansRes.data ?? []) as Pick<DbPlan, "id" | "name" | "slug">[];
  const rawSubs  = (subsRes.data  ?? []) as Pick<DbSubscription, "organization_id" | "plan_id" | "status" | "billing_cycle">[];
  const linkedOrgIds = new Set(
    ((linksRes.data ?? []) as { organization_id: string | null }[])
      .map((r) => r.organization_id)
      .filter((id): id is string => !!id),
  );

  return rawOrgs.map((org) => {
    const plan = rawPlans.find((p) => p.id === org.plan_id);
    const sub  = rawSubs.find((s) => s.organization_id === org.id);
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      customerCode: resolveOrganizationPublicCode(org),
      ownerEmail: org.owner_email,
      isInternal: org.is_internal === true,
      statusRaw: org.status,
      statusAr: ORG_STATUS_AR[org.status] ?? org.status,
      planId: org.plan_id,
      planName: plan?.name ?? "—",
      planSlug: plan?.slug ?? "",
      hasSubscription: !!sub,
      subStatusAr: sub ? (SUB_STATUS_AR[sub.status] ?? sub.status) : "—",
      subIsActive: sub?.status === "active",
      subBillingCycleAr: sub ? (SUB_BILLING_AR[sub.billing_cycle] ?? sub.billing_cycle) : "—",
      hasClientLogin: linkedOrgIds.has(org.id),
      createdAt: formatDate(org.created_at),
    };
  });
}

// ─── Subscriptions page fetch (read model) ───────────────────────────────────
// Joins subscriptions → organizations → plans for display names.
// Gated by is_owner() RLS — throws on subscriptions query error.

type DbSubscriptionRow = DbSubscription & { created_at: string };

export async function fetchSubscriptionsPage(): Promise<DisplaySubscriptionFull[]> {
  const [subsRes, orgsRes, plansRes] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, organization_id, plan_id, status, billing_cycle, started_at, ends_at, created_at")
      .order("created_at"),
    // Phase 4C-2: the org read includes deleted_at + status so every
    // subscription can be classified against its tenant's lifecycle.
    supabase.from("organizations").select("id, name, slug, is_internal, deleted_at, status"),
    supabase.from("plans").select("id, name, slug"),
  ]);

  if (subsRes.error) {
    console.error("[owner] subscriptions page fetch error:", subsRes.error.message);
    throw new Error(subsRes.error.message);
  }
  if (orgsRes.error)  console.error("[owner] subs orgs fetch error:", orgsRes.error.message);
  if (plansRes.error) console.error("[owner] subs plans fetch error:", plansRes.error.message);

  const rawSubs  = (subsRes.data  ?? []) as DbSubscriptionRow[];
  const rawOrgs  = (orgsRes.data  ?? []) as Pick<
    DbOrganization,
    "id" | "name" | "slug" | "is_internal" | "deleted_at" | "status"
  >[];
  const rawPlans = (plansRes.data ?? []) as Pick<DbPlan, "id" | "name" | "slug">[];

  return rawSubs.map((sub) => {
    const org  = rawOrgs.find((o) => o.id === sub.organization_id);
    const plan = rawPlans.find((p) => p.id === sub.plan_id);
    const planSlug = plan?.slug ?? "";
    const lifecycle = classifySubscriptionLifecycle(
      sub.status,
      org ? { isInternal: org.is_internal === true, deletedAt: org.deleted_at } : null,
    );
    return {
      id: sub.id,
      organizationId: sub.organization_id,
      orgName: org?.name ?? "—",
      orgSlug: org?.slug ?? null,
      isInternal: org?.is_internal === true,
      orgDeletedAt: org?.deleted_at ?? null,
      orgStatusRaw: org?.status ?? null,
      lifecycle,
      lifecycleLabelAr: SUBSCRIPTION_LIFECYCLE_LABEL_AR[lifecycle],
      planId: sub.plan_id,
      planName: plan?.name ?? "—",
      planSlug,
      accent: SLUG_ACCENT[planSlug] ?? "cyan",
      statusRaw: sub.status,
      statusAr: SUB_STATUS_AR[sub.status] ?? sub.status,
      isActive: sub.status === "active",
      billingCycleRaw: sub.billing_cycle,
      billingCycleAr: SUB_BILLING_AR[sub.billing_cycle] ?? sub.billing_cycle,
      startedAt: formatDate(sub.started_at),
      endsAt: sub.ends_at ? formatDate(sub.ends_at) : null,
      createdAt: formatDate(sub.created_at),
    };
  });
}

// ─── Plan options (for the create-organization form) ──────────────────────────
// Active plans only, ordered by sort_order. Gated by is_owner() RLS.

export interface PlanOption {
  id: string;
  name: string;
  slug: string;
}

export async function fetchPlanOptions(): Promise<PlanOption[]> {
  const { data, error } = await supabase
    .from("plans")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    console.error("[owner] plan options fetch error:", error.message);
    throw new Error(error.message);
  }
  return (data ?? []) as PlanOption[];
}

// ─── Create organization (owner-only mutation) ────────────────────────────────
// Inserts a single row into `organizations` (no subscription is created here),
// then writes a best-effort owner_audit_log entry. Both inserts rely on the
// existing is_owner() RLS WITH CHECK policies — a non-owner session is rejected
// by the database, never by this client code. Returns a typed result so the UI
// can show field-level Arabic errors (duplicate slug / validation / unknown).

export interface NewOrganizationInput {
  name: string;
  slug: string | null;
  ownerEmail: string | null;
  planId: string | null;
  status: DbOrganization["status"];
  notes: string | null;
}

export type CreateOrgErrorCode = "validation" | "duplicate_slug" | "unknown";

export interface CreateOrgResult {
  ok: boolean;
  id?: string;
  errorCode?: CreateOrgErrorCode;
  error?: string;
}

export async function createOrganization(input: NewOrganizationInput): Promise<CreateOrgResult> {
  const name = input.name.trim();
  if (!name) {
    return { ok: false, errorCode: "validation", error: "اسم المنشأة مطلوب" };
  }

  const slug = input.slug && input.slug.trim() ? input.slug.trim() : null;
  const ownerEmail = input.ownerEmail && input.ownerEmail.trim()
    ? input.ownerEmail.trim().toLowerCase()
    : null;
  const notes = input.notes && input.notes.trim() ? input.notes.trim() : null;
  const planId = input.planId || null;
  const status = input.status;

  const { data, error } = await supabase
    .from("organizations")
    .insert({ name, slug, owner_email: ownerEmail, plan_id: planId, status, notes })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, errorCode: "duplicate_slug", error: "المعرّف (slug) مستخدم مسبقًا" };
    }
    console.error("[owner] create organization error:", error.message);
    return { ok: false, errorCode: "unknown", error: "تعذّر إنشاء المنشأة — حاول مجدداً" };
  }

  const newId = data.id as string;

  // Best-effort audit trail — a logging failure must not undo a created org.
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("owner_audit_logs").insert({
      owner_email: user?.email ?? "unknown",
      action: "create_organization",
      target_type: "organization",
      target_id: newId,
      metadata: { name, slug, owner_email: ownerEmail, plan_id: planId, status },
    });
  } catch (logErr) {
    console.warn("[owner] audit log insert failed:", logErr);
  }

  return { ok: true, id: newId };
}

// ─── Provision full tenant (owner-only, server route) ─────────────────────────
// Calls POST /api/owner/provision-tenant with the owner's session token only.

export interface ProvisionTenantInput {
  name: string;
  slug?: string;
  ownerEmail: string;
  password: string;
  planId?: string;
  status: DbOrganization["status"];
  billingCycle: "monthly" | "annual";
}

export interface ProvisionTenantResult {
  ok: boolean;
  error?: string;
  partial?: boolean;
  failedStep?: string;
  organizationId?: string;
  organizationCode?: string | null;
  email?: string;
}

export async function provisionTenant(
  input: ProvisionTenantInput,
): Promise<ProvisionTenantResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    return { ok: false, error: "انتهت الجلسة — سجّل الدخول مجدداً" };
  }

  let resp: Response;
  try {
    resp = await fetch("/api/owner/provision-tenant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: input.name.trim(),
        slug: input.slug?.trim() || undefined,
        ownerEmail: input.ownerEmail.trim().toLowerCase(),
        password: input.password,
        planId: input.planId || undefined,
        status: input.status,
        billingCycle: input.billingCycle,
      }),
    });
  } catch {
    return { ok: false, error: "تعذّر الاتصال بالخادم — حاول مجدداً" };
  }

  type Payload = {
    success?: boolean;
    error?: string;
    partial?: boolean;
    failedStep?: string;
    organizationId?: string;
    organizationCode?: string | null;
    organization_code?: string | null;
    customerCode?: string | null;
    email?: string;
  };

  let payload: Payload = {};
  try {
    payload = (await resp.json()) as Payload;
  } catch {
    /* non-JSON */
  }

  if (payload.partial) {
    return {
      ok: false,
      partial: true,
      failedStep: payload.failedStep,
      error: payload.error,
      organizationId: payload.organizationId,
      organizationCode:
        payload.organizationCode
        ?? payload.organization_code
        ?? payload.customerCode
        ?? null,
      email: input.ownerEmail.trim().toLowerCase(),
    };
  }

  if (!resp.ok || payload.success !== true) {
    return { ok: false, error: payload.error ?? "تعذّر إنشاء العميل الكامل" };
  }

  return {
    ok: true,
    organizationId: payload.organizationId,
    organizationCode:
      payload.organizationCode
      ?? payload.organization_code
      ?? payload.customerCode
      ?? null,
    email: payload.email ?? input.ownerEmail.trim().toLowerCase(),
  };
}

// ─── Activate subscription (owner-only mutation) ──────────────────────────────
// Creates the first subscription for an organization that has none. Requires
// the organization to already have a plan_id. Because `subscriptions` has no
// unique constraint on organization_id, duplicates are prevented with an
// existence check before insert. Both the insert and the audit-log write are
// gated by the existing is_owner() RLS WITH CHECK policies.

export interface ActivateSubscriptionInput {
  organizationId: string;
  planId: string | null;
  status: "active" | "trialing";
  billingCycle: "monthly" | "annual";
  endsAt: string | null;
}

export type ActivateSubErrorCode = "no_plan" | "already_exists" | "unknown";

export interface ActivateSubResult {
  ok: boolean;
  id?: string;
  errorCode?: ActivateSubErrorCode;
  error?: string;
}

export async function activateSubscription(input: ActivateSubscriptionInput): Promise<ActivateSubResult> {
  if (!input.planId) {
    return { ok: false, errorCode: "no_plan", error: "يجب اختيار باقة قبل تفعيل الاشتراك" };
  }

  // Guard against a second subscription for the same organization.
  const { data: existing, error: checkErr } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("organization_id", input.organizationId)
    .limit(1);

  if (checkErr) {
    console.error("[owner] subscription existence check error:", checkErr.message);
    return { ok: false, errorCode: "unknown", error: "تعذّر التحقق من الاشتراك الحالي" };
  }
  if (existing && existing.length > 0) {
    return { ok: false, errorCode: "already_exists", error: "يوجد اشتراك لهذه المنشأة بالفعل" };
  }

  const payload: {
    organization_id: string;
    plan_id: string;
    status: ActivateSubscriptionInput["status"];
    billing_cycle: ActivateSubscriptionInput["billingCycle"];
    ends_at?: string;
  } = {
    organization_id: input.organizationId,
    plan_id: input.planId,
    status: input.status,
    billing_cycle: input.billingCycle,
  };
  if (input.endsAt) payload.ends_at = input.endsAt;

  const { data, error } = await supabase
    .from("subscriptions")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    console.error("[owner] activate subscription error:", error.message);
    return { ok: false, errorCode: "unknown", error: "تعذّر تفعيل الاشتراك — حاول مجدداً" };
  }

  const newId = data.id as string;

  // Best-effort audit trail — a logging failure must not undo activation.
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("owner_audit_logs").insert({
      owner_email: user?.email ?? "unknown",
      action: "activate_subscription",
      target_type: "subscription",
      target_id: newId,
      metadata: {
        organization_id: input.organizationId,
        plan_id: input.planId,
        status: input.status,
        billing_cycle: input.billingCycle,
        ends_at: input.endsAt ?? null,
      },
    });
  } catch (logErr) {
    console.warn("[owner] audit log insert failed:", logErr);
  }

  return { ok: true, id: newId };
}

// ─── Create client login (owner-only mutation, server-side) ───────────────────
// Calls the service-role server route /api/owner/create-client-login. The
// service-role key never reaches the browser — this only forwards the owner's
// access token so the server can verify the caller is the platform owner.

export interface CreateClientLoginInput {
  organizationId: string;
  password: string;
}

export interface CreateClientLoginResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function createClientLogin(
  input: CreateClientLoginInput,
): Promise<CreateClientLoginResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    return { ok: false, error: "انتهت الجلسة — سجّل الدخول مجدداً" };
  }

  let resp: Response;
  try {
    resp = await fetch("/api/owner/create-client-login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        organizationId: input.organizationId,
        password: input.password,
      }),
    });
  } catch {
    return { ok: false, error: "تعذّر الاتصال بالخادم — حاول مجدداً" };
  }

  let payload: { success?: boolean; id?: string; error?: string } = {};
  try {
    payload = (await resp.json()) as typeof payload;
  } catch {
    /* non-JSON response */
  }

  if (!resp.ok || !payload.success) {
    return { ok: false, error: payload.error ?? "تعذّر إنشاء حساب الدخول" };
  }
  return { ok: true, id: payload.id };
}

// ─── Reset client manager password (owner-only, server-side) ──────────────────
// Calls the service-role server route /api/owner/reset-client-password, which
// sends a SECURE password-recovery link to the tenant manager's email. No
// password is ever generated, returned, or displayed — this only forwards the
// owner's access token so the server can verify the caller is the platform owner.

export interface ResetClientPasswordResult {
  ok: boolean;
  email?: string;
  error?: string;
}

export async function resetClientPassword(
  organizationId: string,
): Promise<ResetClientPasswordResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    return { ok: false, error: "انتهت الجلسة — سجّل الدخول مجدداً" };
  }

  let resp: Response;
  try {
    resp = await fetch("/api/owner/reset-client-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ organizationId }),
    });
  } catch {
    return { ok: false, error: "تعذّر الاتصال بالخادم — حاول مرة أخرى" };
  }

  let payload: { success?: boolean; email?: string; error?: string } = {};
  try {
    payload = (await resp.json()) as typeof payload;
  } catch {
    /* non-JSON response */
  }

  if (!resp.ok || !payload.success) {
    return { ok: false, error: payload.error ?? "تعذّر إرسال رابط إعادة التعيين، حاول مرة أخرى" };
  }
  return { ok: true, email: payload.email };
}

// ─── Customer-tenant management mutations (owner-only) ─────────────────────────
// All four run client-side with the anon key; the existing is_owner() RLS UPDATE
// policy on `organizations` is the real authorization boundary (a non-owner is
// rejected by the database, never by this code). The protect_internal_organization
// DB trigger (migration 013) is a second safety net that blocks suspend / cancel /
// soft-delete / un-flag on the internal org. The UI additionally hides these
// actions for internal orgs, so they are normally never attempted on one.

export interface OwnerActionResult {
  ok: boolean;
  error?: string;
}

// Best-effort audit trail — a logging failure must never undo the action.
async function logOwnerAction(
  action: string,
  targetId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("owner_audit_logs").insert({
      owner_email: user?.email ?? "unknown",
      action,
      target_type: "organization",
      target_id: targetId,
      metadata,
    });
  } catch (logErr) {
    console.warn(`[owner] audit log insert failed (${action}):`, logErr);
  }
}

// Edit basic organization details (name / owner email / notes). Status and plan
// are changed through their own dedicated actions below.
export interface UpdateOrganizationInput {
  id: string;
  name: string;
  ownerEmail: string | null;
  notes: string | null;
}

export async function updateOrganization(input: UpdateOrganizationInput): Promise<OwnerActionResult> {
  const name = input.name.trim();
  if (!name) {
    return { ok: false, error: "اسم المنشأة مطلوب" };
  }
  const ownerEmail = input.ownerEmail && input.ownerEmail.trim()
    ? input.ownerEmail.trim().toLowerCase()
    : null;
  const notes = input.notes && input.notes.trim() ? input.notes.trim() : null;

  const { error } = await supabase
    .from("organizations")
    .update({ name, owner_email: ownerEmail, notes, updated_at: new Date().toISOString() })
    .eq("id", input.id);

  if (error) {
    console.error("[owner] update organization error:", error.message);
    return { ok: false, error: "تعذّر تحديث بيانات المنشأة — حاول مجدداً" };
  }

  await logOwnerAction("update_organization", input.id, { name, owner_email: ownerEmail });
  return { ok: true };
}

// Change a tenant's plan. Updates organizations.plan_id and best-effort syncs the
// tenant's existing subscription plan so the two never drift.
export async function changeOrganizationPlan(input: { id: string; planId: string | null }): Promise<OwnerActionResult> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("organizations")
    .update({ plan_id: input.planId, updated_at: now })
    .eq("id", input.id);

  if (error) {
    console.error("[owner] change plan error:", error.message);
    return { ok: false, error: "تعذّر تغيير الباقة — حاول مجدداً" };
  }

  if (input.planId) {
    const { error: subErr } = await supabase
      .from("subscriptions")
      .update({ plan_id: input.planId, updated_at: now })
      .eq("organization_id", input.id);
    if (subErr) console.warn("[owner] subscription plan sync skipped:", subErr.message);
  }

  await logOwnerAction("change_plan", input.id, { plan_id: input.planId });
  return { ok: true };
}

// Suspend or reactivate a customer tenant. Best-effort syncs the subscription
// status. The protect_internal_organization trigger rejects this on internal orgs.
export async function setOrganizationStatus(input: { id: string; status: "active" | "suspended" }): Promise<OwnerActionResult> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("organizations")
    .update({ status: input.status, updated_at: now })
    .eq("id", input.id);

  if (error) {
    console.error("[owner] set status error:", error.message);
    return { ok: false, error: "تعذّر تحديث حالة المنشأة — حاول مجدداً" };
  }

  const { error: subErr } = await supabase
    .from("subscriptions")
    .update({ status: input.status === "active" ? "active" : "suspended", updated_at: now })
    .eq("organization_id", input.id);
  if (subErr) console.warn("[owner] subscription status sync skipped:", subErr.message);

  await logOwnerAction(
    input.status === "suspended" ? "suspend_organization" : "reactivate_organization",
    input.id,
    { status: input.status },
  );
  return { ok: true };
}

// ─── Create a new plan (owner-only mutation) ─────────────────────────────────
// Inserts into `plans` and then `plan_limits`. Gated by is_owner() RLS.

export interface NewPlanInput {
  name: string;
  slug: string;
  priceMonthly: number | null;
  priceAnnual: number | null;
  sortOrder: number;
  limits: {
    maxEmployees: number | null;
    maxAgencies: number | null;
    maxDepartments: number | null;
    maxSections: number | null;
    aiLevel: number | null;
    whatsappEnabled: number | null;
  };
}

export type CreatePlanErrorCode = "validation" | "duplicate_slug" | "unknown";

export interface CreatePlanResult {
  ok: boolean;
  id?: string;
  errorCode?: CreatePlanErrorCode;
  error?: string;
}

export async function createPlan(input: NewPlanInput): Promise<CreatePlanResult> {
  const name = input.name.trim();
  const slug = input.slug.trim().toLowerCase().replace(/\s+/g, "-");
  if (!name) return { ok: false, errorCode: "validation", error: "اسم الباقة مطلوب" };
  if (!slug) return { ok: false, errorCode: "validation", error: "المعرّف (slug) مطلوب" };

  const { data, error } = await supabase
    .from("plans")
    .insert({
      name,
      slug,
      price_monthly: input.priceMonthly,
      price_annual: input.priceAnnual,
      sort_order: input.sortOrder,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, errorCode: "duplicate_slug", error: "المعرّف (slug) مستخدم مسبقًا" };
    }
    console.error("[owner] create plan error:", error.message);
    return { ok: false, errorCode: "unknown", error: "تعذّر إنشاء الباقة — حاول مجدداً" };
  }

  const planId = data.id as string;

  const limitRows: { plan_id: string; limit_key: string; limit_value: number }[] = [];
  const { limits } = input;
  if (limits.maxEmployees !== null)    limitRows.push({ plan_id: planId, limit_key: "max_employees",    limit_value: limits.maxEmployees });
  if (limits.maxAgencies !== null)     limitRows.push({ plan_id: planId, limit_key: "max_agencies",     limit_value: limits.maxAgencies });
  if (limits.maxDepartments !== null)  limitRows.push({ plan_id: planId, limit_key: "max_departments",  limit_value: limits.maxDepartments });
  if (limits.maxSections !== null)     limitRows.push({ plan_id: planId, limit_key: "max_sections",     limit_value: limits.maxSections });
  if (limits.aiLevel !== null)         limitRows.push({ plan_id: planId, limit_key: "ai_level",         limit_value: limits.aiLevel });
  if (limits.whatsappEnabled !== null) limitRows.push({ plan_id: planId, limit_key: "whatsapp_enabled", limit_value: limits.whatsappEnabled });

  if (limitRows.length > 0) {
    const { error: limErr } = await supabase.from("plan_limits").insert(limitRows);
    if (limErr) console.warn("[owner] plan_limits insert skipped:", limErr.message);
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("owner_audit_logs").insert({
      owner_email: user?.email ?? "unknown",
      action: "create_plan",
      target_type: "plan",
      target_id: planId,
      metadata: { name, slug, price_monthly: input.priceMonthly, price_annual: input.priceAnnual },
    });
  } catch (logErr) {
    console.warn("[owner] audit log insert failed:", logErr);
  }

  return { ok: true, id: planId };
}

// Soft-delete a customer tenant: mark deleted_at + status='cancelled'. No rows are
// removed; the org simply leaves the active list and can be restored by clearing
// deleted_at. The protect_internal_organization trigger rejects this on internal orgs.
//
// Phase 4C-1: the tenant lifecycle guard runs first. Hard delete of organizations
// is never performed here or anywhere in the owner flow — an org with linked
// subscriptions, invoices, employees, audit logs, or virtual office mappings can
// only be archived (this soft delete) or suspended. The linked-record summary is
// written to owner_audit_logs alongside the acting owner (deleted_by).
// customer/organization codes are immutable and must never be reused.
export async function softDeleteOrganization(input: { id: string }): Promise<OwnerActionResult> {
  const assessment = await assessTenantLifecycle(supabase, input.id);
  const decision = evaluateTenantLifecycleAction("soft_delete", assessment);
  if (!decision.allowed) {
    return { ok: false, error: decision.reason ?? "لا يمكن حذف المنشأة — يجب أرشفتها أو تعليقها" };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("organizations")
    .update({ deleted_at: now, status: "cancelled", updated_at: now })
    .eq("id", input.id);

  if (error) {
    console.error("[owner] soft delete error:", error.message);
    return { ok: false, error: "تعذّر حذف المنشأة — حاول مجدداً" };
  }

  // organizations has no deleted_by column (no schema change in this phase);
  // the acting owner is recorded as deleted_by in the audit metadata instead.
  let deletedBy = "unknown";
  try {
    const { data: userData } = await supabase.auth.getUser();
    deletedBy = userData?.user?.email ?? "unknown";
  } catch {
    // best-effort only
  }

  await logOwnerAction("soft_delete_organization", input.id, {
    mode: decision.mode,
    deleted_by: deletedBy,
    ...summarizeTenantLifecycleAssessment(assessment),
  });
  return { ok: true };
}

// ─── Subscription-level mutations (owner-only) ────────────────────────────────
// Operate on subscriptions by subscription ID. Each mutation syncs the parent
// organization and logs to owner_audit_logs with target_type="subscription".

async function logSubAction(
  action: string,
  subscriptionId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("owner_audit_logs").insert({
      owner_email: user?.email ?? "unknown",
      action,
      target_type: "subscription",
      target_id: subscriptionId,
      metadata,
    });
  } catch (logErr) {
    console.warn(`[owner] audit log insert failed (${action}):`, logErr);
  }
}

async function fetchSubscriptionLifecycle(subscriptionId: string): Promise<
  | { ok: true; status: string | null; endsAt: string | null }
  | { ok: false; error: string }
> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, ends_at")
    .eq("id", subscriptionId)
    .maybeSingle();

  if (error) {
    console.error("[owner] subscription lifecycle check error:", error.message);
    return { ok: false, error: "Unable to verify subscription lifecycle state" };
  }

  return {
    ok: true,
    status: (data?.status as string | null | undefined) ?? null,
    endsAt: (data?.ends_at as string | null | undefined) ?? null,
  };
}

// Change the plan on an existing subscription. Syncs org.plan_id.
export async function changeSubscriptionPlan(input: {
  subscriptionId: string;
  organizationId: string;
  planId: string;
}): Promise<OwnerActionResult> {
  const lifecycle = await fetchSubscriptionLifecycle(input.subscriptionId);
  if (!lifecycle.ok) return lifecycle;

  const decision = canChangePlan({
    status: lifecycle.status,
    endsAt: lifecycle.endsAt,
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.reason ?? "Plan change is not available for this subscription state" };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("subscriptions")
    .update({ plan_id: input.planId, updated_at: now })
    .eq("id", input.subscriptionId);

  if (error) {
    console.error("[owner] change subscription plan error:", error.message);
    return { ok: false, error: "تعذّر تغيير الباقة — حاول مجدداً" };
  }

  await supabase
    .from("organizations")
    .update({ plan_id: input.planId, updated_at: now })
    .eq("id", input.organizationId);

  await logSubAction("change_subscription_plan", input.subscriptionId, {
    organization_id: input.organizationId,
    plan_id: input.planId,
  });
  return { ok: true };
}

// Set subscription status to 'suspended' or 'cancelled'. Syncs org.status.
export async function updateSubscriptionStatus(input: {
  subscriptionId: string;
  organizationId: string;
  status: "suspended" | "cancelled";
}): Promise<OwnerActionResult> {
  const lifecycle = await fetchSubscriptionLifecycle(input.subscriptionId);
  if (!lifecycle.ok) return lifecycle;

  const decision = input.status === "suspended"
    ? canSuspendSubscription({ status: lifecycle.status, endsAt: lifecycle.endsAt })
    : canCancelSubscription({ status: lifecycle.status, endsAt: lifecycle.endsAt });
  if (!decision.allowed) {
    return { ok: false, error: decision.reason ?? "Subscription status change is not available" };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("subscriptions")
    .update({ status: input.status, updated_at: now })
    .eq("id", input.subscriptionId);

  if (error) {
    console.error("[owner] update subscription status error:", error.message);
    return { ok: false, error: "تعذّر تحديث حالة الاشتراك — حاول مجدداً" };
  }

  await supabase
    .from("organizations")
    .update({ status: input.status === "suspended" ? "suspended" : "cancelled", updated_at: now })
    .eq("id", input.organizationId);

  const action = input.status === "suspended" ? "subscription_suspended" : "subscription_cancelled";
  await logSubAction(action, input.subscriptionId, {
    organization_id: input.organizationId,
    status: input.status,
  });
  return { ok: true };
}

// Create a new subscription. Blocks only if active/trialing/past_due sub exists,
// allowing creation for orgs whose previous subscription was cancelled.
export async function createSubscriptionForOrg(input: {
  organizationId: string;
  planId: string;
  billingCycle: "monthly" | "annual" | "internal";
}): Promise<ActivateSubResult> {
  const { data: existing, error: checkErr } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("organization_id", input.organizationId)
    .in("status", [...LIVE_SUBSCRIPTION_STATUSES])
    .limit(1);

  if (checkErr) {
    console.error("[owner] subscription check error:", checkErr.message);
    return { ok: false, errorCode: "unknown", error: "تعذّر التحقق من الاشتراك الحالي" };
  }
  if (existing && existing.length > 0) {
    return { ok: false, errorCode: "already_exists", error: "يوجد اشتراك نشط لهذه المنشأة بالفعل" };
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .insert({
      organization_id: input.organizationId,
      plan_id: input.planId,
      status: "active",
      billing_cycle: input.billingCycle,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[owner] create subscription error:", error.message);
    return { ok: false, errorCode: "unknown", error: "تعذّر إنشاء الاشتراك — حاول مجدداً" };
  }

  const newId = data.id as string;

  await supabase
    .from("organizations")
    .update({ plan_id: input.planId, updated_at: new Date().toISOString() })
    .eq("id", input.organizationId);

  await logSubAction("create_subscription", newId, {
    organization_id: input.organizationId,
    plan_id: input.planId,
    billing_cycle: input.billingCycle,
  });
  return { ok: true, id: newId };
}

// Permanently delete a cancelled subscription. No FK children reference subscriptions,
// so this is relationally safe. RLS already has is_owner() DELETE policy.
export async function hardDeleteSubscription(input: {
  subscriptionId: string;
  organizationId: string;
  planId: string;
  previousStatus: string;
}): Promise<OwnerActionResult> {
  // Write audit log BEFORE deletion so the record is preserved.
  await logSubAction("subscription_hard_deleted", input.subscriptionId, {
    organization_id: input.organizationId,
    plan_id: input.planId,
    previous_status: input.previousStatus,
  });

  // Extra guard: only delete if status is still cancelled.
  const { error } = await supabase
    .from("subscriptions")
    .delete()
    .eq("id", input.subscriptionId)
    .eq("status", "cancelled");

  if (error) {
    console.error("[owner] hard delete subscription error:", error.message);
    return { ok: false, error: "تعذّر الحذف النهائي — " + error.message };
  }

  return { ok: true };
}

// Owner-only demo reset. The client forwards only the owner JWT; the service
// role key is read exclusively by /api/owner/reset-demo-data on the server.
export interface ResetDemoDataResult {
  ok: boolean;
  error?: string;
  preserved?: string[];
  managerEmail?: string | null;
}

export async function resetDemoData(organizationId: string): Promise<ResetDemoDataResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    return { ok: false, error: "انتهت الجلسة — سجّل الدخول مجدداً" };
  }

  let resp: Response;
  try {
    resp = await fetch("/api/owner/reset-demo-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ organizationId }),
    });
  } catch {
    return { ok: false, error: "تعذّر الاتصال بالخادم — حاول مرة أخرى" };
  }

  let payload: {
    success?: boolean;
    error?: string;
    preserved?: string[];
    managerEmail?: string | null;
  } = {};
  try {
    payload = (await resp.json()) as typeof payload;
  } catch {
    /* non-JSON response */
  }

  if (!resp.ok || !payload.success) {
    return { ok: false, error: payload.error ?? "تعذّر إعادة ضبط بيانات العرض" };
  }

  return {
    ok: true,
    preserved: payload.preserved ?? [],
    managerEmail: payload.managerEmail ?? null,
  };
}
