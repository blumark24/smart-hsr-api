"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ArrowRight,
  Layers,
  CreditCard,
  Users,
  UserCircle,
  ListTodo,
  Activity,
  Gauge,
  Sparkles,
  MessageCircle,
  ShieldCheck,
  Hash,
  RefreshCw,
  Eye,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/contexts/ToastContext";
import { ACCENT } from "../../../_accent";
import {
  OWNER_ACTIVITY_EMPTY,
  OWNER_UNAVAILABLE_HINT,
} from "../../../_data";

function formatCustomerCode(code: string | null): string {
  return code ?? OWNER_UNAVAILABLE_HINT;
}
import {
  fetchOrganizationDetail,
  type OrganizationDetailData,
} from "../../../_lib/ownerOrgDetailQueries";
import { resetDemoData } from "../../../_lib/ownerQueries";

const PLAN_BADGE: Record<string, string> = {
  "بسيط": "bg-[#22d3ee]/12 text-[#22d3ee] border border-[#22d3ee]/25",
  "نمو": "bg-[#1e6fd9]/14 text-[#5b9bf0] border border-[#1e6fd9]/30",
  "متقدم": "bg-[#a855f7]/14 text-[#c084fc] border border-[#a855f7]/30",
};

const ORG_STATUS_BADGE: Record<string, string> = {
  "نشطة": "bg-[#10b981]/15 text-[#34d399]",
  "تجريبية": "bg-[#22d3ee]/15 text-[#22d3ee]",
  "معلقة": "bg-[#f59e0b]/15 text-[#fbbf24]",
  "ملغاة": "bg-[#ef4444]/15 text-[#f87171]",
};

const SUB_STATUS_BADGE: Record<string, string> = {
  "نشطة": "bg-[#10b981]/15 text-[#34d399]",
  "تجريبية": "bg-[#22d3ee]/15 text-[#22d3ee]",
  "متأخرة": "bg-[#ef4444]/15 text-[#f87171]",
  "معلقة": "bg-[#f59e0b]/15 text-[#fbbf24]",
  "ملغاة": "bg-[#6b7280]/15 text-[#9ca3af]",
};

function DetailSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-10 w-64 rounded bg-white/[0.06]" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card p-5 h-40">
            <div className="h-4 w-32 rounded bg-white/[0.06] mb-4" />
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-white/[0.06]" />
              <div className="h-3 w-2/3 rounded bg-white/[0.06]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReadOnlyBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg border border-[#22d3ee]/25 bg-[#22d3ee]/[0.06] px-2.5 py-1 text-[11px] text-[#22d3ee]/80">
      <Eye size={11} /> عرض فقط — بدون إجراءات
    </span>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 text-[12px]">
      <span className="text-[#8ba3c7] sm:w-32 flex-shrink-0">{label}</span>
      <span className="text-white min-w-0 break-words">{value}</span>
    </div>
  );
}

interface Props {
  orgId: string;
}

export default function OrganizationDetailPageContent({ orgId }: Props) {
  const toast = useToast();
  const [data, setData] = useState<OrganizationDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resettingDemo, setResettingDemo] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const result = await fetchOrganizationDetail(orgId);
      if (!result) {
        setNotFound(true);
        setData(null);
      } else {
        setData(result);
      }
    } catch {
      setError("فشل تحميل بيانات المنشأة");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleResetDemoData = useCallback(async () => {
    if (!data || data.profile.isInternal || resettingDemo) return;
    const confirmed = window.confirm(
      `إعادة ضبط بيانات العرض للمنشأة "${data.profile.name}"؟\nسيتم حذف بيانات التشغيل التجريبية فقط، مع الحفاظ على حسابات الدخول، المنشأة، الاشتراك، إعدادات مساحة العمل، ومدير المنشأة.`,
    );
    if (!confirmed) return;

    setResettingDemo(true);
    const res = await resetDemoData(orgId);
    setResettingDemo(false);

    if (!res.ok) {
      toast.error(res.error ?? "تعذّر إعادة ضبط بيانات العرض");
      return;
    }

    toast.success("تمت إعادة ضبط بيانات العرض مع الحفاظ على الهوية والاشتراك والإعدادات");
    void load();
  }, [data, load, orgId, resettingDemo, toast]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1400px]">
        <DetailSkeleton />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto w-full max-w-[1400px] space-y-4">
        <Link
          href="/owner/organizations"
          className="inline-flex items-center gap-1.5 text-[13px] text-[#8ba3c7] hover:text-[#22d3ee] transition-colors"
        >
          <ArrowRight size={14} />
          العودة إلى قائمة المنشآت
        </Link>
        <div className="glass-card p-8 text-center">
          <p className="text-[15px] text-white font-medium">المنشأة غير موجودة</p>
          <p className="text-[13px] text-[#8ba3c7] mt-2">تحقق من المعرف أو ارجع إلى القائمة.</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-[1400px] space-y-4">
        <Link
          href="/owner/organizations"
          className="inline-flex items-center gap-1.5 text-[13px] text-[#8ba3c7] hover:text-[#22d3ee] transition-colors"
        >
          <ArrowRight size={14} />
          العودة إلى قائمة المنشآت
        </Link>
        <div className="flex items-center gap-2.5 rounded-xl border border-[#ff7a3d]/25 bg-[#ff7a3d]/[0.06] px-4 py-3 text-[13px] text-[#ff9a68]">
          <RefreshCw size={14} className="flex-shrink-0" />
          {error ?? "خطأ غير متوقع"}
        </div>
      </div>
    );
  }

  const { profile, plan, subscription, usage, auditTimeline } = data;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 lg:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-2">
          <Link
            href="/owner/organizations"
            className="inline-flex items-center gap-1.5 text-[13px] text-[#8ba3c7] hover:text-[#22d3ee] transition-colors"
          >
            <ArrowRight size={14} />
            العودة إلى قائمة المنشآت
          </Link>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5 flex-wrap">
            <Building2 size={26} className="text-[#22d3ee]" />
            {profile.name}
            {profile.isInternal && (
              <span className="rounded-full bg-[#22d3ee]/12 border border-[#22d3ee]/25 px-2 py-0.5 text-[11px] text-[#22d3ee] font-normal">
                داخلي
              </span>
            )}
            {profile.isDeleted && (
              <span className="rounded-full bg-[#ef4444]/12 border border-[#ef4444]/25 px-2 py-0.5 text-[11px] text-[#f87171] font-normal">
                محذوفة (ناعم)
              </span>
            )}
          </h1>
          <p className="text-[13px] text-[#8ba3c7] leading-relaxed max-w-2xl">
            عرض قراءة فقط لبيانات المنشأة من قاعدة البيانات — بدون تعديل أو إجراءات إدارية.
          </p>
        </div>
        <ReadOnlyBadge />
      </div>

      {!profile.isInternal && (
        <section className="glass-card p-5 sm:p-6 border border-[#f59e0b]/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="font-heading text-base font-bold text-white flex items-center gap-2">
                <RotateCcw size={16} className="text-[#fbbf24]" />
                إجراءات بيانات العرض
              </h2>
              <p className="text-[12px] text-[#8ba3c7] leading-relaxed">
                إعادة ضبط بيانات التشغيل التجريبية لهذه المنشأة فقط. لا يتم حذف حسابات الدخول أو المنشأة أو الاشتراك أو إعدادات مساحة العمل أو مدير المنشأة.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetDemoData}
              disabled={resettingDemo}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#f59e0b]/35 bg-[#f59e0b]/10 px-4 py-2.5 text-[13px] font-medium text-[#fbbf24] hover:bg-[#f59e0b]/20 hover:border-[#f59e0b]/55 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw size={14} className={resettingDemo ? "animate-spin" : ""} />
              {resettingDemo ? "جاري إعادة الضبط..." : "إعادة ضبط بيانات العرض"}
            </button>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Profile */}
        <section className="glass-card p-5 sm:p-6">
          <h2 className="font-heading text-base font-bold text-white flex items-center gap-2 mb-4">
            <Building2 size={16} className="text-[#22d3ee]" />
            ملف المنشأة
          </h2>
          <div className="space-y-3">
            <Field
              label="كود المنشأة"
              value={
                <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[#22d3ee]">
                  <Hash size={11} className="text-[#22d3ee]/60" />
                  {formatCustomerCode(profile.customerCode)}
                </span>
              }
            />
            <Field label="المعرّف (slug)" value={<span className="font-mono">{profile.slug ?? "—"}</span>} />
            <Field
              label="حالة المنشأة"
              value={
                <span className={cn("badge text-[11px]", ORG_STATUS_BADGE[profile.statusAr])}>
                  {profile.statusAr}
                </span>
              }
            />
            <Field label="بريد المالك" value={profile.ownerEmail ?? "—"} />
            <Field
              label="حساب دخول عميل"
              value={profile.hasClientLogin ? "مرتبط" : "غير مرتبط"}
            />
            <Field label="تاريخ الإنشاء" value={<span className="tabular-nums">{profile.createdAt}</span>} />
            {profile.notes && (
              <Field label="ملاحظات" value={profile.notes} />
            )}
          </div>
        </section>

        {/* Plan */}
        <section className="glass-card p-5 sm:p-6">
          <h2 className="font-heading text-base font-bold text-white flex items-center gap-2 mb-4">
            <Layers size={16} className="text-[#a855f7]" />
            الباقة
          </h2>
          {!plan ? (
            <p className="text-[13px] text-[#8ba3c7]">{OWNER_UNAVAILABLE_HINT}</p>
          ) : (
            <div className="space-y-3">
              <Field
                label="اسم الباقة"
                value={
                  <span className={cn("badge text-[11px]", PLAN_BADGE[plan.name] ?? "text-[#8ba3c7]")}>
                    {plan.name}
                  </span>
                }
              />
              <Field label="المعرّف" value={<span className="font-mono">{plan.slug}</span>} />
              <Field
                label="السعر الشهري"
                value={plan.priceMonthly != null ? `SAR ${plan.priceMonthly}` : OWNER_UNAVAILABLE_HINT}
              />
              <Field
                label="السعر السنوي"
                value={plan.priceAnnual != null ? `SAR ${plan.priceAnnual}` : OWNER_UNAVAILABLE_HINT}
              />
              <Field label="نشطة" value={plan.isActive ? "نعم" : "لا"} />
              <div className="pt-2 border-t border-white/[0.06]">
                <p className="text-[11px] text-[#8ba3c7] mb-2">حدود الباقة</p>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-white">
                  {plan.limits.maxEmployees != null && (
                    <span>موظفون: {plan.limits.maxEmployees}</span>
                  )}
                  {plan.limits.aiLevel != null && (
                    <span>مستوى AI: {plan.limits.aiLevel}</span>
                  )}
                  {plan.limits.whatsappEnabled != null && (
                    <span>واتساب: {plan.limits.whatsappEnabled ? "مفعّل" : "غير مفعّل"}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Subscription */}
        <section className="glass-card p-5 sm:p-6">
          <h2 className="font-heading text-base font-bold text-white flex items-center gap-2 mb-4">
            <CreditCard size={16} className="text-[#1e6fd9]" />
            الاشتراك
          </h2>
          {!subscription ? (
            <p className="text-[13px] text-[#8ba3c7]">لا يوجد اشتراك مسجّل لهذه المنشأة.</p>
          ) : (
            <div className="space-y-3">
              <Field
                label="الحالة"
                value={
                  <span className={cn("badge text-[11px]", SUB_STATUS_BADGE[subscription.statusAr] ?? "text-[#8ba3c7]")}>
                    {subscription.statusAr}
                  </span>
                }
              />
              <Field label="دورة الفوترة" value={subscription.billingCycleAr} />
              <Field label="تاريخ البدء" value={<span className="tabular-nums">{subscription.startedAt}</span>} />
              <Field
                label="تاريخ الانتهاء"
                value={
                  subscription.endsAt
                    ? <span className="tabular-nums">{subscription.endsAt}</span>
                    : "—"
                }
              />
            </div>
          )}
        </section>

        {/* Usage */}
        <section className="glass-card p-5 sm:p-6">
          <h2 className="font-heading text-base font-bold text-white flex items-center gap-2 mb-4">
            <Gauge size={16} className="text-[#a855f7]" />
            الاستخدام
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
              <div className="flex items-center gap-2 text-[12px] text-[#8ba3c7]">
                <Sparkles size={14} className="text-[#c084fc]" />
                طلبات الذكاء الاصطناعي
              </div>
              <span className={cn("text-[13px] font-medium", usage.aiRequests.available ? "text-white" : "text-[#8ba3c7]")}>
                {usage.aiRequests.display}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
              <div className="flex items-center gap-2 text-[12px] text-[#8ba3c7]">
                <MessageCircle size={14} className="text-[#34d399]" />
                رسائل واتساب
              </div>
              <span className="text-[13px] text-[#8ba3c7]">{usage.whatsappMessages.display}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
              <div className="flex items-center gap-2 text-[12px] text-[#8ba3c7]">
                <Users size={14} className="text-[#5b9bf0]" />
                الموظفون (مقابل حد الباقة)
              </div>
              <span className={cn("text-[13px] font-medium tabular-nums", usage.employeesUsed.available ? "text-white" : "text-[#8ba3c7]")}>
                {usage.employeesUsed.display}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Users / profiles */}
      <section className="glass-card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-base font-bold text-white flex items-center gap-2">
            <UserCircle size={16} className="text-[#22d3ee]" />
            حسابات المستخدمين (profiles)
          </h2>
          {data.usersAvailable && (
            <span className="text-[11px] text-[#8ba3c7]">{data.users.length} حساب</span>
          )}
        </div>
        {!data.usersAvailable ? (
          <p className="text-[13px] text-[#8ba3c7]">{OWNER_UNAVAILABLE_HINT}</p>
        ) : data.users.length === 0 ? (
          <p className="text-[13px] text-[#8ba3c7]">لا توجد حسابات مرتبطة بهذه المنشأة.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[520px]">
              <thead>
                <tr className="text-[11px] text-[#8ba3c7] border-b border-white/[0.07]">
                  <th className="font-medium pb-3 pr-1">الاسم</th>
                  <th className="font-medium pb-3">البريد</th>
                  <th className="font-medium pb-3">الدور</th>
                  <th className="font-medium pb-3">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id} className="border-b border-white/[0.04]">
                    <td className="py-3 pr-1 text-[12px] text-white">{u.name || "—"}</td>
                    <td className="py-3 text-[12px] text-[#8ba3c7]">{u.email}</td>
                    <td className="py-3 text-[12px] text-white font-mono text-[11px]">{u.role}</td>
                    <td className="py-3">
                      <span className={cn("badge text-[10px]", u.isActive ? "bg-[#10b981]/15 text-[#34d399]" : "bg-[#6b7280]/15 text-[#9ca3af]")}>
                        {u.isActive ? "نشط" : "غير نشط"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Employees */}
      <section className="glass-card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-base font-bold text-white flex items-center gap-2">
            <Users size={16} className="text-[#10b981]" />
            الموظفون
          </h2>
          {data.employeesAvailable && data.employeeTotal != null && (
            <span className="text-[11px] text-[#8ba3c7]">
              {data.employeeTotal} إجمالي — عرض {data.employees.length} أحدث
            </span>
          )}
        </div>
        {!data.employeesAvailable ? (
          <p className="text-[13px] text-[#8ba3c7]">{OWNER_UNAVAILABLE_HINT}</p>
        ) : data.employees.length === 0 ? (
          <p className="text-[13px] text-[#8ba3c7]">لا يوجد موظفون مسجّلون لهذه المنشأة.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[640px]">
              <thead>
                <tr className="text-[11px] text-[#8ba3c7] border-b border-white/[0.07]">
                  <th className="font-medium pb-3 pr-1">الاسم</th>
                  <th className="font-medium pb-3">البريد</th>
                  <th className="font-medium pb-3">القسم</th>
                  <th className="font-medium pb-3">الحالة</th>
                  <th className="font-medium pb-3">تاريخ الانضمام</th>
                </tr>
              </thead>
              <tbody>
                {data.employees.map((e) => (
                  <tr key={e.id} className="border-b border-white/[0.04]">
                    <td className="py-3 pr-1 text-[12px] text-white">{e.name}</td>
                    <td className="py-3 text-[12px] text-[#8ba3c7]">{e.email}</td>
                    <td className="py-3 text-[12px] text-white">{e.department || "—"}</td>
                    <td className="py-3 text-[12px] text-white">{e.status}</td>
                    <td className="py-3 text-[12px] text-[#8ba3c7] tabular-nums">{e.joinDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Tasks */}
      <section className="glass-card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-base font-bold text-white flex items-center gap-2">
            <ListTodo size={16} className="text-[#1e6fd9]" />
            المهام (قراءة فقط)
          </h2>
          {data.tasksAvailable && data.taskTotal != null && (
            <span className="text-[11px] text-[#8ba3c7]">
              {data.taskTotal} إجمالي — عرض {data.tasks.length} أحدث
            </span>
          )}
        </div>
        {!data.tasksAvailable ? (
          <p className="text-[13px] text-[#8ba3c7]">{OWNER_UNAVAILABLE_HINT}</p>
        ) : data.tasks.length === 0 ? (
          <p className="text-[13px] text-[#8ba3c7]">لا توجد مهام لهذه المنشأة.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[720px]">
              <thead>
                <tr className="text-[11px] text-[#8ba3c7] border-b border-white/[0.07]">
                  <th className="font-medium pb-3 pr-1">العنوان</th>
                  <th className="font-medium pb-3">الحالة</th>
                  <th className="font-medium pb-3">الأولوية</th>
                  <th className="font-medium pb-3">المكلف</th>
                  <th className="font-medium pb-3">الاستحقاق</th>
                </tr>
              </thead>
              <tbody>
                {data.tasks.map((t) => (
                  <tr key={t.id} className="border-b border-white/[0.04]">
                    <td className="py-3 pr-1 text-[12px] text-white max-w-[200px] truncate">{t.title}</td>
                    <td className="py-3 text-[12px] text-white">{t.status}</td>
                    <td className="py-3 text-[12px] text-[#8ba3c7]">{t.priority}</td>
                    <td className="py-3 text-[12px] text-[#8ba3c7]">{t.assigneeName || "—"}</td>
                    <td className="py-3 text-[12px] text-[#8ba3c7] tabular-nums">{t.dueDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Activity timeline */}
      <section className="glass-card p-5 sm:p-6">
        <h2 className="font-heading text-base font-bold text-white flex items-center gap-2 mb-5">
          <Activity size={16} className="text-[#22d3ee]" />
          سجل نشاط المالك (هذه المنشأة)
        </h2>
        {auditTimeline.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[160px] text-center px-4 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02]">
            <ShieldCheck size={28} className="text-[#22d3ee]/30 mb-3" strokeWidth={1.4} />
            <p className="text-[14px] font-medium text-white">{OWNER_ACTIVITY_EMPTY}</p>
          </div>
        ) : (
          <ol className="relative space-y-4">
            <span className="absolute top-1 bottom-1 right-[18px] w-px bg-white/[0.08]" aria-hidden />
            {auditTimeline.map((item) => {
              const a = ACCENT[item.accent];
              const Icon = item.icon;
              return (
                <li key={item.id} className="relative flex gap-3 pr-0">
                  <span
                    className={cn(
                      "relative z-10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border",
                      a.iconBg,
                      a.border,
                    )}
                  >
                    <Icon size={15} className={a.text} />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <div className="text-[13px] font-medium text-white leading-snug">{item.title}</div>
                    <div className="text-[12px] text-[#8ba3c7] mt-0.5">{item.detail}</div>
                    <div className="text-[11px] text-[#5f7798] mt-0.5">{item.time}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
